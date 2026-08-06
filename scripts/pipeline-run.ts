// ============================================================================
// Imports
// ============================================================================
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { upsertTerms } from '../src/lib/upsert-terms.js';
import { validateTerms, type FlaggedTerm } from '../src/lib/validate-terms.js';
import type { ScrapedTerm } from '../src/lib/types.js';

// ============================================================================
// Command-line argument uitlezen
// ============================================================================

// Het script wordt aangeroepen als: npx tsx scripts/pipeline-run.ts <rol>
const role = process.argv[2];
if (!role) {
  console.error('Gebruik: npx tsx scripts/pipeline-run.ts <rol>');
  process.exit(1);
}

// ============================================================================
// Helperfuncties
// ============================================================================

// Leest scraped-output/<rol>.json in (de output van scraper-run voor deze rol).
function readScrapedTerms(role: string): ScrapedTerm[] {
  const inputPath = path.join(process.cwd(), 'scraped-output', `${role}.json`);
  if (!fs.existsSync(inputPath)) {
    console.error(`Geen scraper-output gevonden op ${inputPath}. Draai eerst scraper-run voor deze rol.`);
    process.exit(1);
  }
  const fileContent = fs.readFileSync(inputPath, 'utf-8');
  return JSON.parse(fileContent);
}

// Schrijft geflagde items naar een los bestand (niet alleen naar de console), zodat een
// teamlid een mislukte of onverwachte run kan diagnosticeren zonder de terminal-history van de
// betreffende run terug te hoeven vinden.
function writeFlaggedItems(role: string, flaggedTerms: FlaggedTerm[]): void {
  const flaggedPath = path.join(process.cwd(), 'scraped-output', `${role}.flagged.json`);

  // Bouw een korte versie van elk geflagd item op (alleen wat nodig is om te diagnosticeren).
  const itemsForFile = [];
  for (const flaggedTerm of flaggedTerms) {
    itemsForFile.push({
      term: flaggedTerm.term.term,
      source_id: flaggedTerm.term.source_id,
      reasons: flaggedTerm.reasons,
    });
  }
  fs.writeFileSync(flaggedPath, JSON.stringify(itemsForFile, null, 2));

  // Log ook meteen elk geflagd item met zijn redenen, voor snelle diagnose in de terminal.
  console.log(`[pipeline-run] geflagde items weggeschreven naar ${flaggedPath}:`);
  for (const flaggedTerm of flaggedTerms) {
    const reasonList = flaggedTerm.reasons.join('; ');
    console.log(`  - "${flaggedTerm.term.term}" (${flaggedTerm.term.source_id}): ${reasonList}`);
  }
}

// ============================================================================
// Hoofdprogramma
// ============================================================================

async function main() {
  // Stap 1: lees de gescrapete termen voor deze rol in.
  const terms = readScrapedTerms(role);
  console.log(`[pipeline-run] ${terms.length} gescrapete term-ID-paren geladen voor rol "${role}".`);

  // Stap 2: valideer de termen (vormcontrole + deadline-check).
  const { validated, flagged } = validateTerms(terms, role);
  console.log(`[pipeline-run] term-validator: ${validated.length} gevalideerd, ${flagged.length} geflagd.`);

  // Stap 3: schrijf geflagde items weg naar een los bestand, als er zijn.
  if (flagged.length > 0) {
    writeFlaggedItems(role, flagged);
  }

  // Stap 4: schrijf de gevalideerde termen weg naar Supabase (upsert op source_id + role).
  const upserted = await upsertTerms(validated);
  console.log(
    `[pipeline-run] ${upserted?.length ?? 0} rijen weggeschreven/bijgewerkt in Supabase (scraped_terms).`,
  );
  console.log('[pipeline-run] Geen Monday-publicatie uitgevoerd — dat blijft een expliciete, losse actie.');

  // Stap 5: log een korte samenvatting van de hele run.
  console.log(
    `[pipeline-run] samenvatting: rol="${role}" gescraped=${terms.length} gevalideerd=${validated.length} geflagd=${flagged.length} upserted=${upserted?.length ?? 0}`,
  );
}

main().catch((error) => {
  console.error('[pipeline-run] Fout:', JSON.stringify(error, null, 2));
  console.error(error);
  process.exit(1);
});
