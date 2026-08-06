# language: nl
Functionaliteit: Upsert-terms (Supabase)
  Als testautomatiseringsengineer wil ik dat gescrapete term-ID-paren in Supabase
  terechtkomen als upsert op source_id + role, zodat eenzelfde aanvraag nooit dubbel in de
  tabel staat en altijd de laatst bekende waarde toont.

  Achtergrond:
    Gegeven een lege staat voor de testrol "__smoke_test__" in scraped_terms

  Scenario: Een nieuw term-ID-paar wordt weggeschreven met getrimde whitespace
    Als term "  Smoke Test Term  " met source_id "SMOKE-1" wordt weggeschreven voor de testrol
    Dan bevat scraped_terms voor source_id "SMOKE-1" de term "Smoke Test Term"

  Scenario: Upsert op source_id + role werkt de term bij in plaats van te dupliceren
    Gegeven term "Oude Waarde" met source_id "SMOKE-2" is al weggeschreven voor de testrol
    Als term "Nieuwe Waarde" met source_id "SMOKE-2" wordt weggeschreven voor de testrol
    Dan staat er nog steeds precies 1 rij in scraped_terms voor source_id "SMOKE-2"
    En bevat scraped_terms voor source_id "SMOKE-2" de term "Nieuwe Waarde"
