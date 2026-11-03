// Plan S — Collector and field workflows: one day-flow summary.
//
// COMPOSITION AND PLACEMENT ONLY. This module computes no money of its
// own and changes no commission, handover, or route rule:
//
// - Route figures come from calculateFieldCollectionRoutes
//   (nav-collection-rounds.js) and are carried into the summary
//   verbatim, so the route strip and the handover strip can never
//   drift apart: both render from this one object.
// - Handover figures come from calculateCollectorCashExpected
//   (dashboard-daily-closing.js) and are carried verbatim too.
// - Promised figures come from the route stops' own recorded visit
//   outcomes (outcome 'promised' + promiseAmount); nothing is
//   re-derived from bills or payments.
//
// Why the two cash-looking numbers are shown together but never
// asserted equal: the route "collected" figure is dues marked
// collected on this route view, while the handover "expected" figure
// is cash receipts recorded for the day. They measure different
// things, so the summary explains the difference instead of forcing
// a match. The agreement it DOES pin is that the summary's route
// figures equal the route builder's figures and its handover figures
// equal the handover builder's figures, on the same inputs.
//
// The module is import-free (like nav-collection-rounds.js) so the
// route sheet can use it without changing that module's design; the
// app wires it in through the route sheet's onRouteData hook. The
// view-state helpers are the "do not lose your place" mechanism: the
// route sheet saves its view before opening handover and restores
// it on return, with every value whitelisted first.

export const FIELD_DAY_FLOW_SORT_OPTIONS = Object.freeze([
  'priority',
  'sequenced',
  'due-high',
  'manual',
  'custom',
  'area',
  'sector',
  'offline-first',
  'name'
]);

export const FIELD_DAY_FLOW_FILTER_TABS = Object.freeze([
  'all',
  'pending',
  'collected',
  'promised',
  'not_home',
  'refused',
  'paid',
  'partial'
]);

export const FIELD_DAY_FLOW_STEPS = Object.freeze([
  { id: 'route', label: 'Work the route' },
  { id: 'handover', label: 'Hand over cash' },
  { id: 'reconcile', label: 'Day reconciled' }
]);

// The route strip and the handover strip measure different things.
// This note is part of the summary so both displays carry the same
// explanation and a collector never mistakes the pair for a shortfall.
export const FIELD_DAY_FLOW_FIGURES_NOTE =
  'Route collected counts dues marked collected on this route view; ' +
  'handover expected counts cash receipts recorded for the day. ' +
  'They are shown together for reconciliation, not as one total.';

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value) {
  return value == null ? '' : String(value);
}

function escapeHtml(value) {
  return str(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value) {
  return `Rs. ${Math.round(num(value)).toLocaleString('en-US')}`;
}

/**
 * Pure: builds one day-flow summary from the existing builders'
 * outputs. Never mutates its inputs.
 *
 * @param {object} input
 * @param {object} [input.routeData] calculateFieldCollectionRoutes output
 * @param {object} [input.handover] calculateCollectorCashExpected output
 * @param {boolean} [input.handoverRecorded] a cash handover record
 *   already exists for the flow date (from getDailyCashHandovers)
 */
export function buildFieldDayFlow(input = {}) {
  const routeData = input && typeof input.routeData === 'object' && input.routeData !== null
    ? input.routeData
    : {};
  const handover = input && typeof input.handover === 'object' && input.handover !== null
    ? input.handover
    : {};
  const handoverRecorded = input?.handoverRecorded === true;

  const route = {
    totalStops: num(routeData.totalStops),
    totalDue: num(routeData.totalDue),
    collectedStops: num(routeData.collectedStops),
    collectedAmount: num(routeData.collectedAmount),
    pendingStops: num(routeData.pendingStops),
    pendingAmount: num(routeData.pendingAmount),
    completionRate: num(routeData.completionRate),
    roundStatus: str(routeData.roundStatus) || 'NOT_STARTED',
    date: str(routeData.date)
  };

  // Promised figures are view-scoped, exactly like the route strip's
  // own collected/pending figures: they count the stops the route
  // view currently shows, not the whole ledger.
  const stops = Array.isArray(routeData.stops) ? routeData.stops : [];
  let promisedStops = 0;
  let promisedAmount = 0;
  let promisedWithAmount = 0;
  for (const stop of stops) {
    if (!stop || stop.outcome !== 'promised') continue;
    promisedStops++;
    const amount = Number(stop.promiseAmount);
    if (Number.isFinite(amount)) {
      promisedAmount += amount;
      promisedWithAmount++;
    }
  }

  const handoverSummary = {
    expectedCash: num(handover.expectedCash),
    receiptCount: num(handover.receiptCount),
    collectorName: str(handover.collectorName),
    date: str(handover.date)
  };

  const agreement = {
    routeFiguresMatch:
      route.totalStops === num(routeData.totalStops) &&
      route.totalDue === num(routeData.totalDue) &&
      route.collectedStops === num(routeData.collectedStops) &&
      route.collectedAmount === num(routeData.collectedAmount) &&
      route.pendingStops === num(routeData.pendingStops) &&
      route.pendingAmount === num(routeData.pendingAmount),
    handoverFiguresMatch:
      handoverSummary.expectedCash === num(handover.expectedCash) &&
      handoverSummary.receiptCount === num(handover.receiptCount)
  };

  const routeDone = route.roundStatus === 'COMPLETED';
  const steps = FIELD_DAY_FLOW_STEPS.map((step) => {
    let state = 'todo';
    if (step.id === 'route') {
      state = routeDone ? 'done' : 'current';
    } else if (step.id === 'handover') {
      state = handoverRecorded ? 'done' : routeDone ? 'current' : 'todo';
    } else if (step.id === 'reconcile') {
      state = handoverRecorded ? 'done' : 'todo';
    }
    return { ...step, state };
  });

  const nextAction = handoverRecorded
    ? 'Day reconciled'
    : routeDone
      ? 'Open cash handover'
      : 'Continue the route';

  return {
    date: route.date || handoverSummary.date,
    route,
    promised: {
      stops: promisedStops,
      amount: promisedAmount,
      withAmount: promisedWithAmount
    },
    handover: handoverSummary,
    handoverRecorded,
    agreement,
    steps,
    nextAction,
    figuresNote: FIELD_DAY_FLOW_FIGURES_NOTE
  };
}

/**
 * Pure: sanitises a route-sheet view (sector / sort / search / tab)
 * into a storable, restorable shape. Unknown values fall back to the
 * route sheet's own defaults instead of being carried forward.
 */
export function preserveFieldDayView(view = {}) {
  const safeView = view && typeof view === 'object' ? view : {};
  const sector = str(safeView.sector).trim().slice(0, 120) || 'All';
  const sortBy = FIELD_DAY_FLOW_SORT_OPTIONS.includes(safeView.sortBy) ? safeView.sortBy : 'priority';
  const filterTab = FIELD_DAY_FLOW_FILTER_TABS.includes(safeView.filterTab) ? safeView.filterTab : 'all';
  return {
    sector,
    sortBy,
    query: str(safeView.query).trim().slice(0, 200),
    filterTab
  };
}

/**
 * Pure: restores a preserved view, dropping a sector that no longer
 * exists in the route sheet's sector list (it falls back to 'All'
 * instead of filtering the route down to nothing).
 */
export function restoreFieldDayView(saved = {}, availableSectors = []) {
  const view = preserveFieldDayView(saved);
  const sectors = Array.isArray(availableSectors) ? availableSectors : [];
  if (view.sector !== 'All' && !sectors.includes(view.sector)) {
    view.sector = 'All';
  }
  return view;
}

/**
 * Pure: one strip for the route modal — promised total, handover
 * expected cash, the day's steps, and the figures note. All values
 * are escaped; figures come only from the flow object.
 */
export function fieldDayFlowStripHtml(flow = {}) {
  const promised = flow?.promised || {};
  const handover = flow?.handover || {};
  const steps = Array.isArray(flow?.steps) ? flow.steps : [];
  const stepsHtml = steps.map((step) => {
    const mark = step.state === 'done' ? '✓' : step.state === 'current' ? '➤' : '○';
    return `<span class="field-day-flow-step is-${escapeHtml(step.state)}">${escapeHtml(mark)} ${escapeHtml(step.label)}</span>`;
  }).join(' ');
  return `<div class="field-day-flow-strip" data-field-day-flow="1">` +
    `<span class="field-day-flow-pill">🤝 Promised: <strong>${formatAmount(promised.amount)}</strong> (${num(promised.stops)} stops)</span> ` +
    `<span class="field-day-flow-pill">💰 Handover expected: <strong>${formatAmount(handover.expectedCash)}</strong>${handover.collectorName ? ` · ${escapeHtml(handover.collectorName)}` : ''} (${num(handover.receiptCount)} receipts)</span> ` +
    `<span class="field-day-flow-steps">${stepsHtml}</span> ` +
    `<span class="field-day-flow-next">Next: ${escapeHtml(flow?.nextAction || '')}</span> ` +
    `<small class="field-day-flow-note">${escapeHtml(flow?.figuresNote || FIELD_DAY_FLOW_FIGURES_NOTE)}</small>` +
    `</div>`;
}
