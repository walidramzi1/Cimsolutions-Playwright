// ============================================================================
// Imports
// ============================================================================
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { supabase } from '../src/lib/supabase-client.js';
import { validateTerms } from '../src/lib/validate-terms.js';
import type { ScrapedTerm } from '../src/lib/types.js';

// ============================================================================
// Command-line argument uitlezen
// ============================================================================

// Het script wordt aangeroepen als: npx tsx scripts/monday-publish-prepare.ts <rol>
const role = process.argv[2];
if (!role) {
  console.error('Gebruik: npx tsx scripts/monday-publish-prepare.ts <rol>');
  process.exit(1);
}

// ============================================================================
// Hoofdprogramma
// ============================================================================

async function main() {
  // Stap 1: lees de meest recente scraper-run-output in.
  // Bron is de meest recente scraper-run-output (aantoonbaar nog open aanvragen, want
  // "Mijn Open Opdrachten" sluit verlopen deadlines al uit), niet de volledige Supabase-tabel
  // — die accumuleert historische rijen voor altijd en bevat dus ook allang verlopen aanvragen.
  const inputPath = path.join(process.cwd(), 'scraped-output', `${role}.json`);
  if (!fs.existsSync(inputPath)) {
    console.error(`Geen scraper-output gevonden op ${inputPath}. Draai eerst scraper-run voor deze rol.`);
    process.exit(1);
  }
  const fileContent = fs.readFileSync(inputPath, 'utf-8');
  const freshTerms: ScrapedTerm[] = JSON.parse(fileContent);

  // Stap 2: valideer de termen (vormcontrole + deadline-check).
  const { validated, flagged } = validateTerms(freshTerms, role);

  // Stap 3: haal uit Supabase op welke van deze source_id's al een monday_item_id hebben
  // (dus al eerder gepubliceerd zijn).
  const freshSourceIds = freshTerms.map((term) => term.source_id);
  const { data: existingRows, error } = await supabase
    .from('scraped_terms')
    .select('source_id, monday_item_id')
    .eq('role', role)
    .in('source_id', freshSourceIds);
  if (error) throw error;

  // Stap 4: bouw de verzameling source_id's op die al gepubliceerd zijn.
  const alreadyPublishedIds = new Set<string>();
  for (const row of existingRows ?? []) {
    if (row.monday_item_id) {
      alreadyPublishedIds.add(row.source_id);
    }
  }

  // Stap 5: filter de gevalideerde termen: alleen degene die nog niet gepubliceerd zijn.
  const toPublish = validated.filter((term) => !alreadyPublishedIds.has(term.source_id));

  // Stap 6: rapporteer de aantallen en print de lijst die klaar staat om te publiceren.
  console.log(`Vers gescraped (nog open) voor rol "${role}": ${freshTerms.length}`);
  console.log(`Gevalideerd: ${validated.length}, geflagd: ${flagged.length}`);
  console.log(`Al gepubliceerd naar Monday (monday_item_id gezet): ${alreadyPublishedIds.size}`);
  console.log(`Nog te publiceren: ${toPublish.length}`);
  console.log('');
  console.log(JSON.stringify(toPublish, null, 2));
}

main();
