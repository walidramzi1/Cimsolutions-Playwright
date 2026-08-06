// ============================================================================
// Imports
// ============================================================================
import type { ScrapedTerm } from './types.js';

// ============================================================================
// Types
// ============================================================================

// Eén geflagd item: de term zelf, plus alle redenen waarom hij geflagd is.
export interface FlaggedTerm {
  term: ScrapedTerm;
  reasons: string[];
}

// Het resultaat van validateTerms(): elk item van de input staat in precies één van deze twee lijsten.
export interface ValidationResult {
  validated: ScrapedTerm[];
  flagged: FlaggedTerm[];
}

// ============================================================================
// Constanten
// ============================================================================

// Patronen die duiden op een mislukte scrape (HTML-restje, foutmelding, afgekapte tekst) in
// plaats van een echte term.
const ARTIFACT_PATTERNS = [/<[^>]+>/, /\bundefined\b/i, /\bnull\b/i, /\b404\b/, /\b500\b/, /…$|\.\.\.$/];

// ============================================================================
// Helperfuncties: source_id-formaat vergelijken
// ============================================================================

// Grove vorm-classificatie (cijfer/letter/overig) om source_id-formaten binnen één batch te vergelijken.
function idShape(sourceId: string): string {
  // Vervang elk cijfer door "d" en elke letter door "a", zodat bijv. "MOD-1001" wordt tot "aaa-dddd".
  return sourceId.replace(/[0-9]/g, 'd').replace(/[a-zA-Z]/g, 'a');
}

// Telt hoe vaak elk source_id-formaat voorkomt in de batch, en geeft het meest voorkomende
// formaat terug. Dat is het formaat waar afwijkende source_id's later tegen vergeleken worden.
function majorityShape(terms: ScrapedTerm[]): string {
  // Stap 1: tel per formaat hoe vaak het voorkomt.
  const countPerShape = new Map<string, number>();
  for (const term of terms) {
    const shape = idShape(term.source_id);
    const countSoFar = countPerShape.get(shape) ?? 0;
    countPerShape.set(shape, countSoFar + 1);
  }

  // Stap 2: zoek het formaat met de hoogste telling.
  let mostCommonShape = '';
  let highestCount = -1;
  for (const [shape, count] of countPerShape) {
    if (count > highestCount) {
      mostCommonShape = shape;
      highestCount = count;
    }
  }
  return mostCommonShape;
}

// ============================================================================
// Helperfunctie: deadline parsen
// ============================================================================

// Deadline komt van de bronsite als "D-M-YYYY HH:MM" (bijv. "6-8-2026 05:30").
function parseDeadline(deadline: string): Date | null {
  // Haal dag, maand, jaar, uur en minuut uit de tekst met een reguliere expressie.
  const match = deadline.match(/^(\d{1,2})-(\d{1,2})-(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!match) return null;

  // match[0] is de hele match zelf; we slaan die over met de lege plek vooraan.
  const [, day, month, year, hour, minute] = match;

  // JavaScript's Date rekent maanden vanaf 0 (januari = 0), dus month - 1.
  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour ? Number(hour) : 0,
    minute ? Number(minute) : 0,
  );

  // Een ongeldige datum (bijv. 32 februari) levert een "Invalid Date" op; die geven we door als null.
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

// ============================================================================
// Helperfuncties: lengte-uitschieters berekenen
// ============================================================================

// Berekent het gemiddelde van een lijst getallen.
function calculateAverage(numbers: number[]): number {
  let total = 0;
  for (const number of numbers) {
    total += number;
  }
  return total / numbers.length;
}

// Berekent de standaarddeviatie (hoeveel de getallen gemiddeld afwijken van het gemiddelde).
function calculateStandardDeviation(numbers: number[], average: number): number {
  let sumOfSquaredDifferences = 0;
  for (const number of numbers) {
    const difference = number - average;
    sumOfSquaredDifferences += difference * difference;
  }
  const variance = sumOfSquaredDifferences / numbers.length;
  return Math.sqrt(variance);
}

// Termen buiten [gemiddelde ± 2x standaarddeviatie] gelden als een lengte-uitschieter binnen
// deze batch (bijv. een halve zin waar de rest van de batch losse functienamen bevat).
function lengthBounds(terms: ScrapedTerm[]): { min: number; max: number } {
  const lengths = terms.map((term) => term.term.trim().length);
  const average = calculateAverage(lengths);
  const standardDeviation = calculateStandardDeviation(lengths, average);
  return { min: average - 2 * standardDeviation, max: average + 2 * standardDeviation };
}

// ============================================================================
// Hoofdfunctie
// ============================================================================

/**
 * Splitst een batch gescrapete term-ID-paren in `validated` en `flagged`, elk met de reden(en)
 * van afkeuring. Flaggen is altijd expliciet: er wordt nooit een waarde verzonnen of
 * stilzwijgend doorgelaten, en elk item van de input staat in precies één van beide lijsten.
 *
 * Controles: lege/artefact-termen, ontbrekend of afwijkend source_id-formaat binnen de batch,
 * afwijkende `role`, statistische lengte-uitschieters, en een verstreken of ontbrekende
 * `deadline` (de bronsite blijkt "open" aanvragen te tonen die allang over deadline zijn, dus
 * dit wordt hier expliciet gecontroleerd in plaats van vertrouwd op de bronsite-filter).
 */
export function validateTerms(terms: ScrapedTerm[], expectedRole: string): ValidationResult {
  const validated: ScrapedTerm[] = [];
  const flagged: FlaggedTerm[] = [];

  // Bereken vooraf, over de hele batch, welk source_id-formaat en welke termlengte "normaal" zijn.
  const expectedShape = majorityShape(terms);
  const { min, max } = lengthBounds(terms);

  // Loop over elke term heen en verzamel per term alle redenen waarom hij eventueel afgekeurd wordt.
  for (const term of terms) {
    const reasons: string[] = [];
    const trimmedTerm = term.term.trim();

    // Check 1: is de term leeg, of bevat hij een scrape-artefact?
    if (trimmedTerm.length === 0) {
      reasons.push('term is leeg');
    } else if (ARTIFACT_PATTERNS.some((pattern) => pattern.test(trimmedTerm))) {
      reasons.push('term bevat een scrape-artefact (HTML-tag, foutmelding of afgekapte tekst)');
    }

    // Check 2: ontbreekt source_id, of wijkt het formaat af van de rest van de batch?
    if (!term.source_id || term.source_id.trim().length === 0) {
      reasons.push('source_id ontbreekt');
    } else if (idShape(term.source_id) !== expectedShape) {
      reasons.push('source_id-formaat wijkt af van de rest van de batch');
    }

    // Check 3: ontbreekt de rol, of komt hij niet overeen met de verwachte rol?
    if (!term.role || term.role.trim().length === 0) {
      reasons.push('role ontbreekt');
    } else if (term.role.trim() !== expectedRole) {
      reasons.push(`role ("${term.role}") komt niet overeen met verwachte rol ("${expectedRole}")`);
    }

    // Check 4: is de lengte van de term een statistische uitschieter binnen deze batch?
    if (trimmedTerm.length > 0 && (trimmedTerm.length < min || trimmedTerm.length > max)) {
      reasons.push('lengte van term is een uitschieter binnen deze batch');
    }

    // Check 5: ontbreekt de deadline, kan hij niet geparsed worden, of is hij al verstreken?
    if (!term.deadline) {
      reasons.push('deadline ontbreekt, kan niet worden geverifieerd of de aanvraag nog open is');
    } else {
      const parsedDeadline = parseDeadline(term.deadline);
      if (!parsedDeadline) {
        reasons.push(`deadline ("${term.deadline}") kon niet worden geparsed`);
      } else if (parsedDeadline.getTime() < Date.now()) {
        reasons.push(`deadline (${term.deadline}) is al verstreken`);
      }
    }

    // Geen redenen gevonden → gevalideerd. Eén of meer redenen → geflagd (met die redenen erbij).
    if (reasons.length === 0) {
      validated.push(term);
    } else {
      flagged.push({ term, reasons });
    }
  }

  return { validated, flagged };
}
