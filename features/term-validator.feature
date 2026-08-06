# language: nl
Functionaliteit: Term-validator
  Als testautomatiseringsengineer wil ik dat elk gescraped term-ID-paar ofwel gevalideerd,
  ofwel expliciet geflagd wordt, zodat er nooit een twijfelachtige aanvraag stilzwijgend
  doorglipt naar Monday.

  Achtergrond:
    Gegeven een schone batch van drie termen voor rol "Frontend Developer"

  Scenario: Een schone batch wordt volledig gevalideerd
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan zijn er 3 termen gevalideerd
    En zijn er 0 termen geflagd

  Scenario: Een lege term wordt geflagd
    Gegeven een extra term met een lege waarde
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan is er 1 term geflagd met reden "term is leeg"

  Scenario: Een scrape-artefact in een term wordt geflagd
    Gegeven een extra term met waarde "<span>undefined</span>"
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan is er 1 term geflagd met een reden die matcht op "scrape-artefact"

  Scenario: Een afwijkende rol wordt geflagd zonder zelf aangepast te worden
    Gegeven een extra term met rol "Backend Developer"
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan is er 1 term geflagd met een reden die matcht op "komt niet overeen met verwachte rol"
    En heeft dat geflagde item nog steeds rol "Backend Developer"

  Scenario: Een afwijkend source_id-formaat binnen de batch wordt geflagd
    Gegeven een extra term met source_id "zzz-onbekend-formaat"
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan is er 1 term geflagd met een reden die matcht op "source_id-formaat"

  Scenario: Een verlopen deadline wordt geflagd
    Gegeven een extra term met deadline "1-1-2020 12:00"
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan is er 1 term geflagd met een reden die matcht op "is al verstreken"

  Scenario: Een ontbrekende deadline wordt geflagd
    Gegeven een extra term zonder deadline
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan is er 1 term geflagd met een reden die matcht op "deadline ontbreekt"

  Scenario: Elk item komt terecht in gevalideerd of geflagd, nooit in geen van beide
    Gegeven een extra term met een lege waarde
    En een extra term zonder rol
    Als de batch gevalideerd wordt voor rol "Frontend Developer"
    Dan staat elk item van de batch in gevalideerd of geflagd
