# 5. Geen aparte BDD/Gherkin-laag (playwright-bdd)

## Status

Herzien door [0006](0006-playwright-bdd-alsnog-ingevoerd.md): playwright-bdd is alsnog
ingevoerd. Dit document blijft staan als de oorspronkelijke afweging; zie 0006 voor waarom die
afweging is losgelaten.

## Context

De wens is dat testnamen en -structuur voor een niet-Playwright-lezer (bijvoorbeeld de
business analist) te volgen zijn. Twee routes zijn overwogen: een losse Gherkin-toolchain
(`.feature`-bestanden + `playwright-bdd`), of leesbare Playwright-tests met een goede Page
Object-laag en expliciete Given/When/Then-structuur in de test zelf.

## Beslissing

Geen aparte BDD-laag. In plaats daarvan: de Page Object
([opportunities-list.page.ts](../../src/pages/opportunities-list.page.ts)) verbergt de ruwe
selectors en eigenaardigheden, testnamen beschrijven het scenario in plain-taal Nederlands
(bijv. "scrapet alle Opportunities die matchen op een van de zoektermen voor rol X"), en elke
test heeft expliciete Arrange/Act/Assert-commentaarblokken.

## Rationale

- Omvang: één gescrapete module (Opportunities), één Page Object, drie testbestanden. Een
  Gherkin-toolchain (feature-parser, step-definitie-glue, codegen) voegt een aparte
  build-/onderhoudslaag toe die voor deze omvang niet in verhouding staat tot de winst.
- De business analist leest deze tests niet zelf in de repo; die communicatie loopt via
  gesprek/rapportage (zie CLAUDE.md, rol-sectie), niet via het reviewen van `.feature`-bestanden
  in git. Het argument "niet-technische stakeholders lezen de scenario's direct" — de
  belangrijkste reden om wél voor Gherkin te kiezen — gaat hier dus niet op.
- Step-definities moeten in sync blijven met de Gherkin-tekst; dat is een tweede plek waar
  dezelfde intentie onderhouden moet worden, wat bij een kleine testsuite meer overhead dan
  waarde oplevert.
- Playwright-tests met een Page Object-laag geven al Given/When/Then-achtige leesbaarheid
  zonder de indirectie van een aparte parser/toolchain.

## Wanneer heroverwegen

Als het aantal gescrapete modules/rollen sterk groeit, als niet-technische teamleden zelf
scenario's in de repo gaan schrijven of reviewen, of als er een expliciete wens komt om
scenario's te delen met een tool buiten de codebase (bijv. Cucumber-rapportage naar een
niet-technisch publiek), is dit een reden om playwright-bdd alsnog te introduceren.
