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
 */

export const SCREENS = {
  customers: { view: 'customersView', tab: 'showCustomersButton', title: 'Customers', subtitle: 'Search, add and open customer ledgers', action: { label: '+ Add Customer', click: '#addCustomerButton' }, filters: { selector: '.customer-filter-panel', mobileOnly: false } },
  transactions: { view: 'transactionsView', tab: 'showTransactionsButton', title: 'Transactions', subtitle: 'Every saved payment, newest first', action: { label: '+ Add Payment', click: '#quickAddPaymentButton' }, filters: { selector: '.transaction-filters', mobileOnly: true } },
  reports: { view: 'billingReportsView', tab: 'showReportsButton', title: 'Monthly Report', subtitle: 'Bills, collections and dues for the month', action: { label: '+ Add Payment', click: '#quickAddPaymentButton' } },
  analytics: { view: 'analyticsView', tab: 'showAnalyticsButton', title: 'Area Analytics', subtitle: 'Areas, zones and packages' },
  inventory: { view: 'inventoryView', tab: 'showInventoryButton', title: 'Inventory', subtitle: 'Stock items and movements', action: { label: '+ Add Item', focus: '#inventoryItemForm' } },
  expenses: { view: 'expensesView', tab: 'showExpensesButton', title: 'Expenses', subtitle: 'Business expenses and payroll', action: { label: '+ Add Expense', focus: '#expenseForm' } }
};

export const HOME = 'home';

const TAB_TO_SCREEN = Object.fromEntries(Object.entries(SCREENS).map(([name, s]) => [s.tab, name]));
const TILE_TO_SCREEN = { quickActionRecordExpense: 'expenses', quickActionMonthlyReports: 'reports', quickActionAnalytics: 'analytics' };

/** Parse a location hash into a route, or null when the hash is not a screen route. */
export function parseRoute(hash = '') {
  const raw = String(hash).replace(/^#\/?/, '').trim();
  if (!raw || raw === HOME) return { screen: HOME };
  if (raw.startsWith('customer=')) return { screen: 'customers', customer: true };
  const name = raw.split(/[/?]/)[0];
  if (SCREENS[name]) return { screen: name };
  return null;
}

export const routeHash = screen => `#/${screen}`;

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
    if (SCREENS[target]) return { screen: target };
    if (target === 'alerts') return { screen: 'reports', anchor: '#smartAlertsPanel' };
    if (target === 'recovery') return { screen: 'reports' };
    if (target === 'assistant') return { screen: HOME, anchor: '#ownerCommandCenter' };
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
    if (SCREENS[action]) return { screen: action };
    if (action === 'bills') return { screen: 'reports' };
    if (action === 'alerts') return { screen: 'reports', anchor: '#smartAlertsPanel' };
    if (action === 'recovery') return { screen: 'reports' };
    if (action === 'assistant') return { screen: HOME, anchor: '#ownerCommandCenter' };
    if (action === 'backup') return { screen: HOME, anchor: '#backupControls' };
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
      const form = doc.querySelector(action.focus);
      if (form) {
        form.scrollIntoView({ block: 'start', behavior: 'smooth' });
        form.querySelector('input:not([type=hidden]):not([disabled]), select, textarea')?.focus({ preventScroll: true });
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

  function ensureViewVisible(screen) {
    const spec = SCREENS[screen];
    if (!spec) return;
    const section = doc.getElementById(spec.view);
    if (section && section.hidden) {
      // Ask the app to switch (renders the view); our click listener ignores it while applying.
      applying = true;
      try { doc.getElementById(spec.tab)?.click(); } finally { applying = false; }
    }
  }

  function apply(screen, { anchor = null, scroll = true } = {}) {
    const isHome = screen === HOME;
    if (!isHome) ensureViewVisible(screen);
    current = screen;
    body.dataset.screen = screen;
    body.classList.toggle('sr-screen-mode', !isHome);
    header.hidden = isHome;
    if (!isHome) {
      const spec = SCREENS[screen];
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
    } else {
      doc.title = 'Shahdara ISP Billing';
    }
    if (!scroll) return;
    const target = anchor ? doc.querySelector(anchor) : null;
    // Run after the app's own smooth scrollIntoView so we win the final position.
    win.requestAnimationFrame(() => {
      if (target && !target.hidden) target.scrollIntoView({ block: 'start', behavior: 'instant' });
      else instantTop();
    });
  }

  function navigate(intent, hashBefore) {
    // Home keeps today's layout: dashboard followed by the customer list.
    if (intent.screen === HOME) ensureViewVisible('customers');
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
    const result = nativePush(state, title, url);
    if (!pendingIntent && !applying && url != null) {
      const route = parseRoute(String(url).includes('#') ? String(url).slice(String(url).indexOf('#')) : '');
      if (route && route.screen !== HOME) {
        if (!route.customer) nativeReplace({ ...(state || {}), screen: route.screen }, '', routeHash(route.screen));
        apply(route.screen, { scroll: !route.customer });
      }
    }
    return result;
  };

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
    go(screen) { if (screen === HOME || SCREENS[screen]) navigate({ screen }, win.location.hash); }
  };
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.screenRouter = setupScreenRouter();
}
