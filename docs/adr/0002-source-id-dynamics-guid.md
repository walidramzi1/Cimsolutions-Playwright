# 2. `source_id` is de Dynamics-GUID, niet het klant-referentienummer

## Status

Geaccepteerd

## Context

Elke aanvraag in de Opportunities-lijst heeft twee kandidaat-identifiers:

- De Dynamics-GUID uit de `href` van de Functienaam-link (`?id=<guid>`).
- Het klant-referentienummer (`cim_customerreferencenumber`, kolom "Referentien..." in de
  lijst-UI): een vrij tekstveld dat de klant zelf invult bij het aanmaken van de aanvraag.

Dedup en de koppeling met `monday_item_id` hangen af van welke van de twee als stabiele,
unieke sleutel dient.

## Beslissing

`source_id` is de Dynamics-GUID uit de href, opgehaald in
[opportunities-list.page.ts](../../src/pages/opportunities-list.page.ts)
(`extractTermIdPairs`). Het klant-referentienummer wordt wel meegescraped (`referentienummer`
in `ScrapedTerm`) en gepubliceerd naar Monday, maar dient niet als sleutel.

## Rationale

- De GUID is systeemgegenereerd door Dynamics en gegarandeerd uniek en aanwezig voor elke
  aanvraag.
- Het klant-referentienummer is een door de klant ingevoerd veld: het kan leeg zijn of
  inconsistent geformatteerd, en is dus niet betrouwbaar als uniciteitssleutel.

## Gevolgen

- De unique constraint in Supabase (`scraped_terms`) staat op `source_id` + `role`, niet op
  `referentienummer` + `role`.
- `referentienummer` kan `null` zijn zonder dat dit de dedup-logica breekt.
