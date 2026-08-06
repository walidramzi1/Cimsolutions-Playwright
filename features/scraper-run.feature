# language: nl
Functionaliteit: Scraper-run (Opportunities)
  Als testautomatiseringsengineer wil ik per rol alle openstaande aanvragen ophalen van de
  gedeelde Opportunities-lijst, zodat term-validator en monday-publish daarna verder kunnen
  met een vaste, gededupliceerde set term-ID-paren.

  Abstract Scenario: Scrapet alle Opportunities die matchen op de zoektermen voor rol "<rol>"
    Gegeven een ingelogde sessie op de partnersite
    Als de Opportunities-lijst gescraped wordt voor rol "<rol>"
    Dan bevat de scraper-output voor rol "<rol>" alleen unieke aanvragen, gededupliceerd op source_id
    En bevat de samenvatting voor rol "<rol>" één regel per zoekterm

    Voorbeelden:
      | rol    |
      | Tester |
