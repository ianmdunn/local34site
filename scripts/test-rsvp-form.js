#!/usr/bin/env node
/**
 * E2E test for the RSVP form on /actions.
 * Run: npx playwright test scripts/test-rsvp-form.js
 * Or: node scripts/test-rsvp-form.js (uses playwright programmatically)
 */
import { firefox } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'https://www.local34.org';
const ACTIONS_URL = `${BASE_URL}/actions`;
const TEST_DATA = {
  name: 'Test User',
  email: 'test@yale.edu',
  phone: '555-123-4567',
  department: 'IT',
};

async function main() {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  // Allow popups (target="_blank" form submit)
  const page = await context.newPage();

  const errors = [];
  let success = false;
  let thankYouOpened = false;
  let newTabUrl = null;

  try {
    console.log('1. Navigating to', ACTIONS_URL);
    await page.goto(ACTIONS_URL, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000); // Allow React hydration

    console.log('2. Looking for RSVP / "I\'ll Be There" button...');
    const rsvpButton = page.locator('button.adv-btn--primary, a.adv-btn--primary').filter({ hasText: /RSVP|I'll Be There/i }).first();
    await rsvpButton.waitFor({ state: 'visible', timeout: 5000 });
    await rsvpButton.click();

    console.log('3. Waiting for RSVP form to appear...');
    const form = page.locator('form.adv-form');
    await form.waitFor({ state: 'visible', timeout: 5000 });

    const formAction = await form.getAttribute('action');
    const formTarget = await form.getAttribute('target');
    console.log('   Form action:', formAction);
    console.log('   Form target:', formTarget);

    console.log('3a. Checking autocomplete attributes...');
    const textInputs = await form.locator('input[type="text"], input[type="email"], input[type="tel"]').all();
    for (const input of textInputs) {
      const name = await input.getAttribute('name');
      const autocomplete = await input.getAttribute('autocomplete');
      const id = await input.getAttribute('id');
      if (name && !name.includes('event_') && !name.includes('website')) {
        console.log(`   - ${name}: autocomplete="${autocomplete || '(none)'}"`);
      }
    }

    console.log('4. Filling form fields...');
    const inputs = await form.locator('input[type="text"], input[type="email"], input[type="tel"], select, textarea').all();
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      const tag = await input.evaluate((el) => el.tagName.toLowerCase());
      const id = await input.getAttribute('id');
      const placeholder = (await input.getAttribute('placeholder')) || '';

      if (name?.includes('email') || type === 'email') {
        await input.fill(TEST_DATA.email);
        console.log('   - Filled email:', TEST_DATA.email);
      } else if (name?.includes('phone') || type === 'tel' || placeholder.toLowerCase().includes('phone')) {
        await input.fill(TEST_DATA.phone);
        console.log('   - Filled phone:', TEST_DATA.phone);
      } else if (name?.toLowerCase().includes('department') || placeholder.toLowerCase().includes('department')) {
        if (tag === 'select') {
          await input.selectOption({ label: /IT/i }).catch(() => input.selectOption(TEST_DATA.department));
        } else {
          await input.fill(TEST_DATA.department);
        }
        console.log('   - Filled department:', TEST_DATA.department);
      } else if (name?.toLowerCase().includes('name') || placeholder.toLowerCase().includes('name') || id?.includes('name')) {
        await input.fill(TEST_DATA.name);
        console.log('   - Filled name:', TEST_DATA.name);
      } else if (
        tag === 'input' &&
        !name?.includes('event_') &&
        type !== 'hidden' &&
        !name?.toLowerCase().includes('hp') &&
        !name?.toLowerCase().includes('honeypot') &&
        !name?.toLowerCase().includes('website')
      ) {
        const val = await input.inputValue();
        if (!val || val.length < 3) {
          if (placeholder.toLowerCase().includes('first') || name?.toLowerCase().includes('first')) {
            await input.fill(TEST_DATA.name.split(' ')[0] || 'Test');
          } else if (placeholder.toLowerCase().includes('last') || name?.toLowerCase().includes('last')) {
            await input.fill(TEST_DATA.name.split(' ').slice(1).join(' ') || 'User');
          } else {
            await input.fill(TEST_DATA.name);
          }
          console.log('   - Filled field:', name || id);
        }
      }
    }

    console.log('5. Submitting form...');
    const currentUrl = page.url();

    const submitBtn = form.locator('button[type="submit"]');
    const [popup] = await Promise.all([
      context.waitForEvent('page', { timeout: 20000 }).catch(() => null),
      submitBtn.click(),
    ]);

    await page.waitForTimeout(1000);

    const pagesAfter = context.pages();
    const targetPage = popup || pagesAfter.find((p) => p !== page && p.url() !== currentUrl);
    if (targetPage) {
      thankYouOpened = true;
      await targetPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      newTabUrl = targetPage.url();
      console.log('6. New tab opened:', newTabUrl);
      const content = await targetPage.content().catch(() => '');
      if (/thank|thank you|submitted|success|jotform/i.test(content)) {
        success = true;
        console.log('   - Thank you page detected');
      }
      await targetPage.close().catch(() => {});
    } else {
      await page.waitForTimeout(2000);
      const afterUrl = page.url();
      if (afterUrl !== currentUrl && !afterUrl.includes('/actions')) {
        thankYouOpened = true;
        newTabUrl = afterUrl;
        const content = await page.content();
        if (/thank|thank you|submitted|success|jotform/i.test(content)) {
          success = true;
        }
      } else {
        errors.push('No new tab opened after submit');
      }
    }
  } catch (err) {
    errors.push(err.message || String(err));
    console.error('Error:', err);
  } finally {
    await browser.close();
  }

  console.log('\n--- RSVP Form Test Report ---');
  console.log('Success:', success);
  console.log('Thank-you page opened in new tab:', thankYouOpened);
  if (newTabUrl) console.log('New tab URL:', newTabUrl);
  if (errors.length) console.log('Errors:', errors);
  process.exit(success ? 0 : 1);
}

main();
