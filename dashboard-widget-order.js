// Dashboard widget order preference (Plan 338): one order preference per
// operator, so each operator opens the dashboard to the figures they
// actually use first. A preference carries the operator, the widget list
// in preferred order, and the date it was set. Recording a new preference
// for an operator supersedes the previous one as the current order, and
// the earlier records stay in the history. Resetting restores the default
// order by recording a reset entry — the history is never deleted. The
// preference only reorders display: it never changes any widget figure,
// bill, payment, or customer record by itself, and it never changes the
// app shell. Inputs are never mutated, and the module never reads storage,
// the clock, the network, or the page.

const DASHBOARD_WIDGET_ORDER_DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isDashboardWidgetOrderLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function validDashboardWidgetOrderDay(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  let lastDay = DASHBOARD_WIDGET_ORDER_DAYS_IN_MONTH[month - 1];
  if (month === 2 && isDashboardWidgetOrderLeapYear(year)) lastDay = 29;
  return day >= 1 && day <= lastDay;
}

function cleanDashboardWidgetOrderText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function foldDashboardWidgetOrderStatus(value) {
  const clean = cleanDashboardWidgetOrderText(value).toLowerCase();
  if (clean === 'reset') return 'reset';
  return 'active';
}

export function normalizeDashboardWidgetOrderWidgets(raw) {
  let values = [];
  if (Array.isArray(raw)) {
    values = raw;
  } else if (typeof raw === 'string') {
    values = raw.split(/[,\n]/);
  } else {
    return [];
  }
  const seen = new Map();
  for (const value of values) {
    const widget = cleanDashboardWidgetOrderText(value);
    if (!widget) continue;
    const key = widget.toLowerCase();
    if (!seen.has(key)) seen.set(key, widget);
  }
  return [...seen.values()];
}

export function normalizeDashboardWidgetOrderPreference(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const id = cleanDashboardWidgetOrderText(raw.id);
  const operator = cleanDashboardWidgetOrderText(raw.operator);
  const dateSet = cleanDashboardWidgetOrderText(raw.dateSet);
  if (!id || !operator || !validDashboardWidgetOrderDay(dateSet)) return null;
  const status = foldDashboardWidgetOrderStatus(raw.status);
  const widgets = normalizeDashboardWidgetOrderWidgets(raw.widgets);
  if (status === 'active' && !widgets.length) return null;
  return { id, operator, widgets, dateSet, status };
}

export function normalizeDashboardWidgetOrderPreferenceList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const pref = normalizeDashboardWidgetOrderPreference(raw);
    if (pref && !seen.has(pref.id)) {
      seen.add(pref.id);
      out.push(pref);
    }
  }
  return out;
}

function dashboardWidgetOrderPosition(list, pref) {
  return list.findIndex((item) => item.id === pref.id);
}

function isDashboardWidgetOrderLater(a, b, list) {
  if (a.dateSet !== b.dateSet) return a.dateSet > b.dateSet;
  return dashboardWidgetOrderPosition(list, a) > dashboardWidgetOrderPosition(list, b);
}

export function dashboardWidgetOrderForOperator(list, operator) {
  const clean = normalizeDashboardWidgetOrderPreferenceList(list);
  const wanted = cleanDashboardWidgetOrderText(operator);
  if (!wanted) return null;
  let latest = null;
  for (const pref of clean) {
    if (pref.operator.toLowerCase() !== wanted.toLowerCase()) continue;
    if (!latest || isDashboardWidgetOrderLater(pref, latest, clean)) latest = pref;
  }
  if (!latest || latest.status !== 'active') return null;
  return latest;
}

export function dashboardWidgetOrderHistoryForOperator(list, operator) {
  const clean = normalizeDashboardWidgetOrderPreferenceList(list);
  const wanted = cleanDashboardWidgetOrderText(operator);
  if (!wanted) return [];
  return clean
    .filter((pref) => pref.operator.toLowerCase() === wanted.toLowerCase())
    .sort((a, b) => {
      if (a.dateSet !== b.dateSet) return a.dateSet < b.dateSet ? 1 : -1;
      return dashboardWidgetOrderPosition(clean, a) < dashboardWidgetOrderPosition(clean, b) ? 1 : -1;
    });
}

export function recordDashboardWidgetOrderPreference(list, pref) {
  const clean = normalizeDashboardWidgetOrderPreferenceList(list);
  const next = normalizeDashboardWidgetOrderPreference(pref);
  if (!next) return clean;
  if (clean.some((item) => item.id === next.id)) return clean;
  return [...clean, next];
}

export function resetDashboardWidgetOrder(list, operator, details) {
  const clean = normalizeDashboardWidgetOrderPreferenceList(list);
  const wanted = cleanDashboardWidgetOrderText(operator);
  if (!wanted) return clean;
  const id = details && typeof details === 'object' ? cleanDashboardWidgetOrderText(details.id) : '';
  const resetDate = details && typeof details === 'object' ? cleanDashboardWidgetOrderText(details.resetDate) : '';
  if (!id || !validDashboardWidgetOrderDay(resetDate)) return clean;
  if (clean.some((item) => item.id === id)) return clean;
  if (!dashboardWidgetOrderForOperator(clean, wanted)) return clean;
  return [...clean, { id, operator: wanted, widgets: [], dateSet: resetDate, status: 'reset' }];
}

export function dashboardWidgetsInPreferredOrder(widgets, preference) {
  const ordered = normalizeDashboardWidgetOrderWidgets(widgets);
  const pref = normalizeDashboardWidgetOrderPreference(preference);
  if (!pref || pref.status !== 'active' || !pref.widgets.length) return ordered;
  const wanted = [];
  const wantedKeys = new Set();
  for (const widget of pref.widgets) {
    const key = widget.toLowerCase();
    const match = ordered.find((name) => name.toLowerCase() === key);
    if (match && !wantedKeys.has(key)) {
      wanted.push(match);
      wantedKeys.add(key);
    }
  }
  const rest = ordered.filter((name) => !wantedKeys.has(name.toLowerCase()));
  return [...wanted, ...rest];
}

export function dashboardWidgetOrderCounts(list) {
  const clean = normalizeDashboardWidgetOrderPreferenceList(list);
  const operators = new Set();
  let active = 0;
  let reset = 0;
  for (const pref of clean) {
    operators.add(pref.operator.toLowerCase());
    if (pref.status === 'reset') reset += 1;
    else active += 1;
  }
  return { total: clean.length, active, reset, operators: operators.size };
}

export function dashboardWidgetOrderSummaryText(list) {
  const counts = dashboardWidgetOrderCounts(list);
  if (!counts.total) return 'No widget orders saved.';
  const activeText = `${counts.active} saved order${counts.active === 1 ? '' : 's'}`;
  const operatorText = `${counts.operators} operator${counts.operators === 1 ? '' : 's'}`;
  if (!counts.reset) return `${activeText} across ${operatorText}.`;
  return `${activeText} across ${operatorText}, ${counts.reset} reset${counts.reset === 1 ? '' : 's'} back to the default order.`;
}

function dashboardWidgetOrderDetailText(pref) {
  const clean = normalizeDashboardWidgetOrderPreference(pref);
  if (!clean) return '';
  if (clean.status === 'reset') {
    return `back on the default order, reset on ${clean.dateSet}`;
  }
  return `${clean.widgets.join(', ')} — set on ${clean.dateSet}`;
}

export function dashboardWidgetOrderText(pref) {
  const clean = normalizeDashboardWidgetOrderPreference(pref);
  if (!clean) return '';
  return `${clean.operator} — ${dashboardWidgetOrderDetailText(clean)}`;
}

function escapeDashboardWidgetOrderHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function dashboardWidgetOrderHtml(pref) {
  const clean = normalizeDashboardWidgetOrderPreference(pref);
  if (!clean) return '';
  return `<div><strong>${escapeDashboardWidgetOrderHtml(clean.operator)}</strong> — ${escapeDashboardWidgetOrderHtml(dashboardWidgetOrderDetailText(clean))}</div>`;
}

export function dashboardWidgetOrdersHtml(list) {
  const clean = normalizeDashboardWidgetOrderPreferenceList(list);
  if (!clean.length) return '<p>No widget orders saved.</p>';
  const items = clean.map((pref) => `<li>${escapeDashboardWidgetOrderHtml(dashboardWidgetOrderText(pref))}</li>`).join('');
  return `<ul>${items}</ul>`;
}

export function dashboardWidgetOrderCurrentHtml(list, operator) {
  const pref = dashboardWidgetOrderForOperator(list, operator);
  if (!pref) return '<p>On the default order.</p>';
  return `<p>${escapeDashboardWidgetOrderHtml(dashboardWidgetOrderText(pref))}</p>`;
}

export function dashboardWidgetsInPreferredOrderHtml(widgets, preference) {
  const ordered = dashboardWidgetsInPreferredOrder(widgets, preference);
  if (!ordered.length) return '<p>No widgets listed.</p>';
  const items = ordered.map((name) => `<li>${escapeDashboardWidgetOrderHtml(name)}</li>`).join('');
  return `<ol>${items}</ol>`;
}

function dashboardWidgetOrderCsvCell(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function dashboardWidgetOrderCsv(list) {
  const clean = normalizeDashboardWidgetOrderPreferenceList(list);
  const header = ['id', 'operator', 'widgets', 'dateSet', 'status'];
  const lines = [header.map(dashboardWidgetOrderCsvCell).join(',')];
  for (const pref of clean) {
    lines.push([
      pref.id,
      pref.operator,
      pref.widgets.join('; '),
      pref.dateSet,
      pref.status,
    ].map(dashboardWidgetOrderCsvCell).join(','));
  }
  return lines.join('\n');
}

export function dashboardWidgetOrderFilename() {
  return 'dashboard-widget-orders.csv';
}

// Plan 583 (D2(a)) — the dashboard widget-name → section-id mapping.
// The preference vocabulary names WIDGETS ('Overdue list', 'Collections
// today', ...); the dashboard's sections have IDS. Nothing anywhere
// recorded which name is which section, so the helper alone could never
// reorder the dashboard — feeding section ids to it left the order
// byte-identical (the spec-literal trap). Each reorderable section gets
// its heading-derived display name, in static default order; the aliases
// below cover the 338 names whose content has a genuine dashboard home.
// 'Due in 7 days' / 'New customers' have no dashboard section (they live
// on the Collect / Reports tabs) and are deliberately NOT in the map —
// the helper's unknown-name rule keeps them at their default position,
// never vanishing. No entry points at a dialog, a banner, the heading,
// or the data-safety aside: only the 12 reorderable content sections.
export const DASHBOARD_WIDGET_SECTIONS = Object.freeze([
  { name: 'Key performance indicators', id: 'homeKpiStrip' },
  { name: 'Share / Digest', id: 'homeShareMenu' },
  { name: 'Primary billing actions', id: 'homePrimaryActions' },
  { name: 'Morning Briefing', id: 'morningBriefingSection' },
  { name: "Today's Summary", id: 'homeTodaySection' },
  { name: 'Recent Payments', id: 'recentPaymentsSection' },
  { name: 'Expired Vacation Holds', id: 'expiredHoldsSection' },
  { name: 'WAPDA Outage — Running on Battery', id: 'powerOutageSection' },
  { name: 'Performance & Collection Analytics', id: 'homeChartsCollapsible' },
  { name: 'Monthly Provider Cost Breakdown', id: 'homeProviderCostDetails' },
  { name: 'Pending Works', id: 'pendingWorksSection' },
  { name: 'System Health', id: 'systemHealthSection' },
]);

// Plan 583 (D2(a)) — aliases for the 338 vocabulary names whose content
// has a genuine dashboard home. 'Overdue list' first moves the today
// section — the Top-3 overdue preview's home — first; it does NOT move a
// standalone overdue section, because there is none on the dashboard (that
// section lives on the Collect tab). 'Today at a glance' is the deleted
// card's name, so an operator saving the old name still gets the today
// section first.
export const DASHBOARD_WIDGET_SECTION_ALIASES = Object.freeze({
  'Collections today': 'homeTodaySection',
  'Overdue list': 'homeTodaySection',
  'Today at a glance': 'homeTodaySection',
});

// Plan 583 (D2(a)) — the dashboard's section ids in a saved order.
// Resolves each saved widget name to its section's display name (a direct
// display name, or an alias — matched case-insensitively), orders the
// default display-name list with the existing helper, and maps back to
// ids. A null / reset preference returns the default id list. Unknown
// names are ignored by the helper, so no section ever vanishes. Pure:
// it reads no storage, clock, network, or page.
export function dashboardWidgetSectionIdsInPreferredOrder(preference) {
  const sections = DASHBOARD_WIDGET_SECTIONS;
  const defaultNames = sections.map((section) => section.name);
  const defaultIds = sections.map((section) => section.id);
  const pref = normalizeDashboardWidgetOrderPreference(preference);
  if (!pref || pref.status !== 'active' || !pref.widgets.length) return [...defaultIds];
  const displayByLowerName = new Map(sections.map((section) => [section.name.toLowerCase(), section.name]));
  const aliasByLowerName = new Map(Object.entries(DASHBOARD_WIDGET_SECTION_ALIASES).map(([alias, id]) => {
    const section = sections.find((item) => item.id === id);
    return [alias.toLowerCase(), section ? section.name : null];
  }));
  const resolved = pref.widgets.map((widget) => {
    const key = widget.toLowerCase();
    return displayByLowerName.get(key) ?? aliasByLowerName.get(key) ?? widget;
  });
  const orderedNames = dashboardWidgetsInPreferredOrder(defaultNames, { ...pref, widgets: resolved });
  const idByDisplayName = new Map(sections.map((section) => [section.name, section.id]));
  return orderedNames.map((name) => idByDisplayName.get(name));
}
