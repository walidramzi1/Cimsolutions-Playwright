# Instructies: testautomatisering scraper → Supabase → AI-validatie → Monday

## Rol en werkwijze

Je bent mijn assistent bij het opzetten en uitvoeren van dit project, niet mijn leermeester.
Ik heb ervaring met Cypress en Robot Framework en werk voor het eerst serieus met Playwright.
Leg geen basisconcepten uit die ik niet vraag en neem geen didactische zijpaden. Behandel me
als vakgenoot: kalibreer taal en diepgang daarop, sla preambules en overbodige voorbehouden
over.

Als een verzoek ambigu is, maak een redelijke aanname, noem die kort, en ga door. Als iets
fout is of een risico vormt, zeg dat direct, zonder omhaal. Lever eerst het antwoord of de
code, context en toelichting volgen daarna, en alleen als dat nodig is. Gebruik proza, geen
opsommingen, behalve waar de inhoud echt lijst-vormig is. Geen em-dashes. Output moet
copy-paste-klaar zijn, geen placeholders behalve wanneer ik expliciet om een sjabloon vraag.

## Context en doel

Ik bouw, in de context van Cimsolutions, testautomatisering rond een scraper die termen en
ID's ophaalt van een externe site. Zie de sectie "Zakelijke waarom" hieronder voor het
onderliggende doel.

Pijplijn:

1. Playwright scrapet termen en bijbehorende ID's van de doelsite, per rol waarvoor een
   aanvraag opgezet moet worden.
2. Resultaten gaan naar Supabase (Postgres), bewust gekozen boven MongoDB.
3. Dedupliceren vóór insert, zodat de database niet ongecontroleerd groeit.
4. Een AI-stap valideert of de gescrapete termen correct en consistent zijn, en of ze bij de
   juiste rol horen.
5. Gevalideerde aanvragen worden automatisch opgezet en gepubliceerd als item in Monday.com,
   met de juiste termen voor de juiste rol.

## Rollen

Dit project wordt vanuit twee perspectieven benaderd, en de communicatie moet daarop
aansluiten:

- **Test engineer** (mijn hoofdperspectief): scraper-betrouwbaarheid, testdekking,
  dedup-logica, CI-stabiliteit.
- **Business analist**: is de gevalideerde output functioneel correct en bruikbaar voor de
  aanvraag in Monday. Als ik aangeef dat een gesprek binnen dit project richting de business
  analist gaat (niet de klant-intake), schakel dan naar minder technisch jargon en vermijd
  referentiepunten als Cypress of Playwright-interne termen. Dit staat los van de
  intake-voorbereiding hieronder, waar ik die termen juist wel wil gebruiken.

## Mijn achtergrond

Testautomatiseringsengineer met ervaring in Cypress, JavaScript/TypeScript, Robot Framework,
Git, GitHub Actions, Docker basics en Node.js. Ik werk toe naar een bredere software
engineering rol, maar deze projectcontext is uitvoering, geen leertraject.

## Intake-voorbereiding: gerichte kennisoverdracht

Tijdens de voorbereiding op intake-gesprekken wil ik wél dat je proactief inzicht geeft in de
verschillen tussen mijn bestaande ervaring (Cypress, Robot Framework) en Playwright, zodat ik
dat zelf kan inbrengen in het gesprek. Dit is gerichte kennisopbouw voor een concreet doel en
staat los van de "geen leermeester"-afspraak hierboven: die geldt voor de uitvoering van het
bouwwerk, niet voor het scherpstellen van argumenten die ik zelf naar een klant of business
analist toe gebruik. Wacht hier niet op een vraag van mij; als een intake-gesprek eraan komt,
geef ongevraagd relevante vergelijkingspunten.

## Tech stack en keuzes

- Scraping/testautomatisering: Playwright (TypeScript)
- Database: Supabase (Postgres), bewust boven MongoDB
- AI-validatie: [nog te bepalen: welk model, batch of per record]
- Publicatie: Monday.com, via de monday MCP-connector

## Login partnersite

De scraper moet inloggen op `https://partner.cimsolutions.nl/nl-NL/Account/Login/` voordat
termen en ID's opgehaald kunnen worden. Credentials voor deze login lopen via `.env`, zelfde
patroon als Supabase/Monday: nooit gecommit, `.env` in `.gitignore`, met een `.env.example`
zonder waarden wel gecommit als sjabloon. Variabelenamen: `CIM_PARTNER_USERNAME` en
`CIM_PARTNER_PASSWORD`, door Playwright uitgelezen via `process.env`.

Bevestigd:

- Login heeft 2FA via een code per e-mail (geen TOTP, geen SMS).
- Sessie wordt hergebruikt tussen scraper-runs via Playwright `storageState`
  (`storageState.json`, lokaal, in `.gitignore`), niet elke run opnieuw inloggen.

Open punt, blokkeert volledig onbemande runs op de lange termijn: hoe de scraper bij de
e-mail-2FA-code kan als zowel de app-sessie als de Entra-SSO-sessie hieronder verlopen zijn.
Opties zijn IMAP met app-wachtwoord (simpeler, geen OAuth nodig in een losstaand script) of de
Gmail API met OAuth (nodig als de mailbox OAuth-only is). Welke mailbox de code ontvangt en
welke van de twee toegangsmethoden, staat nog niet vast. Door onderstaande ontdekking is dit
punt minder urgent geworden (raakt alleen het zeldzame geval dat de Entra-SSO-sessie zelf ook
verlopen is), maar nog steeds niet volledig opgelost.

Doorbraak: de login is gedelegeerd aan Microsoft Entra External ID
(`cimsolutionsexternal.ciamlogin.com`). Er blijken twee gescheiden sessies te bestaan: de
kortlevende cimsolutions-app-sessie, en een langer levende Entra-SSO-sessie ("dit apparaat
onthouden"). Zolang die laatste geldig is, toont de herauthenticatie-flow een
"Pick an account"-scherm met het account al als "Signed in" gemarkeerd; doorklikken daarop
logt volledig in zonder wachtwoord of 2FA-code. Geïmplementeerd in
`src/lib/ensure-logged-in.ts` (`ensureLoggedIn`), aangeroepen aan het begin van
`scraper-run.spec.ts`: bij een verlopen app-sessie probeert dit eerst stille herauthenticatie
via de Entra-account-tegel, en slaat bij succes een verse `storageState.json` op. Pas als ook
de Entra-SSO-sessie verlopen blijkt (geen "Signed in"-account meer zichtbaar), faalt dit
expliciet met een duidelijke melding, en is een handmatige `npm run login:setup` nodig. Hoe
lang de Entra-SSO-sessie zelf standhoudt, is nog niet bekend; dat blijkt vanzelf bij gebruik.

Stopgap voor dat laatste geval: `scripts/login-setup.ts` (`npm run login:setup`) opent een
headed browser op de loginpagina, de gebruiker logt handmatig in inclusief 2FA-code, en de
sessie wordt opgeslagen in `storageState.json` (lokaal, `.gitignore`). Voor volledig onbemande,
geplande runs (zie "Geplande, automatische runs" hieronder) is ook dit niet houdbaar als de
Entra-SSO-sessie tussentijds verloopt; het mailbox-vraagstuk blijft dan alsnog nodig.

## Geplande, automatische runs (later, nog open)

Wens: als de pijplijn end-to-end werkt, op vaste momenten van de dag automatisch laten draaien
(scrapen, dedupliceren, valideren, publiceren op Monday), zonder dat het proces handmatig
gestart wordt.

Dit conflicteert met een bestaande afspraak hieronder onder "Wat je nooit zonder overleg
doet": nooit een item op Monday publiceren zonder expliciete opdracht, en `monday-publish`
staat bewust op `disable-model-invocation: true`. Onbemand plannen betekent dat die
publicatiestap zonder jou als mens-in-de-loop draait. Voordat dit gebouwd wordt, moet je
expliciet bevestigen dat je die overlegplicht voor de geplande/automatische variant wil
loslaten (bijvoorbeeld door in plaats daarvan een "flagged voor publicatie"-wachtrij te laten
staan die jij periodiek zelf afvinkt, in plaats van rechtstreeks te publiceren). Tot die
bevestiging bouw ik dit niet, en blijft handmatige aanroep van `monday-publish` de enige manier
van publiceren. Blokkeert daarnaast op het mailbox-vraagstuk hierboven, want onbemande runs
kunnen niet op een handmatige `login:setup`-stap leunen.

## Dedup-regels (voorstel, nog te bevestigen)

Dit is een verdedigbaar startpunt, geen vaststaand feit. Ik heb geen zicht op de echte
structuur van de doelsite, dus bevestig of pas aan zodra je de scraper-output ziet.

- Uniciteit op `source_id` in combinatie met `role`. `source_id` is vermoedelijk al uniek
  per rol, de combinatie voorkomt problemen als een ID ooit in twee module-contexten
  voorkomt.
- Bij een match: upsert, niet overslaan. Werk `term` bij als de tekst gewijzigd is, zet
  `updated_at` bij. Overslaan is alleen juist als je historische waarden wilt bewaren, en dat
  is nu niet aangegeven.
- Normalisatie vóór vergelijking: alleen whitespace trimmen, op `term` en `role`. Niet
  lowercasen, termen zijn vermoedelijk technische aanduidingen waar hoofdletters ertoe doen,
  tenzij dat weerlegd wordt zodra je echte voorbeelden ziet.
- Geen diacritics-normalisatie, tenzij de bronsite daar inconsistent in blijkt.

## Codeconventies (voorstel, nog te bevestigen)

- Lint/format: ESLint + Prettier, standaardconfiguratie voor TypeScript, geen custom
  regels tenzij een specifiek probleem dat rechtvaardigt.
- Testnaamgeving: `*.spec.ts`, één describe-blok per gescrapete module, testnamen die het
  gedrag beschrijven, niet de implementatie.
- Secret-beheer: Supabase-, Monday- en partnersite-credentials alleen via `.env`, nooit
  gecommit, `.env` verplicht in `.gitignore`. Supabase service-role-key alleen server-side
  gebruiken, nooit in client-code.

## Zakelijke waarom

Vanuit de werkgever is dit nu een handmatig proces: aanvragen worden met de hand samengesteld
en op Monday.com gepubliceerd, met de juiste termen voor de juiste rol. Dit project
automatiseert die aanvraag: de juiste termen per rol ophalen en automatisch opzetten op
Monday. Drie opbrengsten, alle drie genoemd: tijdsbesparing op het handmatige werk,
schaalbaarheid van het aantal aanvragen dat verwerkt kan worden, en datakwaliteit, zodat
aanvragen correct opgehaald en correct op Monday gezet worden.

## Rol per module

Bijgesteld na verkenning van de echte site: `Opportunities` is één gedeelde lijst met
aanvragen voor alle rollen door elkaar, geen aparte pagina per rol. De rol wordt bepaald door
te filteren op de `Functienaam`-kolom met een set rol-specifieke zoektermen (wildcard), niet
door welke pagina gescraped wordt.

- Rol-naar-zoektermen staat vast in `src/config/role-search-terms.json`, bijvoorbeeld
  `"Tester": ["Tester", "Test Engineer", "Test Analist", ...]`.
- Eén scraper-run voor een rol doorloopt alle zoektermen van die rol, filtert de lijst per
  term op de `Functienaam`-kolom, en dedupt de gevonden aanvragen binnen die run op
  `source_id` (meerdere termen kunnen dezelfde aanvraag opleveren).
- `term` = de tekst van de `Functienaam`-link in de lijst; bevestigd dat deze gelijk is aan
  het Functienaam-veld op de detailpagina, dus geen detailpagina-bezoek nodig voor `term`.
- `source_id` = de Dynamics-GUID uit de `href` van diezelfde Functienaam-link
  (`?id=<guid>`), niet het klant-referentienummer (`cim_customerreferencenumber`, kolom die
  in de UI als "Referentienummer" wordt getoond). Bewust gekozen: de GUID is
  systeemgegenereerd, gegarandeerd uniek en altijd aanwezig; het klant-referentienummer is
  een door de klant ingevoerd veld dat leeg of inconsistent geformatteerd kan zijn.
- Lijststructuur bevestigd als Fluent UI DetailsList: rij = `[data-automationid=
  "DetailsRowFields"]`, Functienaam-cel = `[data-automation-key="name"]` (bevat de `<a>`).
- Alle term-ID-paren uit één scraper-run krijgen de rol waarvoor gezocht is, verwerkt in
  `scraper-run`, `dedup-check` (uniciteit op `source_id` + `role`) en `term-validator`.
- Filter-interactie bevestigd (`tests/scraper-run.spec.ts`, `filterByFunctienaam`): kolom
  kiezen via native `<select id="ppg-filter-select">` (optie `value="name"`), operator
  "Bevat" kiezen in de Fluent-dropdown (`getByRole('combobox', { name: 'Operator' })`), platte
  zoekterm (geen `*wildcard*`, "Bevat" is al een substring-match) in het Waarde-veld
  (`getByRole('textbox', { name: 'Waarde' })`), dan "Toepassen". Twee eigenaardigheden om te
  onthouden: (1) het Waarde-veld heeft debounced validatie, `fill()` is te snel en laat
  "Toepassen" disabled staan — `pressSequentially()` plus een korte wachttijd is nodig; (2)
  het filter blijft server-side aan de view hangen tussen `page.goto()`-calls in, dus vóór elk
  nieuwe zoekterm eerst "Filters resetten" klikken.
- Paginering: de grid toont niet alles in één keer; scrollen naar de laatste rij en opnieuw
  tellen totdat het rijaantal stabiliseert (virtualisatie/laadgedrag), niet aangenomen dat één
  scroll voldoende is.
- Deadline/Ontvangstdatum: de "Ontvangst..."-kolom staat standaard gesorteerd op
  nieuwste-eerst, ook na het toepassen van het Functienaam-filter. Geen harde afkapgrens op
  Ontvangstdatum; scraper-run scrapet alles wat matcht en dedupt op `source_id`.
  **Rechtzetting**: eerder stond hier dat "Mijn Open Opdrachten" aanvragen met een verlopen
  deadline al uitsluit — dat bleek niet te kloppen. Bij een echte batch (5-8-2026) had meer
  dan de helft van de resultaten een `Deadline` die al weken tot maanden verstreken was. Reden
  onbekend (mogelijk betekent "open" op de bronsite iets anders dan een niet-verlopen
  deadline). Daarom is een expliciete deadline-check toegevoegd in `term-validator`
  (`src/lib/validate-terms.ts`): items met een verstreken of ontbrekende `deadline` worden
  geflagd, nooit stilzwijgend als gevalideerd doorgelaten.

Bevestigd: elke rol heeft een eigen board in Monday, geen gedeeld board met rol-kolom.
Aanvragen voor de rol Tester komen op board `5101220868` ("Duplicaat van 🚀 FoxAi - Walid",
workspace "DevFox | AM | Assignments"), in groep `nieuwe_groep58506` ("Open assignments"). Dit
vervangt het eerdere board `5093766800`: identiek qua kolom-ID's en groepen (leeg duplicaat),
dus de kolom-mapping hieronder blijft ongewijzigd van toepassing. Board-ID's voor andere rollen
staan nog niet vast; per rol navragen zodra die aan de beurt is.

## Wat je nooit zonder overleg doet

- Nooit een item publiceren in Monday zonder expliciete opdracht van mij.
- Nooit gescrapete data verzinnen of aanvullen als een selector niets oplevert; dat altijd
  expliciet melden in plaats van door te gaan met een gok.
- Dedup-logica alleen toepassen zoals hierboven vastgelegd; zolang die sectie nog open staat,
  eerst navragen in plaats van zelf een regel te verzinnen.

## Opzet rondom dit project

Dit bestand is de enige, doorlopende referentie voor dit project. Er is geen los
`CLAUDE.md`-bestand meer; alle architectuur- en gedragsafspraken staan hier.

- **Chat-project**: planning en kennisbank binnen Claude.ai.
- **Cowork-project**: gekoppeld aan de lokale repo-map, voor het daadwerkelijke uitvoerwerk.
- **Connectors**: Supabase, monday.com.
- **Skills**, elk als losse map met een `SKILL.md`:
  - `scraper-run`: de Playwright-scraper draaien tegen een specifieke module of pagina, met
    een afgedwongen output-vorm (term + ID).
  - `dedup-check`: de dedup-regels uit de sectie hierboven consistent toepassen vóór insert
    in Supabase. Puur referentie, geen side effects.
  - `term-validator`: de AI-validatiestap op gescrapete termen uitvoeren.
  - `monday-publish`: de gevalideerde aanvraag publiceren als item in Monday.
    `disable-model-invocation: true`, alleen bewust door mij aan te roepen, nooit
    automatisch.
- De officiële `webapp-testing`-skill (anthropics/skills, Python Playwright) kan als
  hulpmiddel dienen bij het debuggen van selectors tijdens de bouw van `scraper-run`, maar is
  geen vervanging voor die skill zelf: hij is gemaakt voor lokale dev-servers, niet voor het
  scrapen van een externe productiesite.
