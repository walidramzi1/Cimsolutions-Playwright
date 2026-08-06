// ============================================================================
// Imports
// ============================================================================
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { validateTerms, type ValidationResult } from '../../src/lib/validate-terms.js';
import type { ScrapedTerm } from '../../src/lib/types.js';

// createBdd() geeft ons de Given/When/Then/Before-functies waarmee we hieronder de stappen
// uit term-validator.feature koppelen aan echte TypeScript-code.
const { Given, When, Then, Before } = createBdd();

// ============================================================================
// State die tussen de stappen van één scenario gedeeld wordt
// ============================================================================

// `batch` is de lijst term-ID-paren die de Gegeven-stappen opbouwen.
// `result` is de uitkomst van validateTerms(), gezet door de Als-stap.
let batch: ScrapedTerm[] = [];
let result: ValidationResult = { validated: [], flagged: [] };

// Before() draait vóór elk scenario: zet batch en result terug naar leeg, zodat scenario's
// elkaar niet kunnen beïnvloeden.
Before(() => {
  batch = [];
  result = { validated: [], flagged: [] };
});

// ============================================================================
// Helperfunctie: een geldig term-ID-paar met standaardwaarden
// ============================================================================

// Bouwt één ScrapedTerm met redelijke standaardwaarden. `overrides` overschrijft alleen de
// velden die je expliciet meegeeft; de rest blijft op de standaardwaarde staan.
function makeTerm(overrides: Partial<ScrapedTerm> = {}): ScrapedTerm {
  return {
    term: 'JavaScript',
    source_id: 'MOD-1001',
    role: 'Frontend Developer',
    source_url: 'https://partner.cimsolutions.nl/nl-NL/module/1',
    scraped_at: new Date().toISOString(),
    referentienummer: null,
    opdrachtgever: null,
    deadline: '31-12-2099 23:59',
    uren_per_week: null,
    ...overrides,
  };
}

// Elke step hieronder die een {string}/{int} uit de featuretekst opvangt, krijgt als eerste
// argument altijd een fixtures-object mee (hier leeg: {}), zelfs als er geen Playwright-fixture
// nodig is. Dat is een vaste conventie van playwright-bdd/Playwright, geen keuze van dit
// project.

// ============================================================================
// Given: de batch opbouwen
// ============================================================================

// Stap "Gegeven een schone batch van drie termen voor rol "<rol>"" (de Achtergrond-stap).
Given('een schone batch van drie termen voor rol {string}', ({}, role: string) => {
  // Maak drie geldige termen aan, allemaal met dezelfde rol.
  batch = [
    makeTerm({ role, source_id: 'MOD-1001' }),
    makeTerm({ role, term: 'TypeScript', source_id: 'MOD-1002' }),
    makeTerm({ role, term: 'React', source_id: 'MOD-1003' }),
  ];
});

// Stap "Gegeven een extra term met een lege waarde": voegt een term toe die alleen spaties bevat.
Given('een extra term met een lege waarde', () => {
  batch.push(makeTerm({ term: '   ' }));
});

// Stap "Gegeven een extra term met waarde "<waarde>"": voegt een term met een specifieke tekst toe.
Given('een extra term met waarde {string}', ({}, waarde: string) => {
  batch.push(makeTerm({ term: waarde }));
});

// Stap "Gegeven een extra term met rol "<rol>"": voegt een term met een afwijkende rol toe.
Given('een extra term met rol {string}', ({}, rol: string) => {
  batch.push(makeTerm({ role: rol }));
});

// Stap "Gegeven een extra term met source_id "<id>"": voegt een term met een specifiek source_id toe.
Given('een extra term met source_id {string}', ({}, sourceId: string) => {
  batch.push(makeTerm({ source_id: sourceId }));
});

// Stap "Gegeven een extra term met deadline "<datum>"": voegt een term met een specifieke deadline toe.
Given('een extra term met deadline {string}', ({}, deadline: string) => {
  batch.push(makeTerm({ deadline }));
});

// Stap "Gegeven een extra term zonder deadline": voegt een term toe met deadline = null.
Given('een extra term zonder deadline', () => {
  batch.push(makeTerm({ deadline: null }));
});

// Stap "Gegeven een extra term zonder rol": voegt een term toe met een lege rol.
Given('een extra term zonder rol', () => {
  batch.push(makeTerm({ role: '' }));
});

// ============================================================================
// When: de actie die getest wordt
// ============================================================================

// Stap "Als de batch gevalideerd wordt voor rol "<rol>"": draait de eigenlijke validatie.
When('de batch gevalideerd wordt voor rol {string}', ({}, role: string) => {
  result = validateTerms(batch, role);
});

// ============================================================================
// Then: de controles op het resultaat
// ============================================================================

// Stap "Dan zijn er <aantal> termen gevalideerd".
Then('zijn er {int} termen gevalideerd', ({}, aantal: number) => {
  expect(result.validated).toHaveLength(aantal);
});

// Stap "Dan zijn er <aantal> termen geflagd".
Then('zijn er {int} termen geflagd', ({}, aantal: number) => {
  expect(result.flagged).toHaveLength(aantal);
});

// Stap "Dan is er <aantal> term geflagd met reden "<reden>"": controleert de exacte reden-tekst.
Then('is er {int} term geflagd met reden {string}', ({}, aantal: number, reden: string) => {
  expect(result.flagged).toHaveLength(aantal);
  expect(result.flagged[0].reasons).toContain(reden);
});

// Zelfde als hierboven, maar dan met een deel van de reden-tekst (voor redenen die dynamische
// waarden bevatten, zoals de afgewezen rol of deadline zelf).
Then('is er {int} term geflagd met een reden die matcht op {string}', ({}, aantal: number, deel: string) => {
  expect(result.flagged).toHaveLength(aantal);
  expect(result.flagged[0].reasons[0]).toContain(deel);
});

// Stap "Dan heeft dat geflagde item nog steeds rol "<rol>"": controleert dat de rol niet stiekem
// is aangepast naar de verwachte rol.
Then('heeft dat geflagde item nog steeds rol {string}', ({}, rol: string) => {
  expect(result.flagged[0].term.role).toBe(rol);
});

// Stap "Dan staat elk item van de batch in gevalideerd of geflagd": controleert dat er niets
// stilzwijgend verdwenen is (elk item van de input moet in precies één van beide lijsten staan).
Then('staat elk item van de batch in gevalideerd of geflagd', () => {
  expect(result.validated.length + result.flagged.length).toBe(batch.length);
});
