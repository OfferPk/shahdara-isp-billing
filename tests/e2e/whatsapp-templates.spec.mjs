// SISP-25: Template Studio + 1-tap Campaign Queue.
// Written to run in CI (the repo Playwright runner cannot run in the dev VM).
// Seeds two unpaid customers (one broken-waada in North, one active in South),
// edits a template in the studio, then runs a North-filtered campaign:
// Send & Next opens the WhatsApp draft and stamps lastRemindedAt.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedUnpaid(page) {
  return page.evaluate(async () => {
    const core = await import('./core.js');
    let s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const [c0, c1] = s.customers.slice(0, 2);
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    s = core.updateCustomerProfile(s, c0.id, { serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000 }, now);
    s = core.updateCustomerProfile(s, c1.id, { serviceStatus: 'active', packageSpeed: '5 Mbps', monthlySellingAmount: 1000 }, now);
    s = core.saveBillMonth(s, c0.id, { month, dueAmount: '1500', status: 'pending' });
    s = core.saveBillMonth(s, c1.id, { month, dueAmount: '1500', status: 'pending' });
    s = {
      ...s,
      customers: s.customers.map(customer => customer.id === c0.id
        ? { ...customer, zone: 'North', promiseDate: '2026-01-01' }
        : customer.id === c1.id ? { ...customer, zone: 'South' } : customer)
    };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
    return { north: c0.name, south: c1.name };
  });
}

test('studio edit saves and campaign Send & Next stamps lastRemindedAt at 390px', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  const names = await seedUnpaid(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/waTemplates');
  await page.evaluate(() => document.getElementById('showWaTemplatesButton')?.click());
  await page.waitForSelector('#waStudioCards textarea', { state: 'attached', timeout: 20000 });
  expect(await page.locator('#waStudioCards textarea').count()).toBe(5);

  // Studio: edit the Polite Reminder template and save it.
  const studio = page.locator('#waStudioCards');
  await studio.locator('#waTemplateText-politeReminder').fill('Salam {name}, bill {totalDue} baaqi hai. Test template.');
  await studio.locator('[data-wa-save="politeReminder"]').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sisp_wa_templates_v1') || '[]'));
  expect(stored.find(entry => entry.id === 'politeReminder')?.roman).toContain('Test template.');

  // Campaign: North only -> exactly the broken-waada customer.
  await page.selectOption('#waCampaignZone', 'North');
  await page.selectOption('#waCampaignTemplate', 'politeReminder');
  await page.click('#waCampaignStart');
  await page.waitForSelector('#waCampaignSendNext', { state: 'visible', timeout: 20000 });
  const cardText = await page.locator('#waCampaignCard').innerText();
  expect(cardText).toContain(names.north);
  expect(cardText).toContain('Test template.');
  expect(await page.locator('#waCampaignProgress').innerText()).toContain('Customer 1 of 1');

  // Stub window.open so the test does not leave the app, then Send & Next.
  await page.evaluate(() => { window.__openedUrls = []; window.open = (url) => { window.__openedUrls.push(url); return null; }; });
  await page.click('#waCampaignSendNext');
  await page.waitForFunction(() => document.getElementById('waCampaignProgress')?.textContent.includes('Done'), null, { timeout: 20000 });
  const opened = await page.evaluate(() => window.__openedUrls);
  expect(opened.length).toBe(1);
  expect(opened[0]).toContain('wa.me');
  const stamped = await page.evaluate(async () => {
    const core = await import('./core.js');
    const s = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    return s.customers.map(c => c.lastRemindedAt || null);
  });
  expect(stamped.some(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))).toBe(true);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
