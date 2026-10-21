/**
 * statement-print-225.spec.mjs
 * #225: the customer statement prints cleanly on A4 (existing flow) and on a
 * 58mm thermal roll (new Print 58mm mode: named @page, narrow single column,
 * no horizontal overflow).
 */
import { test, expect } from '@playwright/test';

test.describe('Issue #225: statement print modes', () => {
  test('statement modal offers A4 + 58mm print and the 58mm layout fits the roll', async ({ page }) => {
    await page.goto('/#customers');
    const firstCustomerBtn = page.locator('#customerList [data-customer-id]').first();
    await expect(firstCustomerBtn).toBeVisible();
    await firstCustomerBtn.click();
    await page.locator('#openAccountStatementBtn').click();
    const modal = page.locator('#accountStatementModal');
    await expect(modal).toBeVisible();

    const printA4 = page.locator('#printStatementBtn');
    const print58 = page.locator('#printStatement58Btn');
    await expect(printA4).toBeVisible();
    await expect(print58).toBeVisible();

    // Capture the body classes at the moment window.print() runs.
    await page.evaluate(() => {
      window.__printClasses = null;
      window.print = () => { window.__printClasses = document.body.className; };
    });
    await print58.click();
    await expect.poll(() => page.evaluate(() => window.__printClasses)).toContain('printing-statement-58');
    const classesAtPrint = await page.evaluate(() => window.__printClasses);
    expect(classesAtPrint).toContain('printing-statement');

    // Classes are cleaned up after printing.
    await expect(page.locator('body')).not.toHaveClass(/printing-statement/);

    // With print media emulated and the 58mm mode on, the statement sheet
    // must fit a 58mm roll (~219 CSS px) without horizontal overflow.
    await page.evaluate(() => document.body.classList.add('printing-statement', 'printing-statement-58'));
    await page.emulateMedia({ media: 'print' });
    const measure = await page.evaluate(() => {
      const sheet = document.querySelector('.customer-account-statement');
      const table = document.querySelector('.statement-table');
      const monthHeader = document.querySelector('.statement-table th:nth-child(3)');
      return {
        sheetWidth: sheet ? sheet.getBoundingClientRect().width : 0,
        monthColDisplay: monthHeader ? getComputedStyle(monthHeader).display : 'missing',
        docScrollWidth: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        tableVisible: table ? getComputedStyle(table).display : 'missing'
      };
    });
    expect(measure.tableVisible).not.toBe('none');
    expect(measure.sheetWidth).toBeGreaterThan(150);
    expect(measure.sheetWidth).toBeLessThanOrEqual(219 + 2); // 58mm at 96dpi, small tolerance
    expect(measure.monthColDisplay).toBe('none');
  });
});
