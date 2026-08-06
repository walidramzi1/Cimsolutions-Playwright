// ============================================================================
// Imports
// ============================================================================
import type { Page } from '@playwright/test';

// ============================================================================
// Constanten
// ============================================================================
const OPPORTUNITIES_URL = 'https://partner.cimsolutions.nl/nl-NL/Opportunities/';
const LOGIN_URL = 'https://partner.cimsolutions.nl/nl-NL/Account/Login/';
const STORAGE_STATE_PATH = 'storageState.json';

// ============================================================================
// Helperfunctie
// ============================================================================

// Wacht op networkidle en daarna nog even extra: sommige stappen in de login-flow tonen kort
// een tussenscherm ná networkidle, vóór de echte inhoud er staat.
async function waitForPageToSettle(page: Page, extraWaitMs: number): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(extraWaitMs);
}

// ============================================================================
// Hoofdfunctie
// ============================================================================

/**
 * Zorgt dat `page` een geldige, ingelogde sessie heeft op de partnersite, met hergebruik van
 * de opgeslagen `storageState.json` waar mogelijk.
 *
 * De login is gedelegeerd aan Microsoft Entra External ID. Er bestaan twee gescheiden
 * sessies: de kortlevende cimsolutions-app-sessie (die dit script direct ziet via een
 * redirect naar /SignIn), en een langer levende Entra-SSO-sessie ("dit apparaat onthouden").
 * Zolang die laatste nog geldig is, toont de herauthenticatie-flow een "Pick an
 * account"-scherm met het account al als "Signed in" gemarkeerd, en logt doorklikken daarop
 * volledig in zonder wachtwoord of 2FA-code — dus zonder menselijke tussenkomst.
 *
 * Is ook de Entra-SSO-sessie verlopen (geen "Signed in"-account meer zichtbaar), dan kan dit
 * niet stil hersteld worden: 2FA vereist een code per e-mail. In dat geval gooit deze functie
 * een duidelijke fout en is een handmatige `npm run login:setup` nodig.
 */
export async function ensureLoggedIn(page: Page): Promise<void> {
  // Stap 1: ga naar de lijstpagina en kijk of we doorgestuurd worden naar de inlogpagina.
  await page.goto(OPPORTUNITIES_URL);
  await page.waitForLoadState('networkidle');

  const appSessionExpired = page.url().includes('/SignIn');
  if (!appSessionExpired) {
    // Nog gewoon ingelogd: niets te doen.
    return;
  }

  console.log('[ensure-logged-in] App-sessie verlopen, probeer stille herauthenticatie via Entra-SSO...');

  // Stap 2: ga naar de loginpagina en klik op de Entra-accounttegel.
  await page.goto(LOGIN_URL);
  await waitForPageToSettle(page, 1000);

  await page.getByText('Inloggen Als Partner', { exact: true }).click();
  await waitForPageToSettle(page, 1000);

  // Stap 3: controleer of Entra een "Signed in"-account toont (dan is de SSO-sessie nog geldig).
  const signedInAccount = page.getByText('Signed in', { exact: true });
  const hasSignedInAccount = (await signedInAccount.count()) > 0;
  if (!hasSignedInAccount) {
    // Geen SSO-sessie meer: hier kunnen we niet stil doorheen, want dat zou een 2FA-code per
    // e-mail vereisen.
    throw new Error(
      '[ensure-logged-in] Geen "Signed in"-account gevonden in de Entra-accountkeuze. ' +
        'De SSO-sessie is waarschijnlijk ook verlopen. Draai `npm run login:setup` opnieuw.',
    );
  }

  // Stap 4: klik op het account en controleer dat we niet meer op de inlogpagina staan.
  await signedInAccount.click();
  await waitForPageToSettle(page, 1500);

  const stillOnSignInPage = page.url().includes('/SignIn');
  if (stillOnSignInPage) {
    throw new Error(
      '[ensure-logged-in] Stille herauthenticatie is mislukt, nog steeds op de SignIn-pagina. ' +
        'Draai `npm run login:setup` opnieuw.',
    );
  }

  // Stap 5: geslaagd — sla de verse sessie op zodat een volgende run die kan hergebruiken.
  await page.context().storageState({ path: STORAGE_STATE_PATH });
  console.log('[ensure-logged-in] Sessie stil ververst en opgeslagen in storageState.json.');
}
