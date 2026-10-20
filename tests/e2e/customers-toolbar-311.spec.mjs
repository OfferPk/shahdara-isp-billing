import { test, expect } from '@playwright/test';

// #311: the Customers "Filters & sort / Show details" toolbar must line up
// with the pane heading (same inner inset), and in the narrow desktop list
// pane the count badge must stay on the "Customers" line.
async function box(page, selector) {
  return page.locator(selector).first().evaluate(el => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
}

test.describe('Customers toolbar alignment (#311)', () => {
  test('toolbar button aligns with the heading on mobile 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#/customers');
    await expect(page.locator('.cust-list-toolbar')).toBeVisible();
    const heading = await box(page, '#customerPane .pane-heading h2');
    const button = await box(page, '.cust-list-toolbar .sr-filter-jump');
    expect(Math.abs(button.x - heading.x)).toBeLessThanOrEqual(2);
    expect(button.x).toBeGreaterThan(0); // not glued to the screen edge
  });

  test('toolbar button aligns with the heading on desktop 1280x800', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#/customers');
    await expect(page.locator('.cust-list-toolbar')).toBeVisible();
    const heading = await box(page, '#customerPane .pane-heading h2');
    const button = await box(page, '.cust-list-toolbar .sr-filter-jump');
    expect(Math.abs(button.x - heading.x)).toBeLessThanOrEqual(2);
  });

  test('count badge stays on the heading line in the narrow pane (profile open)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#/customers');
    await page.locator('#customerList .customer-select').first().click();
    await expect(page.locator('#customerPane')).toBeVisible();
    const pane = await box(page, '#customerPane');
    expect(pane.width).toBeLessThan(400); // the narrow list pane layout
    const heading = await box(page, '#customerPane .pane-heading h2');
    const badge = await box(page, '#customerCount');
    // Single-line heading with the badge on the same line...
    expect(heading.height).toBeLessThan(34);
    expect(Math.abs(badge.y - heading.y)).toBeLessThanOrEqual(6);
    // ...and the Wizard / Bulk add actions wrapped below it, not beside it.
    const wizard = await box(page, '#openEnrollmentWizardBtn');
    expect(wizard.y).toBeGreaterThan(heading.y + heading.height - 4);
  });
});
