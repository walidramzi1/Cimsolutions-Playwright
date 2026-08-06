// ============================================================================
// Imports
// ============================================================================
import type { Page } from '@playwright/test';
import type { ScrapedTerm } from '../lib/types.js';

// ============================================================================
// Constanten
// ============================================================================
const OPPORTUNITIES_URL = 'https://partner.cimsolutions.nl/nl-NL/Opportunities/';
const ROW_SELECTOR = '[data-automationid="DetailsRowFields"]';

// ============================================================================
// Types
// ============================================================================

// Eén rij zoals die op dit moment zichtbaar is in de grid, vóórdat we hem omzetten naar een
// ScrapedTerm (die heeft ook nog `role` en `source_id` nodig, die hier nog niet bekend zijn).
interface VisibleRow {
  term: string;
  href: string;
  referentienummer: string | null;
  opdrachtgever: string | null;
  deadline: string | null;
  uren_per_week: string | null;
}

// Deze module bevat de bewerkingen op de gedeelde "Opportunities"-lijst (Fluent UI
// DetailsList) op de partnersite. Eén lijst bevat aanvragen voor alle rollen door elkaar; de
// rol wordt bepaald door de aanroeper (het argument `role` hieronder), niet door de pagina
// zelf. Elke functie krijgt de Playwright `page` gewoon als eerste argument mee, net als in
// een test zelf — geen class, geen `this`, zodat je één functie tegelijk kan lezen zonder de
// rest van het bestand nodig te hebben.

// ============================================================================
// Navigatie
// ============================================================================

/** Navigeert naar de opportunities-lijst en wacht tot de initiële data geladen is. */
export async function gotoOpportunitiesList(page: Page): Promise<void> {
  await page.goto(OPPORTUNITIES_URL);
  await page.waitForLoadState('networkidle');
}

// ============================================================================
// Filteren
// ============================================================================

/**
 * Filtert de lijst op de `Functienaam`-kolom met de operator "Bevat" (substring-match, dus
 * geen `*wildcard*` nodig in `term`).
 */
export async function filterByFunctienaam(page: Page, term: string): Promise<void> {
  // Stap 1: reset een eventueel eerder filter.
  // Het filter blijft server-side aan de view hangen tussen page.goto()-calls in, ook na
  // navigatie naar dezelfde URL. Zonder reset staat "Functienaam" niet meer beschikbaar in
  // "Filter toevoegen..." omdat hij al "in gebruik" is voor de vorige zoekterm.
  const resetButton = page.getByRole('button', { name: 'Filters resetten' });
  if (await resetButton.isEnabled().catch(() => false)) {
    await resetButton.click();
    await page.waitForLoadState('networkidle');
  }

  // Stap 2: kies de kolom "Functienaam" en de operator "Bevat".
  await page.locator('#ppg-filter-select').selectOption('name');
  await page.getByRole('combobox', { name: 'Operator' }).click();
  await page.getByRole('option', { name: 'Bevat', exact: true }).click();

  // Stap 3: typ de zoekterm in het Waarde-veld.
  const waardeField = page.getByRole('textbox', { name: 'Waarde' });
  await waardeField.click();
  // Dit veld heeft debounced client-side validatie. Playwright's fill() zet de waarde in één
  // keer neer en is te snel voor die debounce, waardoor "Toepassen" disabled blijft.
  // pressSequentially() bootst typen na en triggert de validatie wel op tijd.
  await waardeField.pressSequentially(term, { delay: 100 });
  await page.waitForTimeout(1000);

  // Stap 4: klik op "Toepassen" en wacht tot de grid daadwerkelijk is bijgewerkt.
  await page.getByRole('button', { name: 'Toepassen' }).click();
  await page.waitForLoadState('networkidle');
  // networkidle vuurt soms nog tijdens de laad-shimmer van de grid, vóór de echte rijen
  // gerenderd zijn; zonder deze marge lees je nog placeholder-rijen uit.
  await page.waitForTimeout(1500);
}

// ============================================================================
// Lezen
// ============================================================================

/** Aantal rijen dat op dit moment in de DOM staat (voor logging, niet voor dedup). */
export async function currentRowCount(page: Page): Promise<number> {
  return page.locator(ROW_SELECTOR).count();
}

/**
 * Scrollt de (gevirtualiseerde) grid tot het rijaantal stabiliseert en extraheert onderweg
 * elk term-ID-paar voor de opgegeven `role`. Dedupliceert op `source_id`, want dezelfde rij
 * kan meerdere keren voorbijkomen tijdens het scrollen.
 *
 * Rijen zonder herkenbare `id` in de href van de Functienaam-link worden overgeslagen en
 * gelogd, nooit stilzwijgend aangevuld met een gok.
 */
export async function extractTermIdPairs(page: Page, role: string): Promise<ScrapedTerm[]> {
  const rows = page.locator(ROW_SELECTOR);
  const found = new Map<string, ScrapedTerm>();
  let previousCount = -1;

  // De grid laadt/virtualiseert rijen tijdens het scrollen; één scroll is niet genoeg om alle
  // resultaten te zien. Blijf scrollen tot het rijaantal twee metingen op rij gelijk blijft,
  // met een bovengrens zodat een kapotte pagina niet oneindig doorloopt.
  for (let attempt = 0; attempt < 40; attempt++) {
    // Lees de op dit moment zichtbare rijen uit en voeg de nieuwe toe aan `found`.
    const visibleRows = await collectVisibleRows(page);
    for (const row of visibleRows) {
      addRowToFound(found, row, role);
    }

    // Stop als er niets (meer) te zien is, of als het rijaantal niet meer verandert.
    const currentCount = await rows.count();
    if (currentCount === 0) break;
    if (currentCount === previousCount && attempt > 0) break;
    previousCount = currentCount;

    // Scroll naar de laatste rij, zodat de grid meer rijen gaat laden/renderen.
    await rows.last().scrollIntoViewIfNeeded();
    await page.waitForLoadState('networkidle');
  }

  return Array.from(found.values());
}

// Voegt één zichtbare rij toe aan `found`, of slaat hem over als de href geen bruikbare id
// bevat. Losgetrokken uit extractTermIdPairs zodat die functie leesbaar blijft als "scroll tot
// stabiel, verzamel onderweg" zonder de details van id-extractie erin te hoeven volgen.
function addRowToFound(found: Map<string, ScrapedTerm>, row: VisibleRow, role: string): void {
  // Haal de id uit de href, bijvoorbeeld "...?id=1234-abcd" → "1234-abcd".
  // source_id is de Dynamics-GUID uit de href (?id=<guid>), niet het klant-referentienummer
  // (referentienummer hieronder). De GUID is systeemgegenereerd en gegarandeerd
  // uniek/aanwezig; het referentienummer is een door de klant ingevoerd veld dat leeg of
  // inconsistent geformatteerd kan zijn. Zie docs/adr/0002-source-id-dynamics-guid.md.
  const idMatch = row.href.match(/[?&]id=([^&]+)/);
  if (!idMatch) {
    // Geen id gevonden: overslaan en loggen, nooit een id verzinnen.
    console.warn(`[opportunities-list] rol "${role}": geen id in href "${row.href}", overgeslagen.`);
    return;
  }

  const sourceId = idMatch[1];
  if (found.has(sourceId)) {
    // Deze aanvraag stond er al in (bijv. door opnieuw scrollen over dezelfde rijen).
    return;
  }

  // Nieuwe, unieke aanvraag: zet hem in de Map onder zijn source_id.
  found.set(sourceId, {
    term: row.term,
    source_id: sourceId,
    role,
    source_url: row.href,
    scraped_at: new Date().toISOString(),
    referentienummer: row.referentienummer,
    opdrachtgever: row.opdrachtgever,
    deadline: row.deadline,
    uren_per_week: row.uren_per_week,
  });
}

// Leest de op dit moment zichtbare rijen uit de DOM en zet ze om naar VisibleRow-objecten.
async function collectVisibleRows(page: Page): Promise<VisibleRow[]> {
  // Deze functie draait in de browser (evaluateAll stuurt de broncode ernaartoe), dus
  // readCellText staat hier lokaal in plaats van als losse module-functie: alles wat de
  // browser nodig heeft, staat in dezelfde callback.
  return page.locator(ROW_SELECTOR).evaluateAll((rowElements) => {
    // Leest de tekst van één kolomcel in een rij, of null als de cel leeg of afwezig is.
    function readCellText(row: Element, automationKey: string): string | null {
      const cell = row.querySelector(`[data-automation-key="${automationKey}"]`);
      const text = cell?.textContent?.trim() ?? '';
      return text === '' ? null : text;
    }

    const rows: VisibleRow[] = [];

    // Loop over elke rij-element in de grid.
    for (const rowElement of rowElements) {
      // Zoek de Functienaam-link binnen deze rij; zonder link is de rij niet bruikbaar.
      const link = rowElement.querySelector('[data-automation-key="name"] a');
      if (!link) continue;

      const term = (link.textContent ?? '').trim();
      const href = link.getAttribute('href') ?? '';
      if (term === '' || href === '') continue;

      // Rij is bruikbaar: lees de overige kolommen erbij en voeg toe aan het resultaat.
      rows.push({
        term,
        href,
        referentienummer: readCellText(rowElement, 'cim_customerreferencenumber'),
        opdrachtgever: readCellText(rowElement, 'parentaccountid'),
        deadline: readCellText(rowElement, 'cim_publishenddate'),
        uren_per_week: readCellText(rowElement, 'cim_hoursperweek'),
      });
    }

    return rows;
  });
}
