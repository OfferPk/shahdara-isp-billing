// SISP-56: Saad Visit Log ↔ Tickets & Salary/Commission P&L Sync.
// CI-only Playwright spec (the repo's Playwright runner cannot run in
// the VM; written for CI, not claimed as run locally). Seeds synthetic
// records in the modules' own storage keys and checks:
//   - a resolved ticket assigned to Saad shows the 1-click
//     "Log Saad Visit from Ticket (TKT-101)" action, which opens the
//     Saad Visit Log pre-filled (ticket link, splicing type, date);
//   - saving the visit flips the ticket card to "Saad visit logged";
//   - a drawer-paid Saad payout mirrors at startup into the Expenses
//     ledger (saadPaymentId row, Salary — Saad) and the Roznamcha
//     (one `saad-` outflow) with no duplicate expense.
import { test, expect } from '@playwright/test';

const STATE_KEY = 'shahdara-isp-billing-v1';
const TICKETS_KEY = 'sisp_tickets_v1';
const SAAD_PAYMENTS_KEY = 'sisp_saad_payments_v1';
const SAAD_VISITS_KEY = 'sisp_saad_visits_v1';
const ROZNAMCHA_KEY = 'sisp_roznamcha_v1';

async function seed(page) {
  await page.addInitScript(({ stateKey, ticketsKey, paymentsKey }) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Karachi', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date());
    const get = type => parts.find(p => p.type === type).value;
    const today = `${get('year')}-${get('month')}-${get('day')}`;
    const state = {
      version: 1,
      nextCustomerNumber: 2,
      customers: [
        { id: 'c1', customerNumber: 1, name: 'E2E Visit Customer', mohalla: 'BARRIAN', bills: [] }
      ],
      expenses: [],
      monthlyClosings: []
    };
    window.localStorage.setItem(stateKey, JSON.stringify(state));
    const ticket = {
      id: 'TKT-101', customerId: 'c1', customerName: 'E2E Visit Customer', complaintId: '',
      faultPreset: 'Fiber Cut / Splice Loss', customFault: '', technician: 'Saad',
      priority: 'Normal', status: 'Resolved', createdAt: `${today}T09:00`, resolvedAt: `${today}T13:30`,
      note: '', materialsUsed: [{ key: 'fiber', qty: 25, amount: 0 }], billingType: 'free',
      billedAmount: 0, chargePaid: false, chargePaidAt: '', chargePaymentId: '',
      resolvedViaComplaintId: '', stockDeductions: [], stockDeducted: false
    };
    window.localStorage.setItem(ticketsKey, JSON.stringify([ticket]));
    const payment = {
      id: 'SP-1', date: today, type: 'commission', amount: 5000,
      note: 'E2E drawer commission', paidFromDrawer: true, createdAt: new Date().toISOString()
    };
    window.localStorage.setItem(paymentsKey, JSON.stringify([payment]));
  }, { stateKey: STATE_KEY, ticketsKey: TICKETS_KEY, paymentsKey: SAAD_PAYMENTS_KEY });
}

test('startup sync mirrors the drawer payout into Expenses + Roznamcha exactly once', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto('/');

  const stored = await page.evaluate(({ stateKey, roznamchaKey }) => ({
    expenses: JSON.parse(window.localStorage.getItem(stateKey)).expenses,
    days: JSON.parse(window.localStorage.getItem(roznamchaKey) || '[]')
  }), { stateKey: STATE_KEY, roznamchaKey: ROZNAMCHA_KEY });

  const mirrors = stored.expenses.filter(e => e.saadPaymentId === 'SP-1');
  expect(mirrors).toHaveLength(1);
  expect(mirrors[0].amount).toBe(5000);
  expect(mirrors[0].category).toBe('Salary — Saad');
  expect(stored.expenses.filter(e => e.roznamchaEntryId)).toHaveLength(0);

  const outflows = stored.days.flatMap(d => d.outflows).filter(o => o.id === 'saad-SP-1');
  expect(outflows).toHaveLength(1);
  expect(outflows[0].amount).toBe(5000);
  expect(outflows[0].lineman).toBe('Saad');
});

test('resolved Saad ticket logs a pre-filled visit in one click', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await seed(page);
  await page.goto('/');

  await page.evaluate(() => document.getElementById('openFieldTicketsModalBtn')?.click());
  const logBtn = page.locator('[data-ticket-action="log-saad-visit"][data-ticket-id="TKT-101"]');
  await expect(logBtn).toBeVisible();
  await logBtn.click();

  const saadDialog = page.locator('#saadVisitsModal');
  await expect(saadDialog).toBeVisible();
  await expect(page.locator('#saadVisitTicket')).toHaveValue('TKT-101');
  await expect(page.locator('#saadVisitType')).toHaveValue('splicing');
  await expect(page.locator('#saadVisitCustomer')).toHaveValue('c1');
  await expect(page.locator('#saadVisitFiberMeters')).toHaveValue('25');

  await page.locator('#saadVisitHours').fill('3');
  await page.locator('#saadVisitForm button[type="submit"]').click();

  const visits = await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) || '[]'), SAAD_VISITS_KEY);
  expect(visits).toHaveLength(1);
  expect(visits[0].ticketId).toBe('TKT-101');
  expect(visits[0].hoursWorked).toBe(3);

  await page.evaluate(() => document.getElementById('saadVisitsCloseBtn')?.click());
  await expect(page.locator('[data-ticket-action="log-saad-visit"]')).toHaveCount(0);
  await expect(page.locator('.ticket-card[data-ticket-id="TKT-101"]')).toContainText('Saad visit logged');
});
