// ============================================================================
// Imports
// ============================================================================
import type { Page } from '@playwright/test';

// ============================================================================
// Constanten
// ============================================================================
const DESCRIPTION_SELECTOR = '.opportunity-description';
const LOCATIE_SELECTOR = '[data-logical-name="cim_worklocation"] .form-control-static';

// ============================================================================
// Types
// ============================================================================

// Wat deze module ophaalt van de detailpagina van één aanvraag.
export interface OpdrachtDetails {
  descriptionHtml: string | null;
  locatie: string | null;
}

// ============================================================================
// Hoofdfunctie
// ============================================================================

/**
 * Haalt in één paginabezoek zowel de volledige, ongewijzigde opdrachtomschrijving als de
 * Hoofdstandplaats op van de detailpagina van een aanvraag. Gebruikt door `monday-publish` bij
 * het aanmaken van een item, niet door `scraper-run` (dat blijft op de lijstpagina).
 *
 * Opdrachtomschrijving: alle tekst zoals de klant die zelf heeft ingevoerd (context,
 * opdrachtomschrijving, eisen, wensen, competenties, gunningscriteria, interviewprocedure —
 * wat er ook in staat), niet een subset op basis van kopjes. `.opportunity-description` is de
 * exacte container hiervoor, bevestigd tegen zowel een korte als een lange aanvraag.
 *
 * Locatie: uit `cim_worklocation` (label "Hoofdstandplaats" op de detailpagina). Soms staat de
 * brontekst zelf al rommelig (bijv. straatnaam en postcode zonder spatie aan elkaar) — dat is
 * dan de daadwerkelijke inhoud van het bronveld, niet een extractiefout; niet zelf "opschonen"
 * of gokken naar de juiste opmaak.
 *
 * Uurtarief: geen bronveld voor gevonden op de detailpagina, bevestigd door te zoeken op
 * "Uurtarief"/"Tarief" in de paginatekst (beide afwezig). Blijft blanco, niet verzinnen.
 */
export async function fetchOpdrachtDetails(page: Page, sourceUrl: string): Promise<OpdrachtDetails> {
  // Stap 1: ga naar de detailpagina van deze aanvraag.
  await page.goto(sourceUrl.replace(':443', ''));
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // Stap 2: haal de opdrachtomschrijving op, als die er is.
  const descriptionLocator = page.locator(DESCRIPTION_SELECTOR).first();
  let descriptionHtml: string | null = null;
  if ((await descriptionLocator.count()) > 0) {
    descriptionHtml = await descriptionLocator.innerHTML();
  }

  // Stap 3: haal de locatie op, als die er is en niet leeg is.
  const locatieLocator = page.locator(LOCATIE_SELECTOR).first();
  let locatie: string | null = null;
  if ((await locatieLocator.count()) > 0) {
    const locatieText = (await locatieLocator.innerText()).trim();
    if (locatieText.length > 0) {
      locatie = locatieText;
    }
  }

  return { descriptionHtml, locatie };
}
