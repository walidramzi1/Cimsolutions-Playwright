alter table scraped_terms
  add column if not exists referentienummer text,
  add column if not exists opdrachtgever text,
  add column if not exists deadline text,
  add column if not exists uren_per_week text;
