/**
 * field-tools-sheet-283.spec.mjs - E2E browser tests for:
 * - Issue #283: Field Tools sheet: Attenuator and Return Loss open their screens
 * - Full verification: every [data-open-*] button in the Field Tools sheet opens its modal dialog
 */

import { test, expect } from '@playwright/test';

function trackErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('favicon.ico') && !text.includes('Failed to load resource')) {
        errors.push(text);
      }
    }
  });
  page.on('pageerror', err => errors.push(err.message));
  return errors;
}

const ALL_FIELD_TOOLS = [
  { attr: 'data-open-field-route', modalId: 'fieldRouteModal', name: 'Route Sheet' },
  { attr: 'data-open-work-orders', modalId: 'fieldWorkOrderModal', name: 'Work Orders' },
  { attr: 'data-open-van-transfer', modalId: 'vehicleTransferModal', name: 'Van Transfer' },
  { attr: 'data-open-sync-conflicts', modalId: 'syncConflictModal', name: 'Sync Conflicts' },
  { attr: 'data-open-otdr-trace', modalId: 'mobileOtdrTraceModal', name: 'OTDR Trace' },
  { attr: 'data-open-opm-tester', modalId: 'mobileOpmTestingModal', name: 'Optical Meter' },
  { attr: 'data-open-vfl-tracer', modalId: 'mobileVflModal', name: 'VFL Laser' },
  { attr: 'data-open-fusion-splice', modalId: 'mobileFusionSpliceModal', name: 'Fusion Splice' },
  { attr: 'data-open-optical-budget', modalId: 'mobileOpticalBudgetModal', name: 'Optical Budget' },
  { attr: 'data-open-fiber-probe', modalId: 'mobileFiberProbeModal', name: 'Fiber Probe' },
  { attr: 'data-open-macro-bend', modalId: 'mobileMacroBendModal', name: 'Macro-Bend' },
  { attr: 'data-open-attenuator', modalId: 'mobileAttenuatorModal', name: 'Attenuator' },
  { attr: 'data-open-orl', modalId: 'mobileOrlModal', name: 'Return Loss' },
  { attr: 'data-open-wifi-survey', modalId: 'mobileWifiSurveyModal', name: 'Wi-Fi Survey' },
  { attr: 'data-open-fdt-allocation', modalId: 'mobileFdtAllocationModal', name: 'FAT Matrix' },
  { attr: 'data-open-ont-diagnostics', modalId: 'mobileOntDiagnosticsModal', name: 'ONT Diag' },
  { attr: 'data-open-splitter-tree', modalId: 'mobileSplitterTreeModal', name: 'Splitter Tree' },
  { attr: 'data-open-optical-map', modalId: 'opticalSignalMapModal', name: 'Optical Map' },
  { attr: 'data-open-field-diagnostics', modalId: 'fieldDiagnosticsModal', name: 'Field Diagnostics' },
  { attr: 'data-open-gps-breadcrumbs', modalId: 'mobileGpsBreadcrumbsModal', name: 'Tech GPS Radar' },
  { attr: 'data-open-aerial-alerts', modalId: 'aerialAlertsModal', name: 'Aerial Hazards' }
];

test.describe('Issue #283: Field Tools sheet - Attenuator and Return Loss modals', () => {
  test('clicking Attenuator in Field Tools sheet opens mobileAttenuatorModal and closes sheet', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#field-tools');

    const fieldToolsModal = page.locator('#fieldToolsModal');
    await expect(fieldToolsModal).toBeVisible();

    const attenuatorBtn = fieldToolsModal.locator('[data-open-attenuator]');
    await expect(attenuatorBtn).toBeVisible();
    await attenuatorBtn.click();

    // Sheet should close and Attenuator modal should open
    await expect(fieldToolsModal).toBeHidden();
    const attenuatorModal = page.locator('#mobileAttenuatorModal');
    await expect(attenuatorModal).toBeVisible();

    // Modal elements are functional
    await expect(attenuatorModal.locator('#attenuatorPresetSelect')).toBeVisible();

    // Close attenuator modal
    const closeBtn = attenuatorModal.locator('#mobileAttenuatorCloseBtn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(attenuatorModal).toBeHidden();

    expect(errors).toEqual([]);
  });

  test('clicking Return Loss in Field Tools sheet opens mobileOrlModal and closes sheet', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/#field-tools');

    const fieldToolsModal = page.locator('#fieldToolsModal');
    await expect(fieldToolsModal).toBeVisible();

    const orlBtn = fieldToolsModal.locator('[data-open-orl]');
    await expect(orlBtn).toBeVisible();
    await orlBtn.click();

    // Sheet should close and ORL modal should open
    await expect(fieldToolsModal).toBeHidden();
    const orlModal = page.locator('#mobileOrlModal');
    await expect(orlModal).toBeVisible();

    // Modal elements are functional
    await expect(orlModal.locator('#orlPresetSelect')).toBeVisible();

    // Close ORL modal
    const closeBtn = orlModal.locator('#mobileOrlCloseBtn');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(orlModal).toBeHidden();

    expect(errors).toEqual([]);
  });
});

test.describe('Issue #283: All Field Tools sheet buttons open their corresponding screens', () => {
  for (const tool of ALL_FIELD_TOOLS) {
    test(`clicking ${tool.name} in Field Tools sheet opens #${tool.modalId}`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto('/#field-tools');

      const fieldToolsModal = page.locator('#fieldToolsModal');
      await expect(fieldToolsModal).toBeVisible();

      const btn = fieldToolsModal.locator(`[${tool.attr}]`);
      await expect(btn, `Button for ${tool.name} with [${tool.attr}] should be present`).toBeVisible();
      await btn.click();

      // Field tools sheet must close
      await expect(fieldToolsModal, `Field Tools sheet should close when ${tool.name} is clicked`).toBeHidden();

      // Target modal must open
      const targetModal = page.locator(`#${tool.modalId}`);
      await expect(targetModal, `Modal #${tool.modalId} should be visible for ${tool.name}`).toBeVisible();

      expect(errors).toEqual([]);
    });
  }
});
