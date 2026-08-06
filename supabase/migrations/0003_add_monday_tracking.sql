alter table scraped_terms
  add column if not exists monday_item_id text;

create index if not exists scraped_terms_monday_item_id_idx on scraped_terms (monday_item_id);
