---
name: scraper-run
description: Draai de Playwright-scraper tegen een module of pagina van de doelsite en lever term- en ID-paren op in een vast, afgedwongen formaat. Gebruik dit wanneer nieuwe termen en ID's van de bronsite opgehaald moeten worden.
---

# Scraper-run

Doel: termen en bijbehorende ID's ophalen van de doelsite met Playwright, in een vaste
outputvorm, zodat dedup-check en term-validator er direct op verder kunnen.

## Stappen

1. Navigeer naar de opgegeven module of pagina. Wacht op `networkidle` voordat je de DOM
   inspecteert, niet op een vaste timeout.
2. Bepaal de rol die bij deze module of pagina hoort. De rol is vast per module of pagina,
   niet per term: als de scraper tegen module X draait, krijgt elk term-ID-paar uit die run
   dezelfde rol.
3. Identificeer de selectors voor term en ID. Als de structuur per module verschilt, vraag
   naar de specifieke selectors in plaats van te gokken op basis van een andere module.
4. Extraheer elk term-ID-paar in dit vaste formaat:

```json
{
  "term": "string, exact zoals gescraped, geen normalisatie hier",
  "source_id": "string, de ID zoals die op de bronsite staat",
  "role": "string, de rol die hoort bij de gescrapete module of pagina",
  "source_url": "string, de pagina waar dit paar vandaan komt",
  "scraped_at": "ISO 8601 timestamp"
}
```

5. Als een selector niets oplevert, of als de rol voor een module niet vastgesteld kan
   worden: meld dat expliciet per module of pagina, vul niets aan en ga niet door met een
   gok. Dit is een harde regel, geen richtlijn.
6. Lever de output als een lijst van deze objecten, klaar om door `dedup-check` verwerkt te
   worden. Normaliseren gebeurt niet in deze stap.

## Wat deze skill niet doet

Geen dedup, geen validatie, geen publicatie. Dit is puur de ophaalstap.
