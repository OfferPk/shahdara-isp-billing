/**
 * Screen router (first step of #212).
 *
 * Opening a feature from the drawer, bottom tabs, More menu, desktop view tabs or a
 * Home tile shows that feature as its own screen at the top of the page: a title,
 * a "Home" back button and the screen's primary action, followed by the feature
 * section. The Home dashboard and the other sections are collapsed with a body class
 * (never removed), so every existing handler, form and dialog keeps working.
 *
 * Routes: #/home and #/customers, #/transactions, #/reports, #/analytics, #/inventory,
 * #/expenses. Browser Back/forward and deep links (reload) work. Legacy #customers-style
 * hashes and #customer=<id> keep working.
 *
 * The module only observes clicks (capture phase) and history; it never replaces the
 * app's own navigation handlers in app.js / owner-ui.js / nav.js.
 *
 * Quick Collect is a route too (#263): #/collect (also #collect, #quick-collect and the
 * #quick-collect/<customerId> deep link, which preselects that customer). Opening the
 * sheet from anywhere pushes #/collect; phone/browser Back closes it and returns to the screen
 * underneath; a deep link or reload on #/collect opens it. Bulk Collect (#/bulk-collect,
 * bulk-collect.js) stacks on top: one Back closes Bulk and re-opens Quick Collect, while
 * Bulk's × closes both and returns to the screen underneath.
 */

export const SCREENS = {
  customers: { view: 'customersView', tab: 'showCustomersButton', title: 'Customers', subtitle: 'Search, add and open customer ledgers', action: { label: '+ Add Customer', click: '#addCustomerButton' }, filters: { selector: '.customer-filter-panel', mobileOnly: false } },
  transactions: { view: 'transactionsView', tab: 'showTransactionsButton', title: 'Transactions', subtitle: 'Every saved payment, newest first', action: { label: '+ Add Payment', click: '#quickAddPaymentButton' }, filters: { selector: '.transaction-filters', mobileOnly: true } },
  reports: { view: 'billingReportsView', tab: 'showReportsButton', title: 'Monthly Report', subtitle: 'Bills, collections and dues for the month', action: { label: '+ Add Payment', click: '#quickAddPaymentButton' } },
  bills: { view: 'billingReportsView', title: 'Monthly Bills', subtitle: 'Generated bills, due dates and customer billing status', action: { label: '+ Add Payment', click: '#quickAddPaymentButton' } },
  recovery: { view: 'billingReportsView', title: 'Dues Recovery', subtitle: 'Smart recovery triage and WhatsApp reminders', anchor: '#duesRecoveryPanel', action: { label: 'Remind Pending', click: '#bulkReminderDispatchBtn' } },
  alerts: { view: 'billingReportsView', title: 'Smart Alerts', subtitle: 'Local rule-based warnings on bills, collections and expenses', anchor: '#smartAlertsPanel' },
  assistant: { view: 'ownerCommandCenter', title: 'Owner Assistant', subtitle: 'Ask about saved bills, collections, and customer balances', action: { label: 'Ask Question', focus: '#ownerCommandInput' } },
  backup: { view: 'backupControls', title: 'Backup & Restore', subtitle: 'Automatic local backups, JSON snapshots and storage health', action: { label: 'Backup Now', click: '#backupNowButton' } },
  analytics: { view: 'analyticsView', tab: 'showAnalyticsButton', title: 'Area Analytics', subtitle: 'Areas, zones and packages' },
  inventory: { view: 'inventoryView', tab: 'showInventoryButton', title: 'Inventory', subtitle: 'Stock items and movements', action: { label: '+ Add Item', focus: '#inventoryItemForm' } },
  expenses: { view: 'expensesView', tab: 'showExpensesButton', title: 'Expenses', subtitle: 'Business expenses and payroll', action: { label: '+ Add Expense', focus: '#expenseForm' } },
  easypaisa: { view: 'easypaisaView', title: 'Payments Inbox', subtitle: 'Easypaisa transaction emails & statements', action: { label: 'Sync Sheet', click: '#easypaisaSyncBtn' } }
};

export const HOME = 'home';

const TAB_TO_SCREEN = Object.fromEntries(
  Object.entries(SCREENS)
    .filter(([_, s]) => Boolean(s.tab))
    .map(([name, s]) => [s.tab, name])
);
const TILE_TO_SCREEN = { quickActionRecordExpense: 'expenses', quickActionMonthlyReports: 'reports', quickActionAnalytics: 'analytics', homeActionDuesList: 'recovery' };

/** Parse a location hash into a route, or null when the hash is not a screen route. */
export function parseRoute(hash = '') {
  const raw = String(hash).replace(/^#\/?/, '').trim();
  if (!raw || raw === HOME) return { screen: HOME };
  if (raw.startsWith('customer=')) return { screen: 'customers', customer: true };
  if (raw.startsWith('customers/') || raw.startsWith('customer/')) {
    const prefix = raw.startsWith('customers/') ? 'customers/' : 'customer/';
    const customerId = raw.slice(prefix.length).split(/[/?#]/)[0];
    return { screen: 'customers', customer: true, customerId };
  }
  const name = raw.split(/[/?]/)[0];
  if (name === 'payments') return { screen: 'transactions' };
  if (name === 'settings') return { screen: 'backup' };
  if (name === 'dues') return { screen: 'recovery' };
  if (name === 'field-tools' || name === 'tools') return { screen: 'field-tools', modal: true };
  if (SCREENS[name]) return { screen: name };
  return null;
}

export const routeHash = screen => `#/${screen}`;

export const COLLECT_HASH = '#/collect';
/**
 * True for the Quick Collect route: #/collect, #collect, #collect/ and the PWA
 * #quick-collect — including the #quick-collect/<customerId> deep link (Home's
 * Top 5 Overdue "Collect" links). A deep link is an opener, never a screen to
 * return to: opening replaces its history entry with #/collect (no
 * collectFrom), so closing the sheet can never navigate back onto a hash that
 * would reopen it.
 */
export function isCollectHash(hash = '') {
  const raw = String(hash).trim().toLowerCase().replace(/^#\/?/, '').replace(/\/$/, '');
  return raw === 'collect' || raw === 'quick-collect' || raw.startsWith('quick-collect/');
}

/**
 * Customer id carried by a #quick-collect/<customerId> deep link, or null for
 * the plain Quick Collect route and every other hash.
 */
export function quickCollectCustomerIdFromHash(hash = '') {
  const match = String(hash).trim().match(/^#\/?quick-collect\/([^\s/?#]+)/i);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

/**
 * Which screen a click on `element` navigates to, or null if it is not a navigation control.
 * Returns { screen, anchor? }.
 */
export function intentForElement(element) {
  if (!element || typeof element.closest !== 'function') return null;
  const home = element.closest('[data-sr-home]');
  if (home) return { screen: HOME };
  const drawer = element.closest('[data-nav-target]');
  if (drawer) {
    const target = drawer.getAttribute('data-nav-target');
    if (target === 'home') return { screen: HOME };
    if (target === 'payments') return { screen: 'transactions' };
    if (target === 'bills') return { screen: 'bills' };
    if (target === 'settings' || target === 'backup') return { screen: 'backup' };
    if (target === 'dues') return { screen: 'recovery', anchor: '#duesRecoveryPanel' };
    if (target === 'field-tools' || target === 'tools') return { screen: 'field-tools', modal: true };
    if (SCREENS[target]) return { screen: target, anchor: SCREENS[target].anchor };
    return null;
  }
  const tab = element.closest('[data-mobile-nav]');
  if (tab) {
    const action = tab.getAttribute('data-mobile-nav');
    if (action === 'home') return { screen: HOME };
    if (action === 'customers' || action === 'reports') return { screen: action };
    return null; // collection opens Quick Collect, more opens the menu
  }
  const more = element.closest('[data-mobile-more]');
  if (more) {
    const action = more.getAttribute('data-mobile-more');
    if (action === 'payments') return { screen: 'transactions' };
    if (action === 'settings') return { screen: 'backup' };
    if (action === 'dues') return { screen: 'recovery', anchor: '#duesRecoveryPanel' };
    if (action === 'field-tools' || action === 'tools') return { screen: 'field-tools', modal: true };
    if (SCREENS[action]) return { screen: action, anchor: SCREENS[action].anchor };
    return null;
  }
  const viewTab = element.closest('.view-nav-button');
  if (viewTab && TAB_TO_SCREEN[viewTab.id]) return { screen: TAB_TO_SCREEN[viewTab.id] };
  const tile = element.closest('button[id]');
  if (tile && TILE_TO_SCREEN[tile.id]) return { screen: TILE_TO_SCREEN[tile.id] };
  return null;
}

export function setupScreenRouter({ doc = document, win = window } = {}) {
  const body = doc.body;
  const main = doc.getElementById('main');
  if (!body || !main || body.dataset.screenRouter === 'ready') return null;
  body.dataset.screenRouter = 'ready';

  const history = win.history;
  const nativePush = history.pushState.bind(history);
  const nativeReplace = history.replaceState.bind(history);
  let current = null;
  let pendingIntent = null;
  let applying = false;

  const header = doc.createElement('div');
  header.id = 'srScreenHeader';
  header.className = 'sr-screen-header';
  header.hidden = true;
  header.innerHTML = `
    <button type="button" class="sr-back-button" data-sr-home aria-label="Back to Home"><span aria-hidden="true">←</span><span>Home</span></button>
    <div class="sr-title-block"><h1 id="srScreenTitle" class="sr-screen-title" tabindex="-1"></h1><p id="srScreenSubtitle" class="sr-screen-subtitle"></p></div>
    <button type="button" id="srPrimaryAction" class="sr-primary-action" hidden></button>`;
  main.insertBefore(header, main.firstChild);
  const titleEl = header.querySelector('#srScreenTitle');
  const subtitleEl = header.querySelector('#srScreenSubtitle');
  const actionBtn = header.querySelector('#srPrimaryAction');

  actionBtn.addEventListener('click', () => {
    const action = SCREENS[current]?.action;
    if (!action) return;
    if (action.click) {
      doc.querySelector(action.click)?.click();
    } else if (action.focus) {
      const el = doc.querySelector(action.focus);
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
        const input = (typeof el.matches === 'function' && el.matches('input, select, textarea'))
          ? el
          : el.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
        input?.focus({ preventScroll: true });
      }
    }
  });

  // On feature screens the list comes first and the filter panel moves below it (CSS order,
  // same DOM, same handlers). A "Filters & sort" button at the top jumps straight to it.
  let filterSeq = 0;
  for (const [name, spec] of Object.entries(SCREENS)) {
    if (!spec.filters) continue;
    const panel = doc.getElementById(spec.view)?.querySelector(spec.filters.selector);
    if (!panel) continue;
    if (!panel.id) panel.id = `srFilters${++filterSeq}`;
    panel.classList.add('sr-moved-filters');
    if (spec.filters.mobileOnly) panel.classList.add('sr-mobile-only');
    const jump = doc.createElement('button');
    jump.type = 'button';
    jump.className = `sr-filter-jump${spec.filters.mobileOnly ? ' sr-mobile-only' : ''}`;
    jump.dataset.srFilters = name;
    jump.setAttribute('aria-controls', panel.id);
    jump.innerHTML = '<span aria-hidden="true">⚙</span> Filters &amp; sort <span aria-hidden="true">↓</span>';
    jump.addEventListener('click', () => {
      panel.scrollIntoView({ block: 'start', behavior: 'smooth' });
      panel.querySelector('select, input, button')?.focus({ preventScroll: true });
    });
    panel.parentNode.insertBefore(jump, panel);
  }

  const instantTop = () => {
    try { win.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch { win.scrollTo(0, 0); }
  };

  function openFieldToolsModal() {
    const modal = doc.getElementById('fieldToolsModal');
    if (!modal) return;
    try {
      if (!modal.open) {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      }
    } catch {
      modal.setAttribute('open', '');
    }
  }

  doc.getElementById('fieldToolsModal')?.addEventListener('close', () => {
    const modal = doc.getElementById('fieldToolsModal');
    if (modal?._skipHistoryBack) {
      modal._skipHistoryBack = false;
      if (win.location.hash.includes('field-tools') || win.location.hash.includes('tools')) {
        const fallbackScreen = (history.state && history.state.screen && history.state.screen !== 'field-tools')
          ? history.state.screen
          : HOME;
        nativeReplace({ ...(history.state || {}), screen: fallbackScreen }, '', routeHash(fallbackScreen));
        updateNavActive(fallbackScreen);
      }
      return;
    }
    if (win.location.hash.includes('field-tools') || win.location.hash.includes('tools')) {
      if (history.length > 1) history.back();
      else nativeReplace({ ...(history.state || {}), screen: HOME }, '', routeHash(HOME));
    }
  });

  // #364: the app's own switchView() hides five of the six main views, but it
  // only runs on view-tab clicks. Router-driven navigation (browser Back,
  // drawer/sidebar, hash links, deep links) reaches apply() without it, so the
  // previously shown view stayed un-hidden under the next screen. apply() is
  // the single funnel for every path, so the cleanup lives here: after any
  // navigation exactly one main view is un-hidden, the desktop view tabs and
  // the mobile bottom nav highlight the screen actually shown, and the
  // footer backup panel (the Backup screen's content) is closed again.
  const APP_VIEWS = [
    ['customersView', 'showCustomersButton'],
    ['transactionsView', 'showTransactionsButton'],
    ['billingReportsView', 'showReportsButton'],
    ['analyticsView', 'showAnalyticsButton'],
    ['inventoryView', 'showInventoryButton'],
    ['expensesView', 'showExpensesButton']
  ];
  const SCREEN_VIEW = {
    customers: 'customersView',
    transactions: 'transactionsView',
    reports: 'billingReportsView',
    bills: 'billingReportsView',
    recovery: 'billingReportsView',
    alerts: 'billingReportsView',
    analytics: 'analyticsView',
    inventory: 'inventoryView',
    expenses: 'expensesView'
  };
  function syncViewState(screen) {
    const activeView = SCREEN_VIEW[screen] || null;
    for (const [viewId, tabId] of APP_VIEWS) {
      const section = doc.getElementById(viewId);
      if (section && viewId !== activeView) section.setAttribute('hidden', '');
      const tab = doc.getElementById(tabId);
      if (tab) tab.setAttribute('aria-current', viewId === activeView ? 'page' : 'false');
    }
    if (screen !== 'backup') {
      const panel = doc.getElementById('backupControls');
      if (panel && !panel.hidden) {
        panel.setAttribute('hidden', '');
        doc.getElementById('backupControlsToggle')?.setAttribute('aria-expanded', 'false');
      }
    }
    // Mirror switchView()'s mobile mapping so Back/hash navigation cannot
    // leave a stale bottom-nav highlight either.
    const mobileKey = screen === HOME ? 'home'
      : screen === 'customers' ? 'customers'
      : screen === 'transactions' ? 'collection'
      : SCREEN_VIEW[screen] === 'billingReportsView' ? 'reports'
      : 'more';
    doc.querySelectorAll('[data-mobile-nav]').forEach(button => {
      button.setAttribute('aria-current', button.getAttribute('data-mobile-nav') === mobileKey ? 'page' : 'false');
    });
  }

  function updateNavActive(activeScreen) {
    const targets = doc.querySelectorAll('[data-nav-target]');
    targets.forEach(btn => {
      const target = btn.getAttribute('data-nav-target');
      btn.setAttribute('aria-current', target === activeScreen ? 'page' : 'false');
    });
  }

  function ensureViewVisible(screen) {
    if (screen === 'backup') {
      doc.getElementById('backupControls')?.removeAttribute('hidden');
      return;
    }
    if (screen === 'assistant') {
      return;
    }
    if (screen === 'easypaisa') {
      doc.getElementById('easypaisaView')?.removeAttribute('hidden');
      return;
    }
    const spec = SCREENS[screen];
    if (!spec) return;
    const section = doc.getElementById(spec.view);
    const tabId = spec.tab || (spec.view === 'billingReportsView' ? 'showReportsButton' : null);
    if (section && section.hidden && tabId) {
      // Ask the app to switch (renders the view); our click listener ignores it while applying.
      applying = true;
      try { doc.getElementById(tabId)?.click(); } finally { applying = false; }
    }
  }

  function apply(screen, { anchor = null, scroll = true } = {}) {
    if (screen === 'field-tools') {
      openFieldToolsModal();
      updateNavActive('field-tools');
      return;
    }
    const isHome = screen === HOME;
    if (!isHome) {
      ensureViewVisible(screen);
    } else {
      doc.getElementById('customersView')?.setAttribute('hidden', '');
    }
    syncViewState(screen);
    current = screen;
    body.dataset.screen = screen;
    // #287: Bills / Monthly Report / Dues Recovery / Smart Alerts share one view
    // element, but each screen shows only its own sections (CSS keys off this
    // attribute; nothing is removed from the DOM).
    const reportsView = doc.getElementById('billingReportsView');
    if (reportsView) {
      if (screen === 'bills' || screen === 'reports' || screen === 'recovery' || screen === 'alerts') reportsView.dataset.reportScreen = screen;
      else delete reportsView.dataset.reportScreen;
    }
    body.classList.toggle('sr-screen-mode', !isHome);
    header.hidden = isHome;
    updateNavActive(screen);
    if (screen === 'backup') {
      doc.getElementById('backupControls')?.removeAttribute('hidden');
    }
    if (screen === 'easypaisa') {
      doc.getElementById('easypaisaView')?.removeAttribute('hidden');
    } else {
      doc.getElementById('easypaisaView')?.setAttribute('hidden', '');
    }
    if (!isHome) {
      const spec = SCREENS[screen];
      if (spec) {
        titleEl.textContent = spec.title;
        subtitleEl.textContent = spec.subtitle || '';
        if (spec.action) {
          actionBtn.hidden = false;
          actionBtn.textContent = spec.action.label;
          actionBtn.dataset.screenAction = screen;
        } else {
          actionBtn.hidden = true;
        }
        doc.title = `${spec.title} · Shahdara ISP Billing`;
      }
    } else {
      doc.title = 'Shahdara ISP Billing';
    }
    if (!scroll) return;
    win.requestAnimationFrame(() => {
      instantTop();
    });
  }

  function navigate(intent, hashBefore) {
    if (intent.modal || intent.screen === 'field-tools') {
      const url = routeHash('field-tools');
      if (win.location.hash !== url) nativePush({ ...(history.state || {}), screen: 'field-tools' }, '', url);
      openFieldToolsModal();
      return;
    }
    const url = routeHash(intent.screen);
    const changedByApp = win.location.hash !== hashBefore;
    if (win.location.hash !== url) {
      const state = { ...(history.state || {}), screen: intent.screen };
      if (changedByApp) nativeReplace(state, '', url); else nativePush(state, '', url);
    }
    apply(intent.screen, { anchor: intent.anchor });
  }

  // Observe navigation clicks before the app's handlers run, finish after them.
  doc.addEventListener('click', event => {
    if (applying) return;
    const intent = intentForElement(event.target);
    if (!intent) return;
    const hashBefore = win.location.hash;
    pendingIntent = intent;
    win.setTimeout(() => {
      pendingIntent = null;
      navigate(intent, hashBefore);
    }, 0);
  }, true);

  // Navigation the app performs on its own (keyboard shortcuts, search results, customer links).
  history.pushState = function pushState(state, title, url) {
    if (applying) return;
    const target = url != null && String(url).includes('#') ? String(url).slice(String(url).indexOf('#')) : '';
    if (target && isCollectHash(target)) return collect.push(state);
    const useReplace = Boolean(history.state && history.state.modalDialogId);
    const result = useReplace ? nativeReplace(state, title, url) : nativePush(state, title, url);
    if (!pendingIntent && !applying && url != null) {
      const route = parseRoute(String(url).includes('#') ? String(url).slice(String(url).indexOf('#')) : '');
      if (route && route.screen !== HOME) {
        if (!route.customer) nativeReplace({ ...(state || {}), screen: route.screen }, '', routeHash(route.screen));
        apply(route.screen, { scroll: !route.customer });
      }
    }
    return result;
  };

  const collect = setupCollectRoute({ doc, win, nativePush, nativeReplace });

  const onHistory = () => {
    const route = parseRoute(win.location.hash);
    if (!route) return; // e.g. #quick-collect deep links are handled by the app
    apply(route.screen, { scroll: !route.customer });
  };
  win.addEventListener('popstate', onHistory);
  win.addEventListener('hashchange', onHistory);

  // Initial route (deep link / reload). Normalise legacy #customers to #/customers.
  const initial = parseRoute(win.location.hash);
  if (initial && initial.screen !== HOME && !initial.customer && win.location.hash !== routeHash(initial.screen)) {
    nativeReplace({ ...(history.state || {}), screen: initial.screen }, '', routeHash(initial.screen));
  }
  apply(initial ? initial.screen : HOME, { scroll: Boolean(initial && initial.screen !== HOME && !initial.customer) });

  return {
    get current() { return current; },
    collect,
    go(screen) { if (screen === HOME || SCREENS[screen]) navigate({ screen }, win.location.hash); }
  };
}

/**
 * Quick Collect as a history route (#263). Watches the #quickCollectModal `open` attribute,
 * so every way of opening it (bottom-bar Collect, Home tiles, customer "Collect", shortcuts)
 * and closing it (×, Esc, backdrop tap, Bulk Collect taking over) stays in sync with history.
 */
export function setupCollectRoute({ doc, win, nativePush, nativeReplace }) {
  const history = win.history;
  const modal = () => doc.getElementById('quickCollectModal');
  const controller = () => win.quickCollectModalController;
  const hash = () => win.location.hash;
  let openTimer = null;

  function push(state) {
    const from = hash();
    if (isCollectHash(from)) {
      if (from !== COLLECT_HASH) nativeReplace({ ...(history.state || {}), ...(state || {}), collect: true }, '', COLLECT_HASH);
      return undefined;
    }
    return nativePush({ ...(state || {}), collect: true, collectFrom: from || '#/home' }, '', COLLECT_HASH);
  }

  function openSheet(tries = 0, customerId = undefined) {
    win.clearTimeout(openTimer);
    const m = modal();
    if (!isCollectHash(hash()) || m?.open) return;
    const ctl = controller();
    // A #quick-collect/<id> deep link preselects that customer (payment step).
    const targetId = customerId ?? quickCollectCustomerIdFromHash(hash()) ?? undefined;
    if (ctl?.open) { ctl.open(targetId); return; }
    // The controller is set up by app.js after start-up; a deep link can arrive first.
    if (tries < 50) openTimer = win.setTimeout(() => openSheet(tries + 1, targetId), 100);
  }

  function onOpened() {
    if (!isCollectHash(hash())) push(null);
    else if (hash() !== COLLECT_HASH) nativeReplace({ ...(history.state || {}), collect: true }, '', COLLECT_HASH);
  }

  let leaving = false; // a history.back() off #/collect is in flight
  let skipOpen = false; // the next arrival on #/collect should step past it (Bulk × closes both)
  function leave() {
    if (history.state?.collect && history.state.collectFrom) { leaving = true; history.back(); } // back to the screen underneath
    else nativeReplace({ ...(history.state || {}), collect: false }, '', '#/home'); // opened by deep link
  }

  function onClosed() {
    // Defer: Bulk Collect closes this sheet and pushes #/bulk-collect in the same task.
    win.setTimeout(() => {
      if (modal()?.open || !isCollectHash(hash()) || leaving) return;
      leave();
    }, 0);
  }

  function sync() {
    const m = modal();
    if (isCollectHash(hash())) {
      if (leaving) return;
      if (skipOpen) { skipOpen = false; leave(); return; }
      openSheet();
      return;
    }
    leaving = false;
    if (m?.open) {
      if (controller()?.close) controller().close();
      else { try { m.close(); } catch { m.removeAttribute('open'); } }
    }
  }

  let observed = null;
  function observe() {
    const m = modal();
    if (!m || m === observed || typeof win.MutationObserver === 'undefined') return Boolean(m);
    observed = m;
    let wasOpen = m.open;
    new win.MutationObserver(() => {
      if (m.open === wasOpen) return;
      wasOpen = m.open;
      if (m.open) onOpened(); else onClosed();
    }).observe(m, { attributes: true, attributeFilter: ['open'] });
    return true;
  }
  if (!observe()) {
    // Quick Collect's dialog may be injected later.
    const bodyObserver = new win.MutationObserver(() => { if (observe()) bodyObserver.disconnect(); });
    bodyObserver.observe(doc.body, { childList: true, subtree: true });
  }

  win.addEventListener('popstate', sync);
  win.addEventListener('hashchange', sync);
  if (isCollectHash(hash())) {
    // Capture a deep link's customer id before its history entry is normalised
    // to #/collect (the id is not part of the canonical route).
    const deepLinkCustomerId = quickCollectCustomerIdFromHash(hash()) ?? undefined;
    if (hash() !== COLLECT_HASH) nativeReplace({ ...(history.state || {}), collect: true }, '', COLLECT_HASH);
    win.setTimeout(() => openSheet(0, deepLinkCustomerId), 0);
  }
  return { push, open: () => { if (!isCollectHash(hash())) push(null); openSheet(); }, sync, skipNextOpen: () => { skipOpen = true; } };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.screenRouter = setupScreenRouter();
}
