// Plan U — Customer lifecycle journey: one profile timeline, composed from
// the lifecycle pieces the app already records. Presentation only — this
// module never changes a record, a lifecycle rule, or a billing figure.
//
// SOURCES (read verbatim, never recomputed, never backfilled):
//   - onboarding: customer.addedOn, customer.connectionDate
//   - package changes: customer.packageHistory entries
//     { date, oldPackage, newPackage, oldMonthlyRate, newMonthlyRate,
//       staffName } — the audit entries updateCustomerProfile appends.
//   - service status: customer.serviceStatusHistory entries
//     { status, at } — 'active' | 'offline' | 'not-set', timestamped by
//     the same save flow that flips the status.
//   - holds: customer.paused / pauseStartDate / autoResumeDate /
//     pauseSkippedMonths (the vacation-hold fields; a hold that ended
//     has skipped months but no recorded resume date, so its end is
//     reported as an UNDATED event, never with an invented date).
//   - disconnection / win-back: customer.disconnectHistory entries
//     { archivedAt, disconnectReason, winBackEligible, disconnectNote }
//     (SISP-108), the current archivedAt when it is not already in the
//     history (legacy archives pre-date the history), and
//     customer.winBackOfferSentAt.
//   - restore: unarchive clears archivedAt and stamps nothing dated, so
//     a customer who is active now but carries disconnect history gets
//     an UNDATED "restored" event — the restore happened, its date was
//     simply never recorded.
//
// CURRENT STATUS — STATED ONCE, BY ONE RULE (priority order):
//   archived > on hold > manual service status. Every panel that needs
//   the journey status reads resolveLifecycleStatus; the timeline banner
//   is that status, so the profile view never shows two different
//   "current state" answers for one customer. (Seasonal pricing and the
//   suspension shield are pricing/shield states, not lifecycle states,
//   and are deliberately not folded into this status.)
//
// ORDERING: dated events sort oldest first; same-date events follow a
// fixed type order (onboarding before package before status before hold
// before archive before win-back offer) so the timeline is deterministic
// on every render. Undated events are listed separately, after the dated
// timeline, labelled "Date not recorded" — they are never assigned a
// date, and therefore never silently reordered into dated history.

const DATE_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/;

// Plan 601 — labels object: the app passes t('prv_lc_*') values; every
// entry defaults to the exact English string this module used to
// hardcode, so existing callers are unchanged. The module never
// imports t(). `notSet` / `notRecorded` reuse the shared prof_* keys
// (the same words); `notSetMoney` is the lowercase money-label
// 'not set'. Status words are lowercased by the module for the
// composed 'Service {status}' shapes — in Urdu the lowercasing is
// an identity, so the same code serves both languages.
const DEFAULT_LABELS = {
  active: 'Active',
  offline: 'Offline',
  notSet: 'Not set',
  notRecorded: 'Not recorded',
  notSetMoney: 'not set',
  archived: 'Archived',
  disconnectedReason: 'Disconnected · Reason: {reason}',
  onHold: 'On hold',
  holdResumes: 'Hold since {date} · resumes {resume}',
  holdSince: 'Hold since {date}',
  serviceNotRecorded: 'Service status not recorded',
  serviceStatus: 'Service {status}',
  added: 'Customer added',
  addedSeparate: 'Profile created; connection followed separately.',
  addedSame: 'Profile created.',
  connected: 'Connected',
  connectedDetail: 'Service connection date recorded.',
  packageChanged: 'Package changed',
  packageDetail: '{old} → {new} · {oldPrice} → {newPrice}{staff}',
  statusChanged: 'Manual service status changed to {status}.',
  holdStarted: 'Hold started',
  holdResume: 'Billing paused · scheduled resume {date}.',
  holdNoResume: 'Billing paused · no resume date recorded.',
  holdEnded: 'Hold ended',
  holdResumed: 'Billing resumed after hold · skipped months: {months}. Resume date not recorded.',
  disconnected: 'Disconnected',
  disconnectDetail: 'Reason: {reason} · Win-back {eligibility}{note}',
  eligible: 'eligible',
  notEligible: 'not eligible',
  disconnectNote: ' · Note: {note}',
  disconnectNodate: 'Reason: {reason} · archive date not recorded.',
  reasonShifted: 'Shifted',
  reasonCompetitor: 'Competitor',
  reasonAffordability: 'Affordability',
  reasonTravel: 'Temporary travel',
  winbackSent: 'Win-back offer sent',
  winbackDetail: 'Free-reconnection offer draft opened for this customer.',
  restored: 'Restored to active',
  restoredDetail: 'Previously disconnected, then restored. Restore date not recorded.',
  journey: 'Customer journey',
  journeyAria: 'Customer lifecycle journey',
  currentStatus: 'Current status: ',
  dateNotRecorded: 'Date not recorded',
  undatedNote: 'Undated events (dates were never recorded, so none is guessed):',
  noEvents: 'No lifecycle events recorded yet.',
};

const fill = (template, params = {}) =>
  String(template ?? '').replaceAll(
    /\{(\w+)\}/g,
    (match, name) => (params[name] ?? match),
  );

function resolveLabels(labels) {
  return { ...DEFAULT_LABELS, ...(labels ?? {}) };
}

function serviceStatusLabel(status, labels) {
  if (status === 'active') return labels.active;
  if (status === 'offline') return labels.offline;
  return labels.notSet;
}

function disconnectReasonLabel(reason, labels) {
  if (reason === 'shifted') return labels.reasonShifted;
  if (reason === 'competitor') return labels.reasonCompetitor;
  if (reason === 'affordability') return labels.reasonAffordability;
  if (reason === 'temporary-travel') return labels.reasonTravel;
  return labels.notRecorded;
}

const SERVICE_STATUS_KEYS = Object.freeze(['active', 'offline', 'not-set']);

const TYPE_ORDER = Object.freeze({
  added: 0,
  connected: 1,
  'package-change': 2,
  'service-status': 3,
  'hold-started': 4,
  archived: 5,
  'winback-offer-sent': 6,
});

function datePart(value) {
  if (typeof value !== 'string') return null;
  const match = DATE_PATTERN.exec(value.trim());
  return match ? value.trim().slice(0, 10) : null;
}

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function moneyLabel(value, labels) {
  if (value === null || value === undefined || value === '') return labels.notSetMoney;
  const number = Number(value);
  return Number.isFinite(number) ? `PKR ${number}` : labels.notSetMoney;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/**
 * The one canonical lifecycle status for a customer. Returns
 * { key, label, detail } where key is 'archived' | 'on-hold' |
 * 'active' | 'offline' | 'not-set'.
 */
export function resolveLifecycleStatus(customer, labels) {
  const L = resolveLabels(labels);
  const source = customer && typeof customer === 'object' ? customer : {};
  if (source.archived === true) {
    const reason = disconnectReasonLabel(cleanText(source.disconnectReason), L);
    return {
      key: 'archived',
      label: L.archived,
      detail: fill(L.disconnectedReason, { reason }),
    };
  }
  const pauseStart = datePart(source.pauseStartDate);
  if (source.paused === true && pauseStart) {
    const resume = datePart(source.autoResumeDate);
    return {
      key: 'on-hold',
      label: L.onHold,
      detail: resume
        ? fill(L.holdResumes, { date: pauseStart, resume })
        : fill(L.holdSince, { date: pauseStart }),
    };
  }
  const serviceStatus = SERVICE_STATUS_KEYS.includes(source.serviceStatus)
    ? source.serviceStatus
    : 'not-set';
  return {
    key: serviceStatus,
    label: serviceStatusLabel(serviceStatus, L),
    detail: serviceStatus === 'not-set'
      ? L.serviceNotRecorded
      : fill(L.serviceStatus, { status: serviceStatusLabel(serviceStatus, L).toLowerCase() }),
  };
}

/** Build the full journey for one customer record. Never mutates it. */
export function buildLifecycleJourney(customer, labels) {
  const L = resolveLabels(labels);
  const source = customer && typeof customer === 'object' ? customer : {};
  const events = [];
  const undatedEvents = [];
  const push = (event) => {
    if (event.date) events.push(event);
    else undatedEvents.push(event);
  };

  // Onboarding: added, then connected — but only as two events when the
  // dates actually differ. The same day is one onboarding, not two.
  const addedOn = datePart(source.addedOn);
  const connectionDate = datePart(source.connectionDate);
  if (addedOn) {
    push({
      type: 'added',
      date: addedOn,
      title: L.added,
      detail: connectionDate && connectionDate !== addedOn
        ? L.addedSeparate
        : L.addedSame,
    });
  }
  if (connectionDate && connectionDate !== addedOn) {
    push({
      type: 'connected',
      date: connectionDate,
      title: L.connected,
      detail: L.connectedDetail,
    });
  }
  // Package changes, in stored order (sorting below fixes the timeline).
  if (Array.isArray(source.packageHistory)) {
    for (const change of source.packageHistory) {
      if (!change || typeof change !== 'object') continue;
      const date = datePart(change.date);
      if (!date) continue;
      const oldPackage = cleanText(change.oldPackage) || L.notSetMoney;
      const newPackage = cleanText(change.newPackage) || L.notSetMoney;
      const staff = cleanText(change.staffName);
      push({
        type: 'package-change',
        date,
        title: L.packageChanged,
        detail: fill(L.packageDetail, {
          old: oldPackage,
          new: newPackage,
          oldPrice: moneyLabel(change.oldMonthlyRate, L),
          newPrice: moneyLabel(change.newMonthlyRate, L),
          staff: staff ? ` · ${staff}` : '',
        }),
      });
    }
  }

  // Service-status flips.
  if (Array.isArray(source.serviceStatusHistory)) {
    for (const entry of source.serviceStatusHistory) {
      if (!entry || typeof entry !== 'object') continue;
      const date = datePart(entry.at);
      if (!date) continue;
      const status = SERVICE_STATUS_KEYS.includes(entry.status) ? entry.status : null;
      if (!status) continue;
      push({
        type: 'service-status',
        date,
        title: fill(L.serviceStatus, { status: serviceStatusLabel(status, L).toLowerCase() }),
        detail: fill(L.statusChanged, { status: serviceStatusLabel(status, L).toLowerCase() }),
      });
    }
  }

  // Holds: start is dated; an ended hold has no recorded resume date.
  const pauseStart = datePart(source.pauseStartDate);
  if (pauseStart) {
    const resume = datePart(source.autoResumeDate);
    push({
      type: 'hold-started',
      date: pauseStart,
      title: L.holdStarted,
      detail: resume
        ? fill(L.holdResume, { date: resume })
        : L.holdNoResume,
    });
  }
  const skippedMonths = Array.isArray(source.pauseSkippedMonths)
    ? source.pauseSkippedMonths.filter((m) => typeof m === 'string' && m.trim())
    : [];
  if (source.paused !== true && skippedMonths.length > 0) {
    undatedEvents.push({
      type: 'hold-resumed',
      date: null,
      title: L.holdEnded,
      detail: fill(L.holdResumed, { months: skippedMonths.join(', ') }),
    });
  }

  // Disconnections: history entries first, then the current archive when
  // it is not already represented in the history (legacy archives).
  const historyDates = new Set();
  if (Array.isArray(source.disconnectHistory)) {
    for (const entry of source.disconnectHistory) {
      if (!entry || typeof entry !== 'object') continue;
      const date = datePart(entry.archivedAt);
      if (!date) continue;
      historyDates.add(date);
      const reason = disconnectReasonLabel(cleanText(entry.disconnectReason), L);
      const note = cleanText(entry.disconnectNote);
      push({
        type: 'archived',
        date,
        title: L.disconnected,
        detail: fill(L.disconnectDetail, {
          reason,
          eligibility: entry.winBackEligible === true ? L.eligible : L.notEligible,
          note: note ? fill(L.disconnectNote, { note }) : '',
        }),
      });
    }
  }
  if (source.archived === true) {
    const archivedAt = datePart(source.archivedAt);
    if (archivedAt && !historyDates.has(archivedAt)) {
      const reason = disconnectReasonLabel(cleanText(source.disconnectReason), L);
      const note = cleanText(source.disconnectNote);
      push({
        type: 'archived',
        date: archivedAt,
        title: L.disconnected,
        detail: fill(L.disconnectDetail, {
          reason,
          eligibility: source.winBackEligible === true ? L.eligible : L.notEligible,
          note: note ? fill(L.disconnectNote, { note }) : '',
        }),
      });
    } else if (!archivedAt && historyDates.size === 0) {
      const reason = disconnectReasonLabel(cleanText(source.disconnectReason), L);
      undatedEvents.push({
        type: 'archived',
        date: null,
        title: L.disconnected,
        detail: fill(L.disconnectNodate, { reason }),
      });
    }
  }

  // Win-back offer event (a draft opened, not a reconnection).
  const offerSent = datePart(source.winBackOfferSentAt);
  if (offerSent) {
    push({
      type: 'winback-offer-sent',
      date: offerSent,
      title: L.winbackSent,
      detail: L.winbackDetail,
    });
  }

  // Restore: active now, but disconnect history survives unarchive.
  if (source.archived !== true && historyDates.size > 0) {
    undatedEvents.push({
      type: 'restored',
      date: null,
      title: L.restored,
      detail: L.restoredDetail,
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
  });

  const currentStatus = resolveLifecycleStatus(source, labels);
  return {
    customerId: source.id ?? null,
    customerNumber: source.customerNumber ?? null,
    currentStatus,
    archived: source.archived === true,
    events,
    undatedEvents,
    eventCount: events.length + undatedEvents.length,
  };
}

/** Render a journey as profile HTML. All values are escaped. */
export function lifecycleJourneyHtml(journey, labels) {
  const L = resolveLabels(labels);
  if (!journey || typeof journey !== 'object') return '';
  const status = journey.currentStatus ?? { label: L.notSet, detail: '' };
  const dated = (journey.events ?? []).map((event) => `<li><strong>${escapeHtml(event.date)}</strong> — ${escapeHtml(event.title)}<span>${escapeHtml(event.detail)}</span></li>`).join('');
  const undated = (journey.undatedEvents ?? []).map((event) => `<li><strong>${escapeHtml(L.dateNotRecorded)}</strong> — ${escapeHtml(event.title)}<span>${escapeHtml(event.detail)}</span></li>`).join('');
  const body = dated || undated
    ? `<ol class="lifecycle-timeline">${dated}</ol>${undated ? `<p class="lifecycle-undated-note">${escapeHtml(L.undatedNote)}</p><ol class="lifecycle-timeline lifecycle-undated">${undated}</ol>` : ''}`
    : `<p class="lifecycle-empty">${escapeHtml(L.noEvents)}</p>`;
  return `<section class="profile-lifecycle-section" aria-label="${escapeHtml(L.journeyAria)}"><h4>${escapeHtml(L.journey)}</h4><p class="lifecycle-status-banner">${escapeHtml(L.currentStatus)}<strong>${escapeHtml(status.label)}</strong>${status.detail ? ` · ${escapeHtml(status.detail)}` : ''}</p>${body}</section>`;
}
