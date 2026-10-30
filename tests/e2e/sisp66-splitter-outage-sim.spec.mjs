// SISP-66: Splitter Port Map ↔ Daisy-Chain Outage Simulator & Complaint
// Register Link.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds the spec pin into app state — DB-01 with 4 assigned ports,
// Port 2 feeding 1 downstream house via upstreamCustomerId, Port 4 at
// -28.4 dBm — then checks, at a real 360px viewport:
//   - "⚡ Simulate Splitter Box Cut" lists all 5 affected subscribers
//     (4 direct + 1 downstream) with WhatsApp draft links;
//   - the weak-port card for Port 4 shows "Create Attenuation Ticket";
//     with a lineman name typed, one click creates exactly one SISP-12
//     ticket in sisp_tickets_v1, and a second click dedupes;
//   - no horizontal overflow at 360px and no page errors.
import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) errors.push(m.text()); });
  return errors;
}

async function boot(page) {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/#/home');
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

async function seedPin(page) {
  await page.evaluate(async () => {
    const core = await import('./core.js');
    const state = JSON.parse(localStorage.getItem(core.STORAGE_KEY));
    const base = state.customers[0] || {};
    const mk = (id, num, name, extra) => ({
      ...base, id, customerNumber: num, name, mohalla: 'BARRIAN', phone: '',
      bills: [], archived: false, upstreamCustomerId: '', fiberZone: '',
      splitterBoxId: '', splitterPort: null, lastRxDbm: null, ...extra
    });
    state.customers = [
      mk('e2e-p1', 21, 'E2E PORT ONE', { splitterBoxId: 'DB-01', splitterPort: 1, lastRxDbm: -19.0, phone: '03001111111' }),
      mk('e2e-p2', 22, 'E2E PORT TWO', { splitterBoxId: 'DB-01', splitterPort: 2, lastRxDbm: -21.5, phone: '03002222222' }),
      mk('e2e-p3', 23, 'E2E PORT THREE', { splitterBoxId: 'DB-01', splitterPort: 3, lastRxDbm: -24.0, phone: '03003333333' }),
      mk('e2e-p4', 24, 'E2E PORT FOUR', { splitterBoxId: 'DB-01', splitterPort: 4, lastRxDbm: -28.4, phone: '03004444444' }),
      mk('e2e-d1', 25, 'E2E DOWNSTREAM', { upstreamCustomerId: 'e2e-p2', phone: '03005555555' })
    ];
    localStorage.setItem(core.STORAGE_KEY, JSON.stringify(state));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('splitter cut simulation lists all 5 and the attenuation ticket is created once', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedPin(page);

  await page.click('#openSplitterMapModalBtn');
  await expect(page.locator('#splitterMapModal')).toBeVisible();
  await expect(page.locator('#splitterMapSummaryLine')).toContainText('DB-01');

  await page.click('#splitterMapSimulateBtn');
  await expect(page.locator('#splitterMapSimSummary')).toContainText('5 subscriber');
  await expect(page.locator('#splitterMapSimList .splitter-sim-card')).toHaveCount(5);
  await expect(page.locator('#splitterMapSimList')).toContainText('E2E DOWNSTREAM');
  await expect(page.locator('#splitterMapSimList')).toContainText('Downstream of E2E PORT TWO');
  await expect(page.locator('#splitterMapSimList a[href^="https://wa.me/"]')).toHaveCount(5);

  // Attenuation ticket: no lineman name yet — the click must refuse and
  // create nothing.
  await page.click('.splitter-att-btn');
  let tickets = await page.evaluate(() => JSON.parse(localStorage.getItem('sisp_tickets_v1') || '[]'));
  expect(tickets).toHaveLength(0);

  await page.fill('#splitterMapTechnicianInput', 'Saad');
  await page.click('.splitter-att-btn');
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('sisp_tickets_v1') || '[]').length)).toBe(1);
  tickets = await page.evaluate(() => JSON.parse(localStorage.getItem('sisp_tickets_v1') || '[]'));
  expect(tickets[0].customerId).toBe('e2e-p4');
  expect(tickets[0].faultPreset).toBe('Slow Speed / High Attenuation');
  expect(tickets[0].note).toContain('DB-01 port 4');
  expect(tickets[0].note).toContain('-28.4 dBm');

  // Second click dedupes against the still-open ticket.
  await page.click('.splitter-att-btn');
  tickets = await page.evaluate(() => JSON.parse(localStorage.getItem('sisp_tickets_v1') || '[]'));
  expect(tickets).toHaveLength(1);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  expect(errors).toEqual([]);
});
