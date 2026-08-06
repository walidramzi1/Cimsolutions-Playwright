# 4. Elke rol heeft een eigen Monday-board

## Status

Geaccepteerd

## Context

Aanvragen worden per rol gepubliceerd naar Monday.com. Twee opties: één gedeeld board met een
rol-kolom, of een apart board per rol.

## Beslissing

Elke rol heeft een eigen board, bevestigd tegen de praktijk voor de rol Tester (board-ID
`5101220868`, workspace "DevFox | AM | Assignments", groep `nieuwe_groep58506` "Open
assignments"). De mapping van rol naar `board_id`/`group_id` staat in
[role-monday-boards.json](../../src/config/role-monday-boards.json).

## Rationale

Dit is de bestaande, bevestigde structuur op de klantzijde (Cimsolutions richt boards per rol
in), niet een keuze die dit project zelf heeft gemaakt. De kolom-indeling van het Tester-board
is inmiddels tweemaal gezien (het oorspronkelijke board `5093766800` en het duplicaat
`5101220868` dat dat vervangt), met identieke kolom-ID's en groepen — dat maakt aannemelijk dat
nieuwe rol-boards dezelfde structuur volgen, maar dat wordt per nieuwe rol expliciet bevestigd
in plaats van aangenomen.

## Gevolgen

- Een nieuwe rol toevoegen aan de publicatiestap vereist een nieuwe entry in
  `role-monday-boards.json` (board-ID en groep-ID), geen codewijziging in
  `monday-publish-prepare.ts` of de `monday-publish`-skill.
- De kolom-mapping (welke Monday-kolom bij welk brongegeven hoort) staat vooralsnog als proza
  in `.claude/skills/monday-publish/SKILL.md`, met de aanname dat die mapping identiek is over
  boards heen. Zodra een tweede rol wordt aangesloten en de mapping daar afwijkt, moet die
  aanname worden losgelaten en de mapping zelf ook per rol configureerbaar worden.
