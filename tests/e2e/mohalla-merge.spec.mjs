// Mohalla de-duplication: the same mohalla used to appear twice in Area
// cards ("Bani" and "Banii" as separate areas) because names were free-typed.
// Written to run in CI (the repo Playwright runner cannot run in the dev VM).
// Seeds two customers with the two old spellings written directly into saved
// state (bypassing the save step, which now canonicalizes), then checks the
// Area Intelligence cards at 390px show exactly one Banii card holding both
// customers, and no separate Bani card.
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

async function seedVariantSpellings(page) {
  await page.evaluate(async () => {
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
      customers: s.customers.map(customer => customer.id === c0.id ? { ...customer, mohalla: 'Bani' } : customer.id === c1.id ? { ...customer, mohalla: 'Banii' } : customer),
    };
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(s));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('Bani and Banii merge into one Banii area card at 390px', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedVariantSpellings(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/analytics');
  const cards = page.locator('#areaIntelligenceCards');
  await expect(cards.locator('.area-intel-card').first()).toBeVisible({ timeout: 20000 });
  const merge = await page.evaluate(() => {
    const headers = [...document.querySelectorAll('#areaIntelligenceCards .area-intel-card h4')].map(h => h.textContent.trim());
    const baniiCard = [...document.querySelectorAll('#areaIntelligenceCards .area-intel-card')].find(card => card.querySelector('h4')?.textContent.trim() === 'Banii');
    const rosterMetric = baniiCard ? [...baniiCard.querySelectorAll('.area-intel-metric')].find(row => (row.querySelector('span')?.textContent ?? '').toLowerCase().includes('current roster')) : null;
    return { headers, baniiCards: headers.filter(h => h === 'Banii').length, baniCards: headers.filter(h => h === 'Bani').length, baniiCustomers: rosterMetric?.querySelector('strong')?.textContent.trim() ?? null };
  });
  expect(merge.baniiCards).toBe(1);
  expect(merge.baniCards).toBe(0);
  expect(merge.baniiCustomers).toBe('2');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
