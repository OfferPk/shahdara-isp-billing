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

const SERVICE_STATUS_LABELS = Object.freeze({
  active: 'Active',
  offline: 'Offline',
  'not-set': 'Not set',
});

const DISCONNECT_REASON_LABELS = Object.freeze({
  shifted: 'Shifted',
  competitor: 'Competitor',
  affordability: 'Affordability',
  'temporary-travel': 'Temporary travel',
  '': 'Not recorded',
});

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

function moneyLabel(value) {
  if (value === null || value === undefined || value === '') return 'not set';
  const number = Number(value);
  return Number.isFinite(number) ? `PKR ${number}` : 'not set';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function disconnectReasonLabel(reason) {
  return DISCONNECT_REASON_LABELS[reason] ?? 'Not recorded';
}

/**
 * The one canonical lifecycle status for a customer. Returns
 * { key, label, detail } where key is 'archived' | 'on-hold' |
 * 'active' | 'offline' | 'not-set'.
 */
export function resolveLifecycleStatus(customer) {
  const source = customer && typeof customer === 'object' ? customer : {};
  if (source.archived === true) {
    const reason = disconnectReasonLabel(cleanText(source.disconnectReason));
    return {
      key: 'archived',
      label: 'Archived',
      detail: `Disconnected · Reason: ${reason}`,
    };
  }
  const pauseStart = datePart(source.pauseStartDate);
  if (source.paused === true && pauseStart) {
    const resume = datePart(source.autoResumeDate);
    return {
      key: 'on-hold',
      label: 'On hold',
      detail: resume
        ? `Hold since ${pauseStart} · resumes ${resume}`
        : `Hold since ${pauseStart}`,
    };
  }
  const serviceStatus = SERVICE_STATUS_LABELS[source.serviceStatus]
    ? source.serviceStatus
    : 'not-set';
  return {
    key: serviceStatus,
    label: SERVICE_STATUS_LABELS[serviceStatus],
    detail: serviceStatus === 'not-set'
      ? 'Service status not recorded'
      : `Service ${SERVICE_STATUS_LABELS[serviceStatus].toLowerCase()}`,
  };
}

/** Build the full journey for one customer record. Never mutates it. */
export function buildLifecycleJourney(customer) {
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
      title: 'Customer added',
      detail: connectionDate && connectionDate !== addedOn
        ? 'Profile created; connection followed separately.'
        : 'Profile created.',
    });
  }
  if (connectionDate && connectionDate !== addedOn) {
    push({
      type: 'connected',
      date: connectionDate,
      title: 'Connected',
      detail: 'Service connection date recorded.',
    });
  }
  // Package changes, in stored order (sorting below fixes the timeline).
  if (Array.isArray(source.packageHistory)) {
    for (const change of source.packageHistory) {
      if (!change || typeof change !== 'object') continue;
      const date = datePart(change.date);
      if (!date) continue;
      const oldPackage = cleanText(change.oldPackage) || 'not set';
      const newPackage = cleanText(change.newPackage) || 'not set';
      const staff = cleanText(change.staffName);
      push({
        type: 'package-change',
        date,
        title: 'Package changed',
        detail: `${oldPackage} → ${newPackage} · ${moneyLabel(change.oldMonthlyRate)} → ${moneyLabel(change.newMonthlyRate)}${staff ? ` · ${staff}` : ''}`,
      });
    }
  }

  // Service-status flips.
  if (Array.isArray(source.serviceStatusHistory)) {
    for (const entry of source.serviceStatusHistory) {
      if (!entry || typeof entry !== 'object') continue;
      const date = datePart(entry.at);
      if (!date) continue;
      const status = SERVICE_STATUS_LABELS[entry.status] ? entry.status : null;
      if (!status) continue;
      push({
        type: 'service-status',
        date,
        title: `Service ${SERVICE_STATUS_LABELS[status].toLowerCase()}`,
        detail: `Manual service status changed to ${SERVICE_STATUS_LABELS[status].toLowerCase()}.`,
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
      title: 'Hold started',
      detail: resume
        ? `Billing paused · scheduled resume ${resume}.`
        : 'Billing paused · no resume date recorded.',
    });
  }
  const skippedMonths = Array.isArray(source.pauseSkippedMonths)
    ? source.pauseSkippedMonths.filter((m) => typeof m === 'string' && m.trim())
    : [];
  if (source.paused !== true && skippedMonths.length > 0) {
    undatedEvents.push({
      type: 'hold-resumed',
      date: null,
      title: 'Hold ended',
      detail: `Billing resumed after hold · skipped months: ${skippedMonths.join(', ')}. Resume date not recorded.`,
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
      const reason = disconnectReasonLabel(cleanText(entry.disconnectReason));
      const note = cleanText(entry.disconnectNote);
      push({
        type: 'archived',
        date,
        title: 'Disconnected',
        detail: `Reason: ${reason} · Win-back ${entry.winBackEligible === true ? 'eligible' : 'not eligible'}${note ? ` · Note: ${note}` : ''}`,
      });
    }
  }
  if (source.archived === true) {
    const archivedAt = datePart(source.archivedAt);
    if (archivedAt && !historyDates.has(archivedAt)) {
      const reason = disconnectReasonLabel(cleanText(source.disconnectReason));
      const note = cleanText(source.disconnectNote);
      push({
        type: 'archived',
        date: archivedAt,
        title: 'Disconnected',
        detail: `Reason: ${reason} · Win-back ${source.winBackEligible === true ? 'eligible' : 'not eligible'}${note ? ` · Note: ${note}` : ''}`,
      });
    } else if (!archivedAt && historyDates.size === 0) {
      const reason = disconnectReasonLabel(cleanText(source.disconnectReason));
      undatedEvents.push({
        type: 'archived',
        date: null,
        title: 'Disconnected',
        detail: `Reason: ${reason} · archive date not recorded.`,
      });
    }
  }

  // Win-back offer sent (a draft opened, not a reconnection).
  const offerSent = datePart(source.winBackOfferSentAt);
  if (offerSent) {
    push({
      type: 'winback-offer-sent',
      date: offerSent,
      title: 'Win-back offer sent',
      detail: 'Free-reconnection offer draft opened for this customer.',
    });
  }

  // Restore: active now, but disconnect history survives unarchive.
  if (source.archived !== true && historyDates.size > 0) {
    undatedEvents.push({
      type: 'restored',
      date: null,
      title: 'Restored to active',
      detail: 'Previously disconnected, then restored. Restore date not recorded.',
    });
  }

  events.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99);
  });

  const currentStatus = resolveLifecycleStatus(source);
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
export function lifecycleJourneyHtml(journey) {
  if (!journey || typeof journey !== 'object') return '';
  const status = journey.currentStatus ?? { label: 'Not set', detail: '' };
  const dated = (journey.events ?? []).map((event) => `<li><strong>${escapeHtml(event.date)}</strong> — ${escapeHtml(event.title)}<span>${escapeHtml(event.detail)}</span></li>`).join('');
  const undated = (journey.undatedEvents ?? []).map((event) => `<li><strong>Date not recorded</strong> — ${escapeHtml(event.title)}<span>${escapeHtml(event.detail)}</span></li>`).join('');
  const body = dated || undated
    ? `<ol class="lifecycle-timeline">${dated}</ol>${undated ? `<p class="lifecycle-undated-note">Undated events (dates were never recorded, so none is guessed):</p><ol class="lifecycle-timeline lifecycle-undated">${undated}</ol>` : ''}`
    : '<p class="lifecycle-empty">No lifecycle events recorded yet.</p>';
  return `<section class="profile-lifecycle-section" aria-label="Customer lifecycle journey"><h4>Customer journey</h4><p class="lifecycle-status-banner">Current status: <strong>${escapeHtml(status.label)}</strong>${status.detail ? ` · ${escapeHtml(status.detail)}` : ''}</p>${body}</section>`;
}
