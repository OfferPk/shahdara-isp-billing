// SISP-44: Complaint Register ↔ Lineman Ticket Two-Way Sync.
// Written to run in CI (the repo Playwright runner cannot run in the dev
// VM). Seeds one synthetic complaint (CMP-101, reported 10:00) into
// sisp_complaints_ledger_v1, then checks, at a real 360px viewport:
//   - the register card offers "Assign Lineman Ticket"; typing a lineman
//     name and clicking it creates TKT-101 linked via complaintId, and
//     the card switches to showing the linked ticket;
//   - after the ticket is resolved at 13:30 (storage updated the way the
//     field modal would leave it) and the app reloads, the startup
//     reconcile marks CMP-101 Resolved with downtimeHours 3.5 and the
//     resolvedViaTicketId provenance stamp;
//   - reopening the complaint in the register reopens the synced ticket.
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

async function seedComplaint(page) {
  await page.evaluate(() => {
    localStorage.setItem('sisp_complaints_ledger_v1', JSON.stringify([{
      id: 'CMP-101',
      customerId: 'seed-c1',
      customerName: 'E2E SYNC CUSTOMER',
      zone: 'Test Zone',
      issueCategory: 'Fiber Cut',
      reportedAt: '2026-10-28T10:00',
      resolvedAt: '',
      downtimeHours: null,
      downtimeManual: false,
      status: 'Open',
      resolutionNote: '',
      createdAt: ''
    }]));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
}

test('assign creates a linked ticket; resolving it resolves the complaint; reopening reopens the ticket', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await seedComplaint(page);

  await page.click('#openComplaintRegisterModalBtn');
  await expect(page.locator('#complaintRegisterModal')).toBeVisible();
  await expect(page.locator('#complaintRegisterList')).toContainText('CMP-101');

  // 1-click assign: type the lineman, click, and the card flips to the
  // linked-ticket line while storage gains TKT-101 with the link.
  await page.fill('[data-assign-technician="CMP-101"]', 'E2E Lineman');
  await page.click('[data-complaint-action="assign"][data-complaint-id="CMP-101"]');
  await expect(page.locator('#complaintRegisterList')).toContainText('TKT-101');
  let tickets = JSON.parse(await page.evaluate(() => localStorage.getItem('sisp_tickets_v1')));
  expect(tickets).toHaveLength(1);
  expect(tickets[0].id).toBe('TKT-101');
  expect(tickets[0].complaintId).toBe('CMP-101');
  expect(tickets[0].technician).toBe('E2E Lineman');
  expect(tickets[0].status).toBe('Open');

  // The field resolution lands in storage (13:30), then a reload runs
  // the startup reconcile: CMP-101 Resolved, downtime 3.5, stamped.
  await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('sisp_tickets_v1'));
    stored[0].status = 'Resolved';
    stored[0].resolvedAt = '2026-10-28T13:30';
    stored[0].note = 'Splice redone';
    localStorage.setItem('sisp_tickets_v1', JSON.stringify(stored));
  });
  await page.reload();
  await page.waitForSelector('#mobileCustomerSearchTrigger', { state: 'attached', timeout: 20000 });
  const complaints = JSON.parse(await page.evaluate(() => localStorage.getItem('sisp_complaints_ledger_v1')));
  expect(complaints).toHaveLength(1);
  expect(complaints[0].status).toBe('Resolved');
  expect(complaints[0].resolvedAt).toBe('2026-10-28T13:30');
  expect(complaints[0].downtimeHours).toBe(3.5);
  expect(complaints[0].resolutionNote).toBe('Splice redone');
  expect(complaints[0].resolvedViaTicketId).toBe('TKT-101');

  // Reopening the complaint reopens the ticket its resolution came from.
  await page.click('#openComplaintRegisterModalBtn');
  await expect(page.locator('#complaintRegisterModal')).toBeVisible();
  await page.click('[data-complaint-action="reopen"][data-complaint-id="CMP-101"]');
  await expect(page.locator('#complaintRegisterList')).toContainText('Open');
  tickets = JSON.parse(await page.evaluate(() => localStorage.getItem('sisp_tickets_v1')));
  expect(tickets[0].status).toBe('Open');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(errors).toEqual([]);
});
