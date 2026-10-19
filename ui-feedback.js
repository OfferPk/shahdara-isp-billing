/**
 * One feedback system for the app: stacked toasts + an in-app confirm dialog.
 *
 * - Extends the existing #toast (#220): app.js `toast()` delegates here, so every existing call and
 *   test that looks at `#toast` / `.toast-action-btn` keeps working. The newest toast always lives in
 *   #toast; older ones stay stacked above it until their own timer ends.
 * - Toast: type (success / error / warning / info, inferred from the text when not given), icon, title,
 *   message, up to 2 action buttons (Undo / View / Receipt…), close ×, auto-dismiss with a progress
 *   bar (pauses on hover / focus), safe-area aware, aria-live (errors use role="alert"), dark mode.
 * - confirmDialog(): replaces window.confirm() in customer and payment flows. A <dialog> with a close
 *   button, built on the shared dialog rules (#254/#215): Cancel is the default focus, Escape /
 *   backdrop / × = cancel. Optional third choice ("Archive instead"). Resolves 'confirm' | 'alt' | false.
 * - Customer / payment form polish that needs no app.js change: Save profile is enabled only after
 *   something changed and shows a saving state; payment forms get today's date, inline validation
 *   messages instead of browser bubbles.
 */

export const TOAST_TYPES = {
  success: { icon: '✓', title: 'Done' },
  error: { icon: '!', title: "Couldn't do that" },
  warning: { icon: '⚠', title: 'Check this' },
  info: { icon: 'i', title: 'Note' }
};
const MAX_STACK = 3;

// #297: callers should pass { type } — this guess is only the fallback. Negative wording is checked
// before any "saved / copied / done" word, so "No phone number saved" never becomes a green success.
export function inferToastType(message = '') {
  const m = String(message);
  if (/^\s*(❌|✗|✖)/u.test(m)) return 'error';
  if (/\b(could not|couldn't|cannot|can't|unable to|failed|failure|error|invalid|not allowed|blocked|denied|no longer available|not applied|not found|is required|are required|must be|must have|please enter|please choose|please pick|enter a valid|exceeds?|errors)\b/i.test(m)) return 'error';
  if (/^\s*(⚠|ℹ)/u.test(m)) return /^\s*ℹ/u.test(m) ? 'info' : 'warning';
  if (/^\W*no\b[^.!]*\b(to (export|copy|print|share|apply|resolve|show|undo)|found|match(es)?|yet)\b/i.test(m)) return 'info';
  if (/^\W*(no|nothing)\b/i.test(m)) return 'warning';
  if (/(⚠|\bwarnings?\b|\bduplicate\b|\bnot (available|accessible)\b|\bfirst[.!]?\s*$|\bcheck\b.*\bfirst\b|\bnot saved\b|\bmissing\b|\bunavailable\b|\bnot supported\b|\bwithout\b|\bmay not\b|,\s*but\b|\bbut (the|it|not)\b|\b(please )?(select|choose|save|issue|submit|pick|add)\b[^.!]*\bfirst\b|^\s*please (select|save)\b|^\s*select (a|an)\b)/i.test(m)) return 'warning';
  if (/^\s*(offline mode|working offline)\b/i.test(m)) return 'info';
  if (/(✓|✅|\b(saved|recorded|added|created|deleted|removed|exported|imported|copied|undone|archived|unarchived|restored|applied|waived|updated|ready|sent|done|downloaded|verified|collected|successfully|issued|completed?|fulfilled|resolved|synced|cleared|loaded|transferred|logged|generated|protected|enrolled|prefilled|marked)\b)/i.test(m)) return 'success';
  return 'info';
}

export function inferTitle(type, message = '') {
  if (type !== 'success') return null;
  const m = String(message);
  for (const [re, title] of [[/\bundone\b/i, 'Undone'], [/\bdeleted\b|\bremoved\b/i, 'Deleted'], [/\barchived\b/i, 'Archived'], [/\brecorded\b|\breceived\b/i, 'Recorded'], [/\badded\b|\bcreated\b/i, 'Added'], [/\bexported\b|\bdownloaded\b/i, 'Exported'], [/\bcopied\b/i, 'Copied'], [/\bsaved\b|\bupdated\b|\bapplied\b/i, 'Saved']]) if (re.test(m)) return title;
  return null;
}

/** #297: the toast shows its own icon + title, so drop a leading ✓ / ✅ / ⚠️ / ❌ from the text. */
export function stripLeadingIcon(message = '') {
  return String(message).replace(/^\s*(?:✓|✔️?|✅|☑️?|⚠️?|❌|✗|✖️?|ℹ️?|❗|‼️?)\uFE0F?\s*/u, '');
}

export function defaultDuration(type, hasAction) {
  const base = type === 'error' || type === 'warning' ? 6000 : 4000;
  return hasAction ? Math.max(base, 7000) : base;
}

function normalizeActions(opts) {
  const list = Array.isArray(opts.actions) ? opts.actions.slice() : [];
  if (opts.actionLabel && typeof opts.onAction === 'function') list.unshift({ label: opts.actionLabel, onAction: opts.onAction });
  return list.filter(a => a && a.label && typeof a.onAction === 'function').slice(0, 2);
}

export function createToastSystem(doc = document, win = window) {
  const live = new Set(); // toasts with actions that are still showing, with the dialog they were shown in (origin)
  let stack = doc.getElementById('toastStack');
  if (!stack) {
    stack = doc.createElement('div');
    stack.id = 'toastStack';
    stack.className = 'tsx-stack';
    doc.body.appendChild(stack);
  }
  let main = doc.getElementById('toast');
  if (!main) {
    main = doc.createElement('div');
    main.id = 'toast';
    main.className = 'toast';
    main.hidden = true;
  }
  stack.appendChild(main); // newest at the bottom, nearest the thumb
  main.classList.add('tsx');

  // #292: modal dialogs live in the browser's top layer, so no z-index can lift a normal fixed toast
  // above them (and everything outside a modal is inert). The stack is a manual popover that moves into
  // the top open modal dialog: it stays clickable (a descendant of the modal) and showPopover() puts it
  // above the dialog in the top layer. When that dialog closes the stack moves back to <body>.
  const canPopover = typeof stack.showPopover === 'function';
  if (canPopover) stack.setAttribute('popover', 'manual');
  const topModal = () => {
    const open = [...doc.querySelectorAll('dialog[open]')].filter(d => { try { return d.matches(':modal'); } catch { return true; } });
    if (!open.length) return null;
    const active = doc.activeElement?.closest?.('dialog[open]');
    if (active && open.includes(active)) return active;
    const confirmDlg = open.find(d => d.id === 'appConfirmDialog');
    return confirmDlg || open[open.length - 1];
  };
  // #296: inside an open dialog the toast goes to the top of the screen (dialogs keep their main
  // buttons — Confirm, Undo, Save — in the bottom action bar), and only the newest toast is shown.
  function place() {
    const host = topModal() || doc.body;
    // #303: a toast with an action (Undo, Add phone ...) belongs to the screen or dialog it was shown in. It is never
    // carried into a different dialog, where its Undo would act on something other than what the user is deciding.
    if (host !== doc.body) for (const rec of [...live]) if (rec.origin !== host) dismiss(rec);
    if (stack.parentElement !== host) host.appendChild(stack);
    const inDialog = host !== doc.body;
    stack.classList.toggle('tsx-in-dialog', inDialog);
    if (inDialog) stack.querySelectorAll('.tsx-old').forEach(el => el.remove());
    if (!inDialog) stack.style.removeProperty('top');
    if (canPopover) {
      try { if (stack.matches(':popover-open')) stack.hidePopover(); stack.showPopover(); } catch { /* not connected yet */ }
    }
    if (inDialog) avoidDialogControls(host);
  }

  // #296: inside a dialog, slide the toast to the free band where it covers the fewest controls. Main
  // actions (Confirm / Save / Undo / submit / close ×) weigh most, so they are never covered when any
  // other place is free; ties go to the top of the screen.
  function avoidDialogControls(host) {
    const toastEl = stack.querySelector('.tsx:not([hidden])');
    if (!toastEl) return;
    const vh = win.innerHeight || doc.documentElement.clientHeight;
    const sr = stack.getBoundingClientRect();
    const h = Math.max(48, sr.height);
    const margin = 8;
    const controls = [...host.querySelectorAll('button, a[href], input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])')]
      .filter(el => !stack.contains(el) && el.getClientRects().length)
      .map(el => {
        const r = el.getBoundingClientRect();
        const main = el.matches('.primary-button, [type="submit"], .close-button, [data-close-dialog], [id$="ConfirmBtn"], [id$="UndoBtn"], [id$="CloseBtn"], [id$="DoneCloseBtn"], .danger-button');
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, w: main ? 50 : 1 };
      })
      .filter(r => r.bottom > 0 && r.top < vh && r.right > sr.left && r.left < sr.right);
    let best = null;
    for (let y = margin; y + h <= vh - margin; y += 8) {
      let cost = 0;
      for (const c of controls) {
        const ov = Math.min(y + h, c.bottom) - Math.max(y, c.top);
        if (ov > 0) cost += ov * c.w;
      }
      if (!best || cost < best.cost - 0.5) best = { y, cost };
      if (cost === 0) break;
    }
    if (best) stack.style.top = `${Math.round(best.y)}px`;
  }
  doc.addEventListener('close', e => {
    // #303: when the sheet that showed an action toast closes, that toast (e.g. Quick Collect "Payment recorded · Undo")
    // goes too, so it cannot follow the user to other screens. The sheet's own success screen keeps its Undo button.
    if (e.target?.tagName === 'DIALOG') for (const rec of [...live]) if (rec.origin === e.target) dismiss(rec);
    if (e.target?.tagName === 'DIALOG' && e.target.contains(stack)) win.setTimeout(() => { if (!stack.querySelector('.tsx:not([hidden])')) { doc.body.appendChild(stack); if (canPopover) { try { stack.hidePopover(); } catch {} } } else place(); }, 0);
  }, true);
  // A toast that is already showing when a dialog opens moves above that dialog's backdrop.
  if (typeof win.MutationObserver === 'function') {
    new win.MutationObserver(records => {
      if (!records.some(r => r.target?.tagName === 'DIALOG' && r.target.hasAttribute('open'))) return;
      if (stack.querySelector('.tsx:not([hidden])')) win.setTimeout(place, 0);
    }).observe(doc.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
  }
  place();
  let current = null; // { timer, remaining, startedAt, el }

  function stopTimer(rec) {
    if (rec?.timer) { win.clearTimeout(rec.timer); rec.timer = null; }
  }
  function startTimer(rec, ms) {
    stopTimer(rec);
    rec.remaining = ms;
    rec.startedAt = Date.now();
    rec.timer = win.setTimeout(() => dismiss(rec), ms);
  }
  function pause(rec) {
    if (!rec?.timer) return;
    rec.remaining = Math.max(400, rec.remaining - (Date.now() - rec.startedAt));
    stopTimer(rec);
    rec.el.classList.add('is-paused');
  }
  function resume(rec) {
    if (!rec || rec.timer || rec.dismissed) return;
    rec.el.classList.remove('is-paused');
    startTimer(rec, rec.remaining);
  }
  function dismiss(rec) {
    if (!rec || rec.dismissed) return;
    rec.dismissed = true;
    live.delete(rec);
    stopTimer(rec);
    if (rec.el === main) { main.hidden = true; main.replaceChildren(); if (current === rec) current = null; }
    else rec.el.remove();
  }

  function fill(el, rec, { type, title, message, actions, duration }) {
    const meta = TOAST_TYPES[type] || TOAST_TYPES.info;
    el.dataset.type = type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.classList.remove('is-paused');
    el.replaceChildren();
    const icon = doc.createElement('span');
    icon.className = 'tsx-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = meta.icon;
    const body = doc.createElement('div');
    body.className = 'tsx-body';
    const t = doc.createElement('strong');
    t.className = 'tsx-title';
    t.textContent = title || inferTitle(type, message) || meta.title;
    const text = doc.createElement('span');
    text.className = 'toast-text tsx-message';
    text.textContent = message;
    body.append(t, text);
    el.append(icon, body);
    if (actions.length) {
      const wrap = doc.createElement('div');
      wrap.className = 'tsx-actions';
      actions.forEach((a, i) => {
        const btn = doc.createElement('button');
        btn.type = 'button';
        btn.className = i === 0 ? 'toast-action-btn' : 'toast-action-btn tsx-action-secondary';
        btn.textContent = a.label;
        btn.addEventListener('click', e => {
          e.stopPropagation();
          dismiss(rec);
          try { a.onAction(); } catch (err) { console.error('Toast action failed:', err); }
        });
        wrap.appendChild(btn);
      });
      el.appendChild(wrap);
    }
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'tsx-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.textContent = '×';
    close.addEventListener('click', e => { e.stopPropagation(); dismiss(rec); });
    el.appendChild(close);
    const bar = doc.createElement('span');
    bar.className = 'tsx-progress';
    bar.setAttribute('aria-hidden', 'true');
    bar.style.animationDuration = `${duration}ms`;
    el.appendChild(bar);
    el.onclick = () => dismiss(rec); // #220 behaviour: tap the toast to hide it
    // #296: pause on a real pointer movement over the toast (not when it appears under a still cursor).
    el.onmouseenter = null;
    el.onpointermove = () => pause(rec);
    el.onpointerleave = () => resume(rec);
    el.onfocusin = () => pause(rec);
    el.onfocusout = e => { if (!el.contains(e.relatedTarget)) resume(rec); };
  }

  function show(message, opts = {}) {
    if (message && typeof message === 'object' && !Array.isArray(message)) { opts = message; message = opts.message; }
    const raw = String(message ?? '');
    const type = TOAST_TYPES[opts.type] ? opts.type : inferToastType(raw);
    const text = stripLeadingIcon(raw);
    const actions = normalizeActions(opts);
    // app.js passes 2800 ms by default (#220); give actions / errors enough time to be read.
    const asked = Number(opts.duration);
    const duration = Math.max(Number.isFinite(asked) && asked > 0 ? asked : 0, defaultDuration(type, actions.length > 0));

    // Move the toast that is showing now up into the stack, keeping its own countdown.
    if (current && !current.dismissed && !main.hidden && !stack.classList.contains('tsx-in-dialog') && !topModal()) {
      const old = main.cloneNode(true);
      old.removeAttribute('id');
      old.classList.add('tsx-old');
      old.setAttribute('aria-live', 'off');
      const prev = current;
      pause(prev);
      const rec = { el: old, remaining: prev.remaining, dismissed: false, origin: prev.origin };
      if (live.delete(prev)) live.add(rec); // the copy keeps the old toast's Undo; main is reused below
      // Re-wire buttons on the copy (cloneNode drops listeners).
      const oldActions = prev.actions || [];
      old.querySelectorAll('.toast-action-btn').forEach((b, i) => b.addEventListener('click', e => { e.stopPropagation(); dismiss(rec); try { oldActions[i]?.onAction(); } catch (err) { console.error(err); } }));
      old.querySelector('.tsx-close')?.addEventListener('click', e => { e.stopPropagation(); dismiss(rec); });
      old.onclick = () => dismiss(rec);
      old.onpointermove = () => pause(rec);
      old.onpointerleave = () => resume(rec);
      stack.insertBefore(old, main);
      startTimer(rec, Math.min(rec.remaining, 5000));
      const olds = stack.querySelectorAll('.tsx-old');
      for (let i = 0; i < olds.length - (MAX_STACK - 1); i++) olds[i].remove();
    }
    stopTimer(current);
    const rec = { el: main, dismissed: false, actions, origin: actions.length ? (topModal() || doc.body) : undefined };
    if (actions.length) live.add(rec);
    current = rec;
    fill(main, rec, { type, title: opts.title, message: text, actions, duration });
    main.hidden = false;
    place();
    win.requestAnimationFrame?.(() => { if (stack.classList.contains('tsx-in-dialog')) avoidDialogControls(stack.parentElement); });
    // Restart the progress animation.
    const bar = main.querySelector('.tsx-progress');
    if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; bar.style.animationDuration = `${duration}ms`; }
    startTimer(rec, duration);
    return { dismiss: () => dismiss(rec), element: main, type, duration };
  }

  function clear() {
    stack.querySelectorAll('.tsx-old').forEach(el => el.remove());
    if (current) dismiss(current);
  }
  return { show, clear, stack, place };
}

/* ----------------------------- confirm dialog ----------------------------- */

export function createConfirmDialog(doc = document, win = window) {
  let dlg = doc.getElementById('appConfirmDialog');
  if (!dlg) {
    dlg = doc.createElement('dialog');
    dlg.id = 'appConfirmDialog';
    dlg.className = 'modal app-confirm';
    dlg.setAttribute('data-nested-dialog', ''); // may open over Quick Collect / other sheets (#215 rule)
    dlg.setAttribute('aria-labelledby', 'appConfirmTitle');
    dlg.setAttribute('aria-describedby', 'appConfirmMessage');
    dlg.innerHTML = `
      <div class="app-confirm-head">
        <span class="app-confirm-icon" aria-hidden="true"></span>
        <h2 id="appConfirmTitle" class="app-confirm-title"></h2>
        <button id="appConfirmCloseBtn" class="close-button" type="button" aria-label="Close">×</button>
      </div>
      <p id="appConfirmSubject" class="app-confirm-subject" hidden></p>
      <p id="appConfirmMessage" class="app-confirm-message"></p>
      <label id="appConfirmInputWrap" class="app-confirm-input" hidden><span id="appConfirmInputLabel"></span><input id="appConfirmInput" type="text" autocomplete="off"></label>
      <div class="app-confirm-actions">
        <button id="appConfirmCancelBtn" class="secondary-button app-confirm-btn" type="button">Cancel</button>
        <button id="appConfirmAltBtn" class="secondary-button app-confirm-btn" type="button" hidden></button>
        <button id="appConfirmOkBtn" class="primary-button app-confirm-btn" type="button">OK</button>
      </div>`;
    doc.body.appendChild(dlg);
  }
  const $ = id => doc.getElementById(id);
  let resolver = null;
  const finish = value => {
    const r = resolver;
    resolver = null;
    if (dlg.open) dlg.close();
    if (r) r(value);
  };
  $('appConfirmOkBtn').addEventListener('click', () => finish('confirm'));
  $('appConfirmAltBtn').addEventListener('click', () => finish('alt'));
  $('appConfirmCancelBtn').addEventListener('click', () => finish(false));
  $('appConfirmCloseBtn').addEventListener('click', () => finish(false));
  dlg.addEventListener('close', () => { if (resolver) finish(false); });
  dlg.addEventListener('cancel', e => { e.preventDefault(); finish(false); });

  function confirmDialog(opts = {}) {
    if (typeof opts === 'string') opts = { message: opts };
    if (resolver) finish(false);
    const tone = opts.tone || (opts.danger ? 'danger' : 'default');
    dlg.dataset.tone = tone;
    $('appConfirmTitle').textContent = opts.title || 'Are you sure?';
    dlg.querySelector('.app-confirm-icon').textContent = opts.icon || (tone === 'danger' ? '🗑' : tone === 'warning' ? '⚠' : '?');
    const subject = $('appConfirmSubject');
    subject.textContent = opts.subject || '';
    subject.hidden = !opts.subject;
    $('appConfirmMessage').textContent = opts.message || '';
    const ok = $('appConfirmOkBtn');
    ok.textContent = opts.confirmLabel || 'OK';
    ok.classList.toggle('danger-button', tone === 'danger');
    ok.classList.toggle('warning-button', tone === 'warning');
    $('appConfirmCancelBtn').textContent = opts.cancelLabel || 'Cancel';
    // Optional one-line text field (e.g. "Reason (optional)"); read it from #appConfirmInput after 'confirm'.
    const inputWrap = $('appConfirmInputWrap');
    const input = $('appConfirmInput');
    inputWrap.hidden = !opts.input;
    input.value = '';
    $('appConfirmInputLabel').textContent = opts.input?.label || '';
    input.placeholder = opts.input?.placeholder || '';
    if (opts.input?.maxLength) input.maxLength = opts.input.maxLength; else input.removeAttribute('maxlength');
    const alt = $('appConfirmAltBtn');
    alt.hidden = !opts.altLabel;
    alt.textContent = opts.altLabel || '';
    return new Promise(resolve => {
      resolver = resolve;
      try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
      win.setTimeout(() => $('appConfirmCancelBtn').focus({ preventScroll: true }), 30); // safe default
    });
  }
  return { confirmDialog, dialog: dlg };
}

/* ------------------------- profile + payment polish ------------------------ */

function fieldValues(form) {
  return [...form.querySelectorAll('input, select, textarea')]
    .filter(el => el.type !== 'button' && el.type !== 'submit' && el.type !== 'file')
    .map(el => (el.type === 'checkbox' || el.type === 'radio') ? `${el.id || el.name}:${el.checked}` : `${el.id || el.name}:${el.value}`)
    .join('\u0001');
}

export function setupProfileSaveState(doc = document, win = window) {
  const form = doc.getElementById('customerProfileForm');
  const save = doc.getElementById('saveMohallaButton');
  if (!form || !save) return null;
  let baseline = null;
  const hint = doc.createElement('span');
  hint.id = 'profileSaveHint';
  hint.className = 'profile-save-hint';
  hint.setAttribute('aria-live', 'polite');
  save.insertAdjacentElement('afterend', hint);
  save.setAttribute('aria-describedby', 'profileSaveHint');

  const update = () => {
    if (baseline === null) return;
    const dirty = fieldValues(form) !== baseline;
    save.disabled = !dirty || save.classList.contains('is-saving');
    save.classList.toggle('is-dirty', dirty);
    hint.textContent = dirty ? 'Unsaved changes' : 'No changes yet';
    hint.dataset.state = dirty ? 'dirty' : 'clean';
  };
  const snapshot = () => { baseline = fieldValues(form); save.classList.remove('is-saving'); save.removeAttribute('aria-busy'); update(); };
  const onShown = () => win.setTimeout(snapshot, 0); // after app.js / customer-plan fill the fields
  new win.MutationObserver(() => { if (!form.hidden) onShown(); else baseline = null; })
    .observe(form, { attributes: true, attributeFilter: ['hidden'] });
  if (!form.hidden) onShown();
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  // Saving state: set before app.js's click handler runs; cleared if the form is still open after it
  // (validation stopped the save) or when the form closes.
  save.addEventListener('click', e => {
    if (save.disabled) { e.stopImmediatePropagation(); return; }
    save.classList.add('is-saving');
    save.setAttribute('aria-busy', 'true');
    hint.textContent = 'Saving…';
    win.setTimeout(() => {
      // The in-app duplicate confirm may still be open; keep the saving state until it closes.
      const confirmOpen = doc.getElementById('appConfirmDialog')?.open;
      if (confirmOpen) {
        doc.getElementById('appConfirmDialog').addEventListener('close', () => win.setTimeout(() => { save.classList.remove('is-saving'); save.removeAttribute('aria-busy'); if (form.hidden) baseline = null; else update(); }, 0), { once: true });
        return;
      }
      save.classList.remove('is-saving');
      save.removeAttribute('aria-busy');
      if (!form.hidden) update();
    }, 0);
  }, true);
  return { snapshot, update };
}

const PAYMENT_MESSAGES = {
  amount: { valueMissing: 'Enter the amount received, e.g. 1500.', rangeUnderflow: 'Amount must be more than 0.', stepMismatch: 'Use at most 2 decimals (paisa).', badInput: 'Enter numbers only, e.g. 1500.' },
  date: { valueMissing: 'Pick the payment date.', rangeOverflow: "Payment date can't be in the future.", badInput: 'Pick a valid date.' },
  method: { valueMissing: 'Choose how it was paid (Cash, JazzCash, Easypaisa…).' },
  discount: { rangeUnderflow: "Discount can't be negative.", badInput: 'Enter numbers only.' }
};
function validityKey(v) {
  return ['valueMissing', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'typeMismatch', 'tooLong'].find(k => v[k]) || null;
}

export function pakistanToday(now = new Date()) {
  return new Date(now.getTime() + 5 * 3600 * 1000).toISOString().slice(0, 10);
}

export function setupPaymentFormPolish(doc = document, win = window) {
  const errorFor = (input, create) => {
    const id = `${input.id}-error`;
    let el = doc.getElementById(id);
    if (!el && create) {
      el = doc.createElement('p');
      el.id = id;
      el.className = 'pf-error full';
      el.setAttribute('role', 'alert');
      input.insertAdjacentElement('afterend', el);
    }
    return el;
  };
  const clearError = input => {
    const el = errorFor(input, false);
    if (el) el.remove();
    input.removeAttribute('aria-invalid');
    const described = (input.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== `${input.id}-error`).join(' ');
    if (described) input.setAttribute('aria-describedby', described); else input.removeAttribute('aria-describedby');
  };
  // Inline messages instead of the browser bubble.
  doc.addEventListener('invalid', e => {
    const input = e.target;
    const form = input?.closest?.('form.payment-form');
    if (!form || !input.id) return;
    e.preventDefault();
    const key = validityKey(input.validity);
    const msg = PAYMENT_MESSAGES[input.name]?.[key] || input.validationMessage || 'Check this field.';
    const el = errorFor(input, true);
    el.textContent = msg;
    input.setAttribute('aria-invalid', 'true');
    const described = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
    described.add(el.id);
    input.setAttribute('aria-describedby', [...described].join(' '));
    // Focus the first invalid field of this submit attempt.
    const first = [...form.elements].find(x => x.willValidate && !x.validity.valid);
    if (first === input) win.setTimeout(() => input.focus({ preventScroll: false }), 0);
  }, true);
  const recheck = e => {
    const input = e.target;
    if (!input?.closest?.('form.payment-form') || input.getAttribute('aria-invalid') !== 'true') return;
    if (input.validity.valid) clearError(input);
  };
  doc.addEventListener('input', recheck, true);
  doc.addEventListener('change', recheck, true);

  // Today's date (Pakistan) in empty payment date fields; the form still needs a submit to save.
  const fillDates = root => {
    root.querySelectorAll?.('form.payment-form[data-kind="payment"] input[name="date"]').forEach(input => {
      if (!input.value && !input.dataset.pfDated) {
        input.dataset.pfDated = '1';
        const today = pakistanToday();
        if (!input.max || today <= input.max) input.value = today;
      }
    });
  };
  fillDates(doc);
  new win.MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) fillDates(n); })
    .observe(doc.body, { childList: true, subtree: true });
}


/* ------------------------- customer section (#293) ------------------------- */

const DENSITY_KEY = 'shahdara_customer_density';
export function setupCustomerSection(doc = document, win = window) {
  const list = doc.getElementById('customerList');
  const heading = doc.querySelector('#customerPane .pane-heading') || list?.closest('section, aside, div')?.querySelector('.pane-heading');
  if (!list || !heading) return null;
  // One "+ Add Customer" (screen header). The pane's duplicate "+" is hidden by CSS while the screen header
  // shows, so Bulk add and the field Wizard take its place beside the title as two small buttons.
  const actions = heading.querySelector('.pane-heading-actions') || heading;
  actions.classList.add('cust-add-actions');
  for (const id of ['bulkAddCustomersBtn', 'openEnrollmentWizardBtn']) {
    const b = doc.getElementById(id);
    if (b && b.parentElement !== actions) actions.insertBefore(b, doc.getElementById('addCustomerButton'));
  }
  let toggle = doc.getElementById('customerDensityToggle');
  if (!toggle) {
    toggle = doc.createElement('button');
    toggle.id = 'customerDensityToggle';
    toggle.type = 'button';
    toggle.className = 'cust-density-toggle';
    const jump = doc.querySelector('.sr-filter-jump[data-sr-filters="customers"]');
    let bar = doc.getElementById('customerListToolbar');
    if (!bar) {
      bar = doc.createElement('div');
      bar.id = 'customerListToolbar';
      bar.className = 'cust-list-toolbar';
      if (jump) { jump.insertAdjacentElement('beforebegin', bar); bar.appendChild(jump); }
      else heading.insertAdjacentElement('afterend', bar);
    }
    bar.appendChild(toggle);
  }
  let density = 'compact';
  try { density = win.localStorage.getItem(DENSITY_KEY) || 'compact'; } catch {}
  const apply = () => {
    const compact = density !== 'detailed';
    list.classList.toggle('cust-compact', compact);
    doc.getElementById('archivedCustomerList')?.classList.toggle('cust-compact', compact);
    toggle.textContent = compact ? '☰ Show details' : '▤ Compact list';
    toggle.setAttribute('aria-pressed', String(!compact));
    toggle.title = compact ? 'Show receipts, tenure, health and service buttons on each card' : 'One line per customer';
  };
  toggle.addEventListener('click', () => {
    density = density === 'detailed' ? 'compact' : 'detailed';
    try { win.localStorage.setItem(DENSITY_KEY, density); } catch {}
    apply();
  });
  // "Service status: Not set" on every card says nothing; hide that chip (the profile still shows/edits it).
  const markUnset = () => {
    list.querySelectorAll('.customer-manual-state').forEach(el => el.classList.toggle('is-unset', /not set/i.test(el.textContent)));
    // Compact rows show only the status ("Paid", "Pending"…); the full label stays in aria-label / title.
    list.querySelectorAll('.customer-billing-badge').forEach(el => {
      const full = el.textContent.trim();
      const status = full.includes(':') ? full.split(':').pop().trim() : full;
      const short = /^bill/i.test(status) ? status : `Bill ${status.toLowerCase()}`;
      if (el.dataset.short !== short) { el.dataset.short = short; el.title = full; }
    });
  };
  new win.MutationObserver(markUnset).observe(list, { childList: true, subtree: true });
  markUnset();
  apply();
  return { apply };
}

/* --------------------------------- setup ---------------------------------- */

export function setupUiFeedback(doc = document, win = window) {
  if (win.__uiFeedback) return win.__uiFeedback;
  const toasts = createToastSystem(doc, win);
  const confirmer = createConfirmDialog(doc, win);
  win.__toastImpl = (message, opts) => toasts.show(message, opts || {});
  // Keep window.toast (app.js sets it) and add a richer entry point.
  win.notify = {
    show: (message, opts) => toasts.show(message, opts || {}),
    success: (message, opts = {}) => toasts.show(message, { ...opts, type: 'success' }),
    error: (message, opts = {}) => toasts.show(message, { ...opts, type: 'error' }),
    warning: (message, opts = {}) => toasts.show(message, { ...opts, type: 'warning' }),
    info: (message, opts = {}) => toasts.show(message, { ...opts, type: 'info' }),
    clear: () => toasts.clear()
  };
  if (typeof win.toast !== 'function') win.toast = win.__toastImpl;
  win.appConfirm = confirmer.confirmDialog;
  setupProfileSaveState(doc, win);
  setupPaymentFormPolish(doc, win);
  setupCustomerSection(doc, win);
  win.__uiFeedback = { toasts, confirmDialog: confirmer.confirmDialog };
  return win.__uiFeedback;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setupUiFeedback());
  else setupUiFeedback();
}
