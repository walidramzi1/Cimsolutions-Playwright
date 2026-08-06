// ============================================================================
// Imports
// ============================================================================
import { chromium } from '@playwright/test';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// Constanten
// ============================================================================
const LOGIN_URL = 'https://partner.cimsolutions.nl/nl-NL/Account/Login/';
const STORAGE_STATE_PATH = 'storageState.json';

// ============================================================================
// Hoofdprogramma
// ============================================================================

// Handmatige, eenmalige login-stap: opent een zichtbare browser zodat de gebruiker zelf kan
// inloggen (inclusief 2FA-code per e-mail), en slaat daarna de sessie op voor hergebruik.
async function main() {
  // Stap 1: open een zichtbare (niet-headless) browser op de loginpagina.
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(LOGIN_URL);

  console.log('\nBrowser staat open op de loginpagina van partner.cimsolutions.nl.');
  console.log('Log handmatig in (gebruikersnaam, wachtwoord, en de 2FA-code uit je e-mail).');
  console.log('Druk hierna op Enter in deze terminal om de sessie op te slaan.\n');

  // Stap 2: wacht tot de gebruiker klaar is met inloggen en op Enter drukt.
  const rl = readline.createInterface({ input, output });
  await rl.question('Enter zodra je bent ingelogd... ');
  rl.close();

  // Stap 3: sla de ingelogde sessie op, zodat scraper-run die kan hergebruiken.
  await context.storageState({ path: STORAGE_STATE_PATH });
  console.log(`Sessie opgeslagen in ${STORAGE_STATE_PATH}. Deze wordt hergebruikt door scraper-run.`);

  await browser.close();
}

main();
