---
name: dedup-check
description: Pas de dedupliceringsregels toe op gescrapete term-ID-paren voordat ze in Supabase worden ingevoegd. Gebruik dit vóór elke insert-actie richting de database.
---

# Dedup-check

Referentie-skill, geen side effects. Bepaalt of een gescraped term-ID-paar een nieuwe rij,
een update, of een overslaan wordt.

## Regels (voorstel, nog te bevestigen in CLAUDE.md)

- Uniciteit wordt bepaald op `source_id` in combinatie met `role`. `source_id` alleen is
  vermoedelijk al uniek per rol, maar de combinatie voorkomt problemen als dezelfde ID ooit
  in twee module-context toch voorkomt.
- Bij een match op `source_id` + `role`: upsert. Werk `term` bij als de tekst is gewijzigd, en
  zet `updated_at` op het huidige moment. Skip alleen als expliciet is afgesproken dat
  historische waarden bewaard moeten blijven; dat is nu niet het geval.
- Normalisatie vóór vergelijking: alleen whitespace trimmen, op zowel `term` als `role`. Niet
  lowercasen, want termen zijn vermoedelijk technische aanduidingen waar hoofdletters
  betekenis kunnen hebben, tenzij dat weerlegd wordt.
- Geen diacritics-normalisatie tenzij blijkt dat de bronsite inconsistent is in
  accenttekens.

## Wanneer deze regels nog niet bevestigd zijn

Zolang CLAUDE.md dit als open of voorlopig punt markeert, gebruik deze regels dan niet
stilzwijgend als vaststaand feit. Meld expliciet dat je op het voorstel draait totdat het
bevestigd is.
