create table if not exists scraped_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null,
  source_id text not null,
  role text not null,
  source_url text,
  scraped_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, role)
);

create index if not exists scraped_terms_role_idx on scraped_terms (role);
