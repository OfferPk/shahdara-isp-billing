/* Plan 519 — profile tab counts. Pure rule only: which figures the
 * four profile tab buttons carry. No DOM, no storage, no dates — the
 * caller (app.js updateProfileTabCounts) renders the result, so the
 * rule is testable without a DOM and can never invent a figure:
 * - billingMonths: distinct months with a recorded bill on this
 *   customer (one bill per month; duplicate month entries count
 *   once). This is the per-customer figure — the design's example
 *   "(24 months)" is the MONTH_LIMIT history window, the same for
 *   every customer, so it would say nothing about this profile.
 * - openComplaints: this customer's register complaints not yet
 *   resolved — status Open or In Progress. "Open" here means what
 *   the SISP-188 upstream-chain check means by it (openUpstreamIssues
 *   in outage-impact.js): a Resolved record never counts. The manual
 *   service-log incidents are NOT in this figure: they carry no
 *   status, only a restoredAt timestamp, and their own 30-day count
 *   is already shown inside the Complaints panel
 *   (#incidentCount30Days). The Customer Info tab carries no count:
 *   the completion counter (Plan 512/513) already lives inside that
 *   panel, and duplicating it on the tab would say nothing new. The
 *   Manual Baqaya tab carries no count either: its panel heading
 *   already shows the total unpaid baqaya prominently.
 */
export function profileTabCounts(customer, complaints) {
  if (!customer || typeof customer !== 'object') return { billingMonths: 0, openComplaints: 0 };
  const months = new Set();
  for (const bill of Array.isArray(customer.bills) ? customer.bills : []) {
    if (bill && typeof bill.month === 'string' && bill.month !== '') months.add(bill.month);
  }
  const id = customer.id;
  let openComplaints = 0;
  for (const complaint of Array.isArray(complaints) ? complaints : []) {
    if (!complaint || typeof complaint !== 'object') continue;
    if (id !== undefined && id !== null && String(complaint.customerId ?? '') !== String(id)) continue;
    if (complaint.status !== 'Resolved') openComplaints += 1;
  }
  return { billingMonths: months.size, openComplaints };
}
