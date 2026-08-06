// ============================================================================
// Imports
// ============================================================================
import { supabase } from './supabase-client.js';
import type { ScrapedTerm } from './types.js';

// ============================================================================
// Helperfunctie
// ============================================================================

// Alleen whitespace trimmen. Niet lowercasen: termen zijn technische functienaam-aanduidingen
// waar hoofdletters ertoe doen. Geen diacritics-normalisatie, de bronsite is hier tot nu toe
// consistent in.
function normalize(term: ScrapedTerm): ScrapedTerm {
  return {
    ...term,
    term: term.term.trim(),
    role: term.role.trim(),
  };
}

// ============================================================================
// Hoofdfunctie
// ============================================================================

/**
 * Schrijft gescrapete term-ID-paren weg naar Supabase (`scraped_terms`), als upsert op
 * `source_id` + `role`. Bij een match wordt de rij bijgewerkt (bijv. gewijzigde `term` of
 * `deadline`), nooit overgeslagen: dit is geen archief van eerste waarneming maar de laatst
 * bekende stand per aanvraag.
 */
export async function upsertTerms(terms: ScrapedTerm[]) {
  // Stap 1: normaliseer elke term (trim whitespace) vóór het wegschrijven.
  const normalized = terms.map(normalize);

  // Stap 2: zet elke term om naar een rij voor de scraped_terms-tabel, en upsert ze in één
  // keer. onConflict: 'source_id,role' zorgt dat een bestaande rij bijgewerkt wordt in plaats
  // van gedupliceerd.
  const rows = normalized.map((term) => ({
    term: term.term,
    source_id: term.source_id,
    role: term.role,
    source_url: term.source_url,
    scraped_at: term.scraped_at,
    referentienummer: term.referentienummer,
    opdrachtgever: term.opdrachtgever,
    deadline: term.deadline,
    uren_per_week: term.uren_per_week,
    updated_at: new Date().toISOString(),
  }));

  const { data, error } = await supabase
    .from('scraped_terms')
    .upsert(rows, { onConflict: 'source_id,role' })
    .select();

  // Stap 3: geef de fout door aan de aanroeper in plaats van hem hier stil te slikken.
  if (error) {
    throw error;
  }

  return data;
}
