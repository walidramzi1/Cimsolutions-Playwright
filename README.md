# Cimsolutions-Playwright

Testautomatisering rond een scraper die aanvragen (termen + ID's) ophaalt van de
Cimsolutions-partnersite, per rol waarvoor een aanvraag opgezet moet worden. Dit vervangt een
handmatig proces: aanvragen worden nu automatisch opgehaald, gevalideerd en klaargezet voor
publicatie op Monday.com in plaats van met de hand samengesteld.

## Pijplijn

```
Playwright scraper (partnersite, per rol)
        │  term + Dynamics-GUID + rol + metadata
        ▼
Supabase (Postgres) — upsert op source_id + role
        │
        ▼
term-validator — vormcontrole + deadline-check, splitst in validated/flagged
        │
        ▼
monday-publish — alleen handmatig aangeroepen, nooit automatisch
        │
        ▼
Item op het Monday-board van de betreffende rol
```

1. **Scrapen**: `features/scraper-run.feature` doorloopt per rol alle zoektermen uit
   `src/config/role-search-terms.json`, filtert de gedeelde Opportunities-lijst op de
   `Functienaam`-kolom, en schrijft het resultaat weg naar `scraped-output/<rol>.json` (plus
   een `<rol>.summary.json` met aantallen per zoekterm, voor diagnose).
2. **Dedupliceren/wegschrijven**: `scripts/pipeline-run.ts <rol>` valideert en upsert't de
   scraper-output naar Supabase (`scraped_terms`), op basis van `source_id` + `role`.
3. **Valideren**: `src/lib/validate-terms.ts` controleert vorm (lege/afwijkende termen,
   source_id-formaat, rol-consistentie) én of de deadline nog niet verstreken is. Geflagde
   items komen ook in `scraped-output/<rol>.flagged.json` terecht, nooit stilzwijgend
   doorgelaten.
4. **Publiceren**: alleen via de `monday-publish`-skill, altijd expliciet aangeroepen. Zie
   "Publiceren naar Monday" hieronder.

## Lokaal opzetten

1. `npm install`
2. Kopieer `.env.example` naar `.env` en vul in:
   - `CIM_PARTNER_USERNAME` / `CIM_PARTNER_PASSWORD` — login partnersite
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — server-side only, nooit in client-code
   - `MONDAY_API_TOKEN`
3. Eerste keer inloggen op de partnersite (2FA per e-mail, dus niet te automatiseren bij een
   eerste run):
   ```
   npm run login:setup
   ```
   Dit opent een headed browser op de loginpagina. Log handmatig in (gebruikersnaam,
   wachtwoord, 2FA-code uit e-mail), druk daarna op Enter in de terminal. De sessie wordt
   opgeslagen in `storageState.json` (lokaal, niet gecommit) en hergebruikt door latere runs.
   Bij een verlopen sessie probeert `ensureLoggedIn` eerst zelf stil opnieuw in te loggen via
   Entra-SSO voordat dit script opnieuw nodig is — zie
   [docs/adr/0003-entra-sso-twee-sessies.md](docs/adr/0003-entra-sso-twee-sessies.md).

## Testen zijn Gherkin-scenario's (playwright-bdd)

Alle drie testsuites staan als `.feature`-bestanden in `features/`, met de bijbehorende
step-definities in `features/steps/`:

- `features/scraper-run.feature` — scrapet de live partnersite, per rol uit de
  Voorbeelden-tabel.
- `features/term-validator.feature` — pure validatielogica, geen externe afhankelijkheden.
- `features/upsert-terms.feature` — schrijft weg naar een live Supabase-tabel.

`npm test` (en `npm run scrape`) genereren eerst automatisch echte Playwright-testbestanden
uit die feature-/step-bestanden in `.features-gen/` (niet gecommit, gegenereerde output — zie
[docs/adr/0006](docs/adr/0006-playwright-bdd-alsnog-ingevoerd.md)) via de `pretest`/`prescrape`
npm-scripts. Los draaien kan ook: `npm run bddgen` gevolgd door `npx playwright test <filter>`.

## Een scraper-run starten

Voor een specifieke rol (rollen + hun zoektermen staan in `src/config/role-search-terms.json`,
en de rolnaam moet ook in de Voorbeelden-tabel van `features/scraper-run.feature` staan — zie
"Een nieuwe rol toevoegen" hieronder):

```
npm run scrape
```

Dit draait alle rollen uit de Voorbeelden-tabel. Filter op een specifieke rol met Playwright's
eigen `-g`:

```
npx bddgen && npx playwright test scraper-run -g "Tester"
```

Output komt in `scraped-output/<rol>.json` (term-ID-paren) en
`scraped-output/<rol>.summary.json` (aantallen per zoekterm, rijen gezien, nieuwe matches).

Daarna dedupliceren/valideren en wegschrijven naar Supabase:

```
npx tsx scripts/pipeline-run.ts Tester
```

## Publiceren naar Monday

Publicatie is **nooit automatisch**. `scripts/monday-publish-prepare.ts <rol>` bepaalt welke
gevalideerde aanvragen nog niet gepubliceerd zijn (`monday_item_id` nog leeg in Supabase); de
daadwerkelijke publicatie gebeurt via de `monday-publish`-skill, die bewust
`disable-model-invocation: true` heeft en alleen door een mens expliciet wordt aangeroepen. Zie
[.claude/skills/monday-publish/SKILL.md](.claude/skills/monday-publish/SKILL.md) voor de
volledige kolom-mapping en stappen.

## Een nieuwe rol toevoegen

Vereist geen codewijziging, wel drie config-/data-plekken:

1. Voeg de rol + zoektermen toe aan `src/config/role-search-terms.json`.
2. Voeg het board-ID en de groep-ID toe aan `src/config/role-monday-boards.json`, na
   bevestiging van de klant/board-eigenaar (zie
   [docs/adr/0004-eigen-monday-board-per-rol.md](docs/adr/0004-eigen-monday-board-per-rol.md)).
3. Voeg de rolnaam toe als extra regel in de Voorbeelden-tabel van
   `features/scraper-run.feature`. Gherkin kan geen scenario's genereren vanuit een extern
   JSON-bestand tijdens het parsen, dus dit ene punt is een uitzondering op "geen
   codewijziging" — zie [docs/adr/0006](docs/adr/0006-playwright-bdd-alsnog-ingevoerd.md).

De kolom-mapping (welke Monday-kolom bij welk brongegeven hoort) is voorlopig aangenomen
identiek over boards heen; bevestig dat expliciet zodra een tweede rol wordt aangesloten.

## Architectuurbeslissingen

Niet-voor-de-hand-liggende keuzes staan als ADR in [docs/adr/](docs/adr/):

- [0001 — Supabase boven MongoDB](docs/adr/0001-supabase-boven-mongodb.md)
- [0002 — source_id is de Dynamics-GUID, niet het klant-referentienummer](docs/adr/0002-source-id-dynamics-guid.md)
- [0003 — Entra-SSO-ontdekking en de twee-sessies-aanpak](docs/adr/0003-entra-sso-twee-sessies.md)
- [0004 — Elke rol heeft een eigen Monday-board](docs/adr/0004-eigen-monday-board-per-rol.md)
- [0005 — Geen aparte BDD/Gherkin-laag](docs/adr/0005-geen-bdd-laag.md) (herzien door 0006)
- [0006 — playwright-bdd alsnog ingevoerd](docs/adr/0006-playwright-bdd-alsnog-ingevoerd.md)

## Tests in CI

`.github/workflows/ci.yml` draait bij elke push/PR: lint (`npm run lint`), typecheck
(`npm run typecheck`), `npm run bddgen`, en daarna alleen `features/term-validator.feature`.
Dat laatste is de enige testset zonder externe afhankelijkheid (geen live site, geen
Supabase) en dus veilig om zonder secrets te draaien.

`features/scraper-run.feature` (live partnersite + ingelogde sessie) en
`features/upsert-terms.feature` (live Supabase) draaien bewust **niet** in CI en blijven
lokaal/handmatig. Een fixture-opname van de site (bijv. Playwright's request-recording) om dit
alsnog gemockt in CI te draaien is nog niet gebouwd — een reële vervolgstap zodra er tijd voor
is, maar buiten scope van deze opschoning.

## Open punten

- **Mailbox-toegang voor 2FA bij volledig onbemande runs**: als zowel de app-sessie als de
  Entra-SSO-sessie verlopen zijn, is er geen geautomatiseerde manier om bij de e-mail-2FA-code
  te komen. Opties: IMAP met app-wachtwoord, of de Gmail API met OAuth. Welke mailbox de code
  ontvangt en welke toegangsmethode, staat nog niet vast. Zie
  [docs/adr/0003-entra-sso-twee-sessies.md](docs/adr/0003-entra-sso-twee-sessies.md).
- **Geplande, onbemande runs**: nog niet gebouwd. Conflicteert met de afspraak dat
  `monday-publish` nooit zonder mens-in-de-loop draait. Ontwerprichting: in plaats van
  rechtstreeks te publiceren, zet een onbemande run gevalideerde aanvragen op een
  "flagged voor publicatie"-status (bijv. een `flagged_for_publication`-kolom op
  `scraped_terms`, gezet door `pipeline-run` in plaats van door `monday-publish` zelf). Een
  mens bekijkt en publiceert die wachtrij periodiek zelf, in plaats van dat de pijplijn
  automatisch doorpubliceert. Dit is alleen een ontwerprichting, nog niet geïmplementeerd, en
  hangt bovendien af van het mailbox-vraagstuk hierboven.
