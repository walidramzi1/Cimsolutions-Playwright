// ============================================================================
// Imports
// ============================================================================
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import fs from 'node:fs';
import path from 'node:path';
import { ensureLoggedIn } from '../../src/lib/ensure-logged-in.js';
import {
  gotoOpportunitiesList,
  filterByFunctienaam,
  extractTermIdPairs,
  currentRowCount,
} from '../../src/pages/opportunities-list.page.js';
import type { ScrapedTerm } from '../../src/lib/types.js';

// createBdd() geeft ons de Given/When/Then-functies waarmee we hieronder de stappen uit
// scraper-run.feature koppelen aan echte TypeScript-code.
const { Given, When, Then } = createBdd();

// Map waar scraper-run.feature de gescrapete output naartoe schrijft.
const OUTPUT_DIR = 'scraped-output';

// ============================================================================
// Types
// ============================================================================

// Eén regel in de samenvatting: het resultaat van één zoekterm binnen de scraper-run.
interface SearchTermSummary {
  term: string;
  rowsSeen: number;
  newMatches: number;
}

// De volledige samenvatting van één scraper-run voor één rol: alle zoektermen samen.
interface ScrapeSummary {
  role: string;
  searchTerms: SearchTermSummary[];
  totalUnique: number;
}

// ============================================================================
// Helperfuncties
// ============================================================================

// Leest src/config/role-search-terms.json in en geeft het terug als een object
// { rolnaam: [zoekterm1, zoekterm2, ...] }.
function readRoleSearchTerms(): Record<string, string[]> {
  const configPath = path.join(process.cwd(), 'src/config/role-search-terms.json');
  const fileContent = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(fileContent);
}

// Voegt nieuwe matches toe aan `found`, en slaat matches over die er al in staan.
// Meerdere zoektermen kunnen dezelfde aanvraag opleveren, dus dedupliceren we hier over alle
// zoektermen van een rol heen op source_id (niet alleen binnen één zoekterm).
function addNewMatches(found: Map<string, ScrapedTerm>, matches: ScrapedTerm[]): void {
  // Loop over elke nieuw gevonden match heen.
  for (const match of matches) {
    // Alleen toevoegen als deze source_id nog niet eerder is gezien.
    if (!found.has(match.source_id)) {
      found.set(match.source_id, match);
    }
  }
}

// Schrijft twee bestanden weg naar scraped-output/: de term-ID-paren zelf, en de samenvatting.
function writeScraperOutput(role: string, terms: ScrapedTerm[], summary: ScrapeSummary): void {
  // Zorg dat de output-map bestaat voordat we erin schrijven.
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Bestand 1: alle gescrapete term-ID-paren voor deze rol.
  const termsPath = path.join(OUTPUT_DIR, `${role}.json`);
  fs.writeFileSync(termsPath, JSON.stringify(terms, null, 2));

  // Bestand 2: de samenvatting (aantallen per zoekterm), voor diagnose.
  const summaryPath = path.join(OUTPUT_DIR, `${role}.summary.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
}

// ============================================================================
// Given: voorbereiding
// ============================================================================

// Stap "Gegeven een ingelogde sessie op de partnersite".
Given('een ingelogde sessie op de partnersite', async ({ page }) => {
  // Zorgt dat de browser-sessie ingelogd is (hergebruikt storageState.json waar mogelijk).
  await ensureLoggedIn(page);
});

// ============================================================================
// When: de actie die getest wordt
// ============================================================================

// Stap "Als de Opportunities-lijst gescraped wordt voor rol "<rol>"".
When('de Opportunities-lijst gescraped wordt voor rol {string}', async ({ page }, rol: string) => {
  // Stap 1: haal de lijst met zoektermen op die bij deze rol horen.
  const searchTerms = readRoleSearchTerms()[rol];
  if (!searchTerms) {
    // Geen zoektermen gevonden voor deze rol: stop meteen met een duidelijke foutmelding.
    throw new Error(`Geen zoektermen gevonden voor rol "${rol}" in src/config/role-search-terms.json.`);
  }

  // Stap 2: doorloop elke zoekterm, filter de lijst erop, en verzamel de resultaten.
  const found = new Map<string, ScrapedTerm>();
  const searchTermSummaries: SearchTermSummary[] = [];

  for (const searchTerm of searchTerms) {
    // Ga naar de lijstpagina en filter op de huidige zoekterm.
    await gotoOpportunitiesList(page);
    await filterByFunctienaam(page, searchTerm);

    // Onthoud hoeveel unieke aanvragen we al hadden, om zo dadelijk het verschil te kunnen
    // berekenen (hoeveel nieuwe matches deze zoekterm opleverde).
    const matchCountBefore = found.size;

    // Haal de term-ID-paren op die bij deze zoekterm horen, en voeg de nieuwe toe aan `found`.
    const matches = await extractTermIdPairs(page, rol);
    addNewMatches(found, matches);

    // Bewaar een samenvattingsregel voor deze zoekterm.
    searchTermSummaries.push({
      term: searchTerm,
      rowsSeen: await currentRowCount(page),
      newMatches: found.size - matchCountBefore,
    });
  }

  // Stap 3: bouw de volledige samenvatting op basis van alle zoektermen samen.
  const summary: ScrapeSummary = {
    role: rol,
    searchTerms: searchTermSummaries,
    totalUnique: found.size,
  };

  // Stap 4: schrijf de resultaten weg naar scraped-output/.
  writeScraperOutput(rol, Array.from(found.values()), summary);

  // Stap 5: log de samenvatting, zodat die ook zichtbaar is in de testrunner-output.
  console.log(`[scraper-run] rol "${rol}": ${JSON.stringify(summary)}`);
});

// ============================================================================
// Then: de controles op het resultaat
// ============================================================================

// Stap "Dan bevat de scraper-output voor rol "<rol>" alleen unieke aanvragen, ...".
Then(
  'bevat de scraper-output voor rol {string} alleen unieke aanvragen, gededupliceerd op source_id',
  ({}, rol: string) => {
    // Lees het weggeschreven bestand terug in.
    const outputPath = path.join(OUTPUT_DIR, `${rol}.json`);
    const fileContent = fs.readFileSync(outputPath, 'utf-8');
    const data: ScrapedTerm[] = JSON.parse(fileContent);

    // Haal alle source_id's eruit en controleer dat er geen dubbele tussen zitten: een Set
    // (verzameling zonder duplicaten) moet dan even lang zijn als de originele lijst.
    const sourceIds = data.map((term) => term.source_id);
    const uniqueSourceIds = new Set(sourceIds);
    expect(uniqueSourceIds.size).toBe(sourceIds.length);
  },
);

// Stap "En bevat de samenvatting voor rol "<rol>" één regel per zoekterm".
Then('bevat de samenvatting voor rol {string} één regel per zoekterm', ({}, rol: string) => {
  // Lees het samenvattingsbestand terug in.
  const summaryPath = path.join(OUTPUT_DIR, `${rol}.summary.json`);
  const fileContent = fs.readFileSync(summaryPath, 'utf-8');
  const summary = JSON.parse(fileContent);

  // Er moet precies één samenvattingsregel zijn per zoekterm van deze rol.
  const searchTerms = readRoleSearchTerms()[rol];
  expect(summary.searchTerms).toHaveLength(searchTerms.length);
});
