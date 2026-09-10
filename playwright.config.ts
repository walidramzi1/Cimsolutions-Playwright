import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
import dotenv from 'dotenv';

dotenv.config();

// playwright-bdd leest de .feature-bestanden en de bijbehorende step-definitions, en
// genereert daar in .features-gen/ echte Playwright-testbestanden van (niet gecommit, zie
// .gitignore). testDir wijst naar die gegenereerde map, niet naar features/ zelf.
const testDir = defineBddConfig({
  language: 'nl',
  features: 'features/**/*.feature',
  steps: 'features/steps/**/*.ts',
});

export default defineConfig({
  testDir,
  // scraper-run doorloopt alle zoektermen van een rol in één teststap (meerdere
  // paginanavigaties na elkaar), dat duurt inherent langer dan de standaard 30s.
  timeout: 300_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: 'https://partner.cimsolutions.nl',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Alleen scraper-run.feature gebruikt de page-fixture; storageState wordt lazy geladen
    // (pas als een test daadwerkelijk een browser-context opent), dus dit breekt de
    // term-validator/upsert-terms-features niet, ook al bestaat storageState.json daar niet.
    storageState: 'storageState.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
