# 3. Entra-SSO-ontdekking en de twee-sessies-aanpak in `ensure-logged-in.ts`

## Status

Geaccepteerd, met een openstaand restpunt (zie "Nog niet opgelost" hieronder)

## Context

De scraper moet ingelogd zijn op `partner.cimsolutions.nl` voordat hij kan scrapen. Login
verloopt via 2FA met een code per e-mail (geen TOTP, geen SMS), wat volledig onbemande runs
in de weg zit als er elke keer opnieuw ingelogd zou moeten worden.

Bij onderzoek naar de login-flow bleek dat de login gedelegeerd is aan Microsoft Entra
External ID (`cimsolutionsexternal.ciamlogin.com`), en dat er twee gescheiden sessies bestaan:

1. De cimsolutions-app-sessie zelf: kortlevend, zichtbaar als een redirect naar `/SignIn`
   zodra hij verlopen is.
2. De onderliggende Entra-SSO-sessie ("dit apparaat onthouden"): langer levend. Zolang deze
   nog geldig is, toont de herauthenticatie-flow een "Pick an account"-scherm met het account
   al gemarkeerd als "Signed in".

## Beslissing

`ensureLoggedIn` ([ensure-logged-in.ts](../../src/lib/ensure-logged-in.ts)) probeert bij een
verlopen app-sessie eerst een stille herauthenticatie: naar de loginpagina, de
Entra-accounttegel aanklikken, en als er een "Signed in"-account zichtbaar is, daarop
doorklikken. Dit logt volledig in zonder wachtwoord of 2FA-code, en de verse `storageState`
wordt opgeslagen. Pas als er geen "Signed in"-account meer zichtbaar is (de Entra-SSO-sessie
is dan ook verlopen), faalt dit expliciet met een duidelijke melding in plaats van vast te
lopen op een 2FA-scherm dat niet automatisch beantwoord kan worden.

## Rationale

Zonder deze ontdekking zou elke verlopen app-sessie een handmatige `login:setup`-stap
vereisen, inclusief het overtypen van een 2FA-code uit e-mail. Met de Entra-SSO-sessie als
tussenlaag blijft de scraper langere tijd zelfstandig herauthenticeren, en is een handmatige
stap alleen nodig in het zeldzamere geval dat ook die SSO-sessie verlopen is.

## Gevolgen

- `storageState.json` wordt niet alleen gelezen maar ook herschreven door `ensureLoggedIn` bij
  een succesvolle stille herauthenticatie.
- `scripts/login-setup.ts` (`npm run login:setup`) blijft nodig als stopgap voor het geval de
  Entra-SSO-sessie zelf ook verlopen is: een headed browser waarin handmatig wordt ingelogd
  inclusief 2FA-code.

## Nog niet opgelost

Hoe lang de Entra-SSO-sessie zelf standhoudt is nog niet bekend. Voor volledig onbemande,
geplande runs (zie README, sectie "Open punten") blijft dit een blokkade: als die sessie
tussentijds verloopt, is er nog steeds een mailbox-toegang nodig om de 2FA-code automatisch te
kunnen lezen (IMAP met app-wachtwoord, of de Gmail API met OAuth). Welke mailbox en welke van
de twee toegangsmethoden, staat nog niet vast.
