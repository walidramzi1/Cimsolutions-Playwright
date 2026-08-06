// Eén gescraped term-ID-paar: de basiseenheid die door de hele pijplijn heen stroomt
// (scraper-run → dedup/upsert → term-validator → monday-publish).
export interface ScrapedTerm {
  term: string;
  source_id: string;
  role: string;
  source_url: string;
  scraped_at: string;
  referentienummer: string | null;
  opdrachtgever: string | null;
  deadline: string | null;
  uren_per_week: string | null;
}
