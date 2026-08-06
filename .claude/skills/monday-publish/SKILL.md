---
name: monday-publish
description: Publiceer een gevalideerde aanvraag als item in Monday.com via de monday-connector. Alleen handmatig aan te roepen, nooit automatisch tijdens een gewoon gesprek.
disable-model-invocation: true
---

# Monday-publish

Publiceert één of meerdere gevalideerde term-ID-paren als item in Monday.com.

## Voorwaarden

- Alleen items uit de `validated`-lijst van `term-validator` komen in aanmerking.
- Roep deze skill nooit automatisch aan, ook niet als de rest van de pijplijn succesvol is
  afgerond. Alleen ik roep deze expliciet aan.

## Board-structuur (bevestigd)

Elke rol heeft een eigen board in Monday, geen gedeeld board met rol-kolom. `board_id` en
`group_id` per rol staan in `src/config/role-monday-boards.json`, niet hardcoded in deze
skill — een nieuwe rol toevoegen is dus een config-wijziging, geen SKILL.md-wijziging. Staat
een rol nog niet in dat bestand, dan is het board-ID nog niet bevestigd: eerst navragen en pas
dan een entry toevoegen.

Voor de rol Tester: board-ID `5101220868` ("Duplicaat van 🚀 FoxAi - Walid", workspace "DevFox
| AM | Assignments"), groep-ID `nieuwe_groep58506` ("Open assignments"). Vervangt het eerdere
board `5093766800` (identieke kolom-ID's en groepen, dus de kolom-mapping hieronder blijft
geldig). De kolom-mapping hieronder is de aanname voor het gedeelde board-template; bevestig
per nieuwe rol of die mapping ook op dat board klopt voordat je publiceert.

Relevante kolommen op het Tester-board (zie `get_board_info` voor de volledige lijst):
`name` (Naam/item-titel), `tekst` (Opdrachtnummer), `link` (Url Opdracht), `date` (Deadline),
`project_status` (Status). Geen aparte rol-kolom nodig, het board zelf is al rol-specifiek.

## Stappen

1. Draai `npx tsx scripts/monday-publish-prepare.ts <rol>` om te bepalen welke aanvragen in
   aanmerking komen: leest de meest recente `scraped-output/<rol>.json` (aantoonbaar nog open),
   valideert via `term-validator` (inclusief de deadline-check), en sluit aanvragen uit die al
   een `monday_item_id` hebben in Supabase (dus al eerder gepubliceerd, voorkomt duplicaten op
   het board).
2. Bevestig met mij de resulterende lijst voordat er daadwerkelijk iets aangemaakt wordt.
3. Maak de items aan via `create_items` (batch, max 20 per call) in het board van de
   betreffende rol, in de groep "Open assignments", met de kolom-mapping hieronder.
4. Werk direct daarna `monday_item_id` bij in Supabase voor elk zojuist aangemaakt item
   (`source_id` + `role`), zodat een volgende run dezelfde aanvraag niet nogmaals publiceert.
5. **Altijd, voor elk gepubliceerd item**: haal in één paginabezoek zowel de volledige,
   ongewijzigde opdrachtomschrijving als de Locatie op van de detailpagina via
   `fetchOpdrachtDetails` (`src/lib/fetch-opdrachtomschrijving.ts`). Plaats de omschrijving als
   comment op het zojuist aangemaakte item via `create_update`, en zet de Locatie in kolom
   `tekst__1`. Dit is geen losse keuze maar een vaste stap, zodat de gebruiker per aanvraag kan
   beoordelen of hij matcht op de eisen en wensen. **Echt alles, geen subset**: niet knippen op
   basis van kopjes zoals "Opdrachtomschrijving" of "Competenties" — verschillende aanvragen
   hebben verschillende secties (soms begint het al bij "Aanleiding en context" vóór
   Opdrachtomschrijving, soms eindigt het pas na Gunningscriteria/Interview, soms juist meteen
   na Competenties). De betrouwbare bron is de container `.opportunity-description` op de
   detailpagina — die bevat altijd exact de volledige, door de klant aangeleverde tekst, en
   levert al kant-en-klare HTML (gebruik `innerHTML`, geen tekst-extractie/marker-slicing meer).
   Locatie komt uit `[data-logical-name="cim_worklocation"]` (label "Hoofdstandplaats"); als de
   brontekst zelf al rommelig geformatteerd is (bijv. straat en postcode zonder spatie), dat
   ongewijzigd overnemen, niet zelf proberen op te schonen of te gokken naar de juiste opmaak.
6. Rapporteer na afloop welke items zijn aangemaakt, inclusief Monday-item-ID's, zodat dit
   traceerbaar is.

## Kolom-mapping (bevestigd, batch van 10 items op 2026-08-05)

- Itemnaam: `"{Opdrachtgever} - {Functienaam}"` (bijv. "Provincie Noord-Brabant -
  Testcoördinator").
- `tekst` (Opdrachtnummer) = klant-referentienummer (`cim_customerreferencenumber` op de
  bronsite, kolom "Referentien..." in de lijst).
- `tekst2` (Mantel/Broker) = altijd `"CimSolutions"` voor deze bron, geen scrape nodig.
- `link` (Url Opdracht) = `source_url`, als `{"url": "...", "text": "Opportunity"}`.
- `date` (Deadline) = `cim_publishenddate` van de bronsite, als `{"date": "YYYY-MM-DD"}`.
- `project_status` (Status) = `"0 - Not started"` voor nieuw gevonden aanvragen.
- `text_mm0d5968` (Uren per week) = `cim_hoursperweek`.
- `datum4__1` (Publicatie datum) = datum van de scraper-run (vandaag).
- `color_mkrhh1yn` (Analyse status) = altijd `"Feedback verwerken"`, matcht alle bestaande
  items.
- `tekst__1` (Locatie) = Hoofdstandplaats van de detailpagina, opgehaald samen met de
  opdrachtomschrijving (zie stap 5 hieronder). Niet beschikbaar op de lijstpagina zelf, dus
  vereist een detailpagina-bezoek.
- `tekst7` (Uurtarief): bevestigd geen bronveld voor op de detailpagina (gezocht op
  "Uurtarief"/"Tarief", beide afwezig). Blijft blanco, niet verzinnen — lijkt een waarde die de
  recruiter zelf later invult na een aanbieding, niet iets dat CimSolutions publiceert.

`scraper-run` neemt `referentienummer`, `opdrachtgever`, `deadline` en `uren_per_week`
inmiddels standaard mee (uitgebreid op 2026-08-05), dus deze mapping werkt nu voor de volledige
scrape, niet alleen voor handmatig aangevulde voorbeelden.

## Dedup richting Monday (bevestigd)

Kolom `monday_item_id` op `scraped_terms` (Supabase) houdt bij welke aanvraag al gepubliceerd
is. `monday-publish-prepare.ts` filtert hier automatisch op. Nooit een item publiceren voor een
`source_id` + `role` die al een `monday_item_id` heeft, ook niet als de gebruiker "de nieuwe"
vraagt zonder verder specificatie — dat is precies wat dit mechanisme voorkomt.

## Nog te bevestigen

Board-ID's voor rollen anders dan Tester.

## Wat deze skill niet doet

Valideert niets opnieuw en scraped niets. Puur de laatste, bewuste publicatiestap.
