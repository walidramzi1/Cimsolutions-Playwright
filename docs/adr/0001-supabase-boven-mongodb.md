# 1. Supabase (Postgres) boven MongoDB

## Status

Geaccepteerd

## Context

De pijplijn heeft een database nodig om gescrapete term-ID-paren op te slaan, te dedupliceren
en later te koppelen aan een Monday-item-ID. De data is inherent tabelvormig: elke rij is een
aanvraag met een vaste set velden (`term`, `source_id`, `role`, `deadline`,
`referentienummer`, `opdrachtgever`, `uren_per_week`, `monday_item_id`, ...), en de
kernbewerking is een uniciteitscontrole op een samengestelde sleutel (`source_id` + `role`).

## Beslissing

Supabase (Postgres) is gekozen boven MongoDB.

## Rationale

- De data heeft een vast, voorspelbaar schema zonder geneste of sterk variabele structuren.
  Er is geen zakelijke reden om schemaloos te werken.
- Uniciteit afdwingen op een samengestelde sleutel (`source_id`, `role`) is in Postgres een
  triviale unique constraint met `ON CONFLICT ... DO UPDATE` (zie
  [upsert-terms.ts](../../src/lib/upsert-terms.ts)); in MongoDB vereist dit meer handmatige
  afdwinging.
- Supabase levert er gratis een REST/JS-client, auth en een beheerd Postgres-instance bovenop,
  zonder dat er zelf infrastructuur beheerd hoeft te worden.

## Gevolgen

- Alle schema-wijzigingen lopen via SQL-migraties in `supabase/migrations/`.
- De Supabase service-role-key wordt alleen server-side gebruikt (scripts, nooit in
  client-code), zie `.env.example`.
