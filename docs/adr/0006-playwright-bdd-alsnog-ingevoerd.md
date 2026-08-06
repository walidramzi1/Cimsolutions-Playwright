# 6. playwright-bdd alsnog ingevoerd

## Status

Geaccepteerd. Draait [0005](0005-geen-bdd-laag.md) om.

## Context

[0005](0005-geen-bdd-laag.md) koos bewust tegen een Gherkin-toolchain, met als kernargument
dat de business analist toch geen `.feature`-bestanden in de repo leest. Dat argument woog de
leesbaarheids-winst voor niet-technische stakeholders af tegen de onderhoudskosten van een
aparte toolchain, en kwam uit op "niet doen".

Die afweging miste een andere invalshoek: de auteur van dit project komt uit Cypress met
`cypress-cucumber-preprocessor`, en is dat Given/When/Then-patroon van feature-bestanden +
step-definities al gewend als manier om zelf tests te lezen en te schrijven, los van of een
business analist ze ooit inziet. Leesbaarheid voor de eigen schrijver/onderhouder van de
tests is een net zo geldig argument voor BDD als leesbaarheid voor een externe
stakeholder, en dat argument was in 0005 niet meegewogen.

## Beslissing

`playwright-bdd` (v9) is toegevoegd. Alle drie testsuites zijn herschreven als
`.feature`-bestanden (Gherkin, `language: nl`) met step-definities in `features/steps/`:

- `features/scraper-run.feature` — Abstract Scenario met een Voorbeelden-tabel per rol.
- `features/term-validator.feature` — Achtergrond + los scenario per validatieregel.
- `features/upsert-terms.feature` — Achtergrond + twee scenario's tegen een live
  Supabase-tabel.

`playwright.config.ts` gebruikt `defineBddConfig` om `.features-gen/` te genereren (niet
gecommit) uit deze feature- en step-bestanden; `npm run bddgen` (of de `pretest`/`prescrape`
lifecycle-scripts) draait die generatiestap vóór `playwright test`.

## Rationale

- Het patroon feature-bestand + step-definitie is de auteur al vertrouwd vanuit Cypress; dat
  verlaagt de instapdrempel voor Playwright zelf, wat nu net het punt is van deze
  professionaliseringsslag.
- Elke stap-tekst is een losse, herbruikbare regel Nederlands (`Given`/`When`/`Then`), wat een
  scenario ook zonder de onderliggende TypeScript te lezen begrijpelijk maakt — niet alleen
  voor een hypothetische business analist, maar voor iedereen die met de tests werkt.
- De overhead die 0005 noemde (step-definities die in sync moeten blijven met de Gherkin-tekst)
  blijft bestaan, maar weegt voor deze gebruiker minder zwaar dan de vertrouwdheid met het
  patroon zelf.

## Gevolgen

- `tests/*.spec.ts` is verwijderd; alle testlogica staat nu in `features/*.feature` +
  `features/steps/*.steps.ts`.
- Elke step-functie die een `{string}`/`{int}` uit de featuretekst opvangt, moet van
  playwright-bdd een fixtures-object als eerste argument hebben (`{}` als er geen fixture
  nodig is, `{ page }` als wel). Dit is een vaste conventie van de library, niet een keuze van
  dit project; `no-empty-pattern` staat daarom uit voor `features/steps/**/*.ts` in
  `eslint.config.js`.
- `features/scraper-run.feature` gebruikt een Voorbeelden-tabel met rollen (nu: alleen
  "Tester"). Een nieuwe rol toevoegen vereist dus, naast `role-search-terms.json` en
  `role-monday-boards.json`, ook één regel in die tabel — Gherkin kan geen scenario's
  genereren vanuit een extern JSON-bestand tijdens het parsen. Dit is de enige plek waar de
  "geen codewijziging voor een nieuwe rol"-belofte een kleine uitzondering kent.
- `.features-gen/` is gegenereerde output (net als `dist/`) en staat in `.gitignore`; `npm
test`/`npm run scrape` regenereren het automatisch via `pretest`/`prescrape`.
