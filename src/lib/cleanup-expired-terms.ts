// ============================================================================
// Imports
// ============================================================================
import { supabase } from './supabase-client.js';
import { parseDeadline } from './validate-terms.js';

// ============================================================================
// Types
// ============================================================================

// Eén verwijderde rij, voor rapportage.
export interface DeletedTerm {
  term: string;
  source_id: string;
  deadline: string | null;
}

// ============================================================================
// Hoofdfunctie
// ============================================================================

/**
 * Verwijdert alle rijen in `scraped_terms` voor `role` waarvan de deadline verstreken is of
 * ontbreekt/onbruikbaar is. De database bevat hierdoor alleen aanvragen waarvan we kunnen
 * bevestigen dat de deadline nog niet verstreken is — precies dezelfde maatstaf als
 * `term-validator`'s deadline-check (`parseDeadline`), zodat "geldig" overal hetzelfde betekent.
 *
 * Dit raakt alleen `scraped_terms`; een al gepubliceerd Monday-item blijft gewoon staan. Als
 * een verwijderde aanvraag ooit weer zou opduiken (in de praktijk niet, want de GUID is
 * systeemgegenereerd per aanvraag), zou hij bij een volgende scraper-run gewoon opnieuw als
 * nieuwe rij aangemaakt worden.
 */
export async function deleteExpiredTerms(role: string): Promise<DeletedTerm[]> {
  // Stap 1: haal alle huidige rijen voor deze rol op.
  const { data, error } = await supabase
    .from('scraped_terms')
    .select('id, term, source_id, deadline')
    .eq('role', role);

  if (error) {
    throw error;
  }

  // Stap 2: bepaal welke rijen verstreken of onbruikbaar zijn (zelfde maatstaf als term-validator).
  const expiredRows = (data ?? []).filter((row) => {
    if (!row.deadline) return true;
    const parsedDeadline = parseDeadline(row.deadline);
    if (!parsedDeadline) return true;
    return parsedDeadline.getTime() < Date.now();
  });

  if (expiredRows.length === 0) {
    return [];
  }

  // Stap 3: verwijder die rijen in één keer, op id.
  const idsToDelete = expiredRows.map((row) => row.id);
  const { error: deleteError } = await supabase.from('scraped_terms').delete().in('id', idsToDelete);

  if (deleteError) {
    throw deleteError;
  }

  return expiredRows.map((row) => ({ term: row.term, source_id: row.source_id, deadline: row.deadline }));
}
