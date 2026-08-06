---
name: term-validator
description: Valideer met een AI-controlestap of gescrapete termen correct en consistent zijn voordat ze richting Monday gepubliceerd worden. Gebruik dit na dedup-check en vóór monday-publish.
---

# Term-validator

Doel: voorkomen dat kapotte of onzinnige scrape-resultaten als "gevalideerd" doorstromen naar
Monday.

## Controles

1. `term` is niet leeg en bevat geen overduidelijke scrape-artefacten (HTML-tags, foutmeldingen
   zoals "undefined" of "404", afgekapte tekst).
2. `source_id` is aanwezig en heeft een plausibel formaat vergeleken met andere ID's uit
   dezelfde module.
3. `role` is aanwezig en komt overeen met de rol die voor die module of pagina verwacht
   wordt. Een leeg of onverwacht rol-veld is een reden om te flaggen, nooit om zelf een rol
   te verzinnen of aan te vullen.
4. Lengte en vorm van `term` vallen binnen een redelijke bandbreedte voor deze bronsite; een
   uitschieter wordt gemarkeerd, niet automatisch verworpen.

## Output

Twee lijsten, `validated` en `flagged`, waarbij elk item in `flagged` een korte reden krijgt.
Nooit een item stilzwijgend laten vallen: alles wat niet valideert moet zichtbaar blijven voor
menselijke controle.

## Wat deze skill niet doet

Publiceert niets. Dat is aan `monday-publish`, en alleen na expliciete opdracht.
