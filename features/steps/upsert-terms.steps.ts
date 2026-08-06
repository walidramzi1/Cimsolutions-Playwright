// ============================================================================
// Imports
// ============================================================================
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { upsertTerms } from '../../src/lib/upsert-terms.js';
import { supabase } from '../../src/lib/supabase-client.js';
import type { ScrapedTerm } from '../../src/lib/types.js';

// createBdd() geeft ons de Given/When/Then/After-functies waarmee we hieronder de stappen uit
// upsert-terms.feature koppelen aan echte TypeScript-code.
const { Given, When, Then, After } = createBdd();

// ============================================================================
// State die tussen de stappen van één scenario gedeeld wordt
// ============================================================================

// Welke rol als "testrol" geldt, staat in elk scenario expliciet in de Achtergrond-stap; geen
// verborgen state nodig buiten dit ene variabele.
let testRole = '__smoke_test__';

// After() draait ná elk scenario: ruimt de testrijen op in Supabase, zodat een volgende run
// niet struikelt over data van deze run.
After(async () => {
  await supabase.from('scraped_terms').delete().eq('role', testRole);
});

// ============================================================================
// Helperfunctie: een testterm bouwen
// ============================================================================

// Bouwt één ScrapedTerm voor deze tests. De overige velden (referentienummer, deadline, ...)
// zijn hier niet relevant en staan daarom op null.
function makeTerm(term: string, sourceId: string): ScrapedTerm {
  return {
    term,
    source_id: sourceId,
    role: testRole,
    source_url: 'https://partner.cimsolutions.nl/smoke-test',
    scraped_at: new Date().toISOString(),
    referentienummer: null,
    opdrachtgever: null,
    deadline: null,
    uren_per_week: null,
  };
}

// Elke step hieronder die een {string}/{int} uit de featuretekst opvangt, krijgt als eerste
// argument altijd een fixtures-object mee (hier leeg: {}); vaste conventie van
// playwright-bdd/Playwright, zie term-validator.steps.ts voor dezelfde toelichting.

// ============================================================================
// Given: de teststaat voorbereiden
// ============================================================================

// Stap "Gegeven een lege staat voor de testrol "<rol>" in scraped_terms" (de Achtergrond-stap).
Given('een lege staat voor de testrol {string} in scraped_terms', async ({}, rol: string) => {
  // Onthoud de rolnaam voor de rest van dit scenario.
  testRole = rol;
  // Verwijder eventuele bestaande rijen voor deze rol, zodat elk scenario met een schone lei begint.
  await supabase.from('scraped_terms').delete().eq('role', testRole);
});

// Stap "Gegeven term "<term>" met source_id "<id>" is al weggeschreven voor de testrol":
// zet een bestaande rij neer vóórdat het scenario de eigenlijke actie uitvoert.
Given(
  'term {string} met source_id {string} is al weggeschreven voor de testrol',
  async ({}, term: string, sourceId: string) => {
    await upsertTerms([makeTerm(term, sourceId)]);
  },
);

// ============================================================================
// When: de actie die getest wordt
// ============================================================================

// Stap "Als term "<term>" met source_id "<id>" wordt weggeschreven voor de testrol": de
// daadwerkelijke upsert-aanroep die getest wordt.
When(
  'term {string} met source_id {string} wordt weggeschreven voor de testrol',
  async ({}, term: string, sourceId: string) => {
    await upsertTerms([makeTerm(term, sourceId)]);
  },
);

// ============================================================================
// Then: de controles op het resultaat
// ============================================================================

// Stap "Dan bevat scraped_terms voor source_id "<id>" de term "<verwachteTerm>"":
// haalt de rij op uit Supabase en controleert de opgeslagen term-tekst.
Then(
  'bevat scraped_terms voor source_id {string} de term {string}',
  async ({}, sourceId: string, verwachteTerm: string) => {
    const { data, error } = await supabase
      .from('scraped_terms')
      .select('*')
      .eq('source_id', sourceId)
      .eq('role', testRole);

    // Geen foutmelding, precies één rij, en die rij bevat de verwachte tekst.
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].term).toBe(verwachteTerm);
  },
);

// Stap "Dan staat er nog steeds precies <aantal> rij in scraped_terms voor source_id "<id>"":
// controleert dat een upsert bijwerkt in plaats van een nieuwe rij toe te voegen.
Then(
  'staat er nog steeds precies {int} rij in scraped_terms voor source_id {string}',
  async ({}, aantal: number, sourceId: string) => {
    const { data, error } = await supabase
      .from('scraped_terms')
      .select('*')
      .eq('source_id', sourceId)
      .eq('role', testRole);

    expect(error).toBeNull();
    expect(data).toHaveLength(aantal);
  },
);
