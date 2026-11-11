/* ops-accordions.js — Collapsible cards for the advanced Operations
 * panels (Reports Tab Part 4B(2)).
 *
 * Ten long tools — Split receipts, Field visit, Fault parts, Outages,
 * Fuel log, Bank credits, Closed periods, Collector settlement, Shift
 * rules, Balance confirmation — each become a rounded card whose
 * heading (with its live summary line, e.g. 'Field Visits (0 booked)')
 * stays visible while the body starts collapsed, and whose 4–6 line
 * explanatory paragraph moves behind a small 'ℹ️ Info' toggle.
 *
 * Nothing is re-rendered: the sections keep their ids, so every
 * existing render function keeps writing into the same elements; the
 * toggle only flips a data attribute the CSS hides on. Pure except for
 * the DOM wiring in setupOpsAccordions. */

export const OPS_ACCORDION_SECTIONS = Object.freeze([
  { heading: 'splitHeading', summary: 'splitSummary' },
  { heading: 'visitHeading', summary: 'visitSummary' },
  { heading: 'faultPartHeading', summary: 'faultPartSummary' },
  { heading: 'outageTypeHeading', summary: 'outageTypeSummary' },
  { heading: 'generatorFuelHeading', summary: 'generatorFuelSummary' },
  { heading: 'bankCreditHeading', summary: 'bankCreditSummary' },
  { heading: 'guardHeading', summary: 'guardSummary' },
  { heading: 'settleHeading', summary: 'settleSummary' },
  { heading: 'shiftHeading', summary: 'shiftRuleSummary' },
  { heading: 'balanceConfHeading', summary: 'balanceConfSummary' },
]);

export function setupOpsAccordions(root = typeof document !== 'undefined' ? document : null) {
  const wired = [];
  if (!root || typeof root.getElementById !== 'function') return { sections: wired, toggle: () => false };
  for (const { heading, summary } of OPS_ACCORDION_SECTIONS) {
    const headingEl = root.getElementById(heading);
    if (!headingEl) continue;
    const section = headingEl.closest ? headingEl.closest('section') : null;
    if (!section) continue;
    section.classList.add('ops-accordion');
    section.setAttribute('data-collapsed', 'true');
    const summaryEl = summary ? root.getElementById(summary) : null;
    if (summaryEl) summaryEl.classList.add('ops-accordion-summary');
    // The long explanatory paragraph becomes an 'ℹ️ Info' toggle.
    const caption = section.querySelector('.table-heading .chart-caption');
    if (caption && !caption.closest('details')) {
      const details = root.createElement('details');
      details.className = 'ops-info';
      const sum = root.createElement('summary');
      sum.textContent = 'ℹ️ Info';
      details.append(sum);
      caption.parentNode.replaceChild(details, caption);
      details.append(caption);
    }
    const tableHeading = section.querySelector('.table-heading');
    if (!tableHeading) continue;
    const actionArea = tableHeading.querySelector(':scope > div:last-child');
    const toggle = root.createElement('button');
    toggle.type = 'button';
    toggle.className = 'ops-accordion-toggle secondary-button btn-sm';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', heading);
    const setLabel = () => { toggle.textContent = section.getAttribute('data-collapsed') === 'true' ? '▸ Show' : '▾ Hide'; };
    setLabel();
    toggle.addEventListener('click', () => {
      const collapsed = section.getAttribute('data-collapsed') === 'true';
      section.setAttribute('data-collapsed', String(!collapsed));
      toggle.setAttribute('aria-expanded', String(collapsed));
      setLabel();
    });
    (actionArea ?? tableHeading).append(toggle);
    wired.push({ heading, section, toggle });
  }
  return {
    sections: wired,
    toggle: (heading) => {
      const entry = wired.find(item => item.heading === heading);
      if (!entry) return false;
      entry.toggle.click();
      return true;
    },
  };
}
