/**
 * Navigation Drawer & Responsive Navigation Management (agent2 - shahdara-mobile-nav)
 */

import { trapModalFocus, initUniversalDialogController } from './nav-accessibility.js';
import { getPendingCollectionCustomers } from './nav-quick-collect.js';

export function setupNavigationDrawer({
  onNavigate,
  onBackup
} = {}) {
  initUniversalDialogController();
  const toggleBtn = document.getElementById('navDrawerToggle');
  const drawer = document.getElementById('navDrawer');
  const backdrop = document.getElementById('navDrawerBackdrop');
  const closeBtn = document.getElementById('navDrawerClose');

  if (!drawer || !backdrop) return { open: () => {}, close: () => {}, updateActive: () => {} };

  function openDrawer() {
    triggerHaptic('light');
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.classList.add('drawer-open');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    drawer.setAttribute('aria-hidden', 'false');
    // Set focus to close button or first nav item
    const firstFocusable = closeBtn || drawer.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) {
      firstFocusable.focus();
    }
  }

  function closeDrawer() {
    if (!drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.classList.remove('drawer-open');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.focus?.();
    }
    drawer.setAttribute('aria-hidden', 'true');
  }

  function updateActive(viewName) {
    const items = drawer.querySelectorAll('[data-nav-target]');
    items.forEach(btn => {
      const target = btn.getAttribute('data-nav-target');
      btn.setAttribute('aria-current', target === viewName ? 'page' : 'false');
    });
  }

  if (toggleBtn && !toggleBtn.dataset.wiredDrawer) {
    toggleBtn.dataset.wiredDrawer = 'true';
    toggleBtn.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
        if (document.body?.classList?.contains('sidebar-rail-collapsed')) {
          document.body.classList.remove('sidebar-rail-collapsed');
        }
        return;
      }
      if (drawer.classList.contains('is-open')) closeDrawer();
      else openDrawer();
    });
  }

  if (closeBtn && !closeBtn.dataset.wiredDrawer) {
    closeBtn.dataset.wiredDrawer = 'true';
    closeBtn.addEventListener('click', closeDrawer);
  }

  if (backdrop && !backdrop.dataset.wiredDrawer) {
    backdrop.dataset.wiredDrawer = 'true';
    backdrop.addEventListener('click', closeDrawer);
  }

  // Wire navigation items
  const navButtons = drawer.querySelectorAll('[data-nav-target]');
  navButtons.forEach(btn => {
    if (btn.dataset.wiredNav) return;
    btn.dataset.wiredNav = 'true';
    btn.addEventListener('click', () => {
      triggerHaptic('selection');
      const target = btn.getAttribute('data-nav-target');
      closeDrawer();
      if (typeof onNavigate === 'function') {
        onNavigate(target);
      }
    });
  });

  // Wire drawer backup action if present
  const backupBtn = document.getElementById('navDrawerBackupButton');
  if (backupBtn && !backupBtn.dataset.wiredDrawer) {
    backupBtn.dataset.wiredDrawer = 'true';
    backupBtn.addEventListener('click', () => {
      closeDrawer();
      if (typeof onBackup === 'function') {
        onBackup();
      }
    });
  }

  // Wire drawer field diagnostics button if present
  const diagDrawerBtns = drawer.querySelectorAll('[data-open-field-diagnostics]');
  diagDrawerBtns.forEach(btn => {
    if (!btn.dataset.wiredDiagDrawer) {
      btn.dataset.wiredDiagDrawer = 'true';
      btn.addEventListener('click', () => {
        closeDrawer();
      });
    }
  });

  // Wire drawer field route sheet button if present
  const routeDrawerBtns = drawer.querySelectorAll('[data-open-field-route]');
  routeDrawerBtns.forEach(btn => {
    if (!btn.dataset.wiredRouteDrawer) {
      btn.dataset.wiredRouteDrawer = 'true';
      btn.addEventListener('click', () => {
        closeDrawer();
      });
    }
  });

  // Wire drawer optical map button if present
  const opticalDrawerBtns = drawer.querySelectorAll('[data-open-optical-map]');
  opticalDrawerBtns.forEach(btn => {
    if (!btn.dataset.wiredOpticalDrawer) {
      btn.dataset.wiredOpticalDrawer = 'true';
      btn.addEventListener('click', () => {
        closeDrawer();
      });
    }
  });

  // Keyboard navigation: Escape key closes drawer, Tab focus trap
  document.addEventListener('keydown', event => {
    if (!drawer.classList.contains('is-open')) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }

    if (event.key === 'Tab') {
      const focusables = Array.from(
        drawer.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  return {
    open: openDrawer,
    close: closeDrawer,
    updateActive
  };
}

/**
 * Updates live badges on navigation drawer and mobile bottom nav items.
 */
export function updateNavigationBadges(state, options = {}) {
  if (!state) return;
  const hasDoc = typeof document !== 'undefined' && typeof document.querySelectorAll === 'function';

  const customers = Array.isArray(state.customers) ? state.customers : [];
  const totalCustomers = customers.filter(c => !c.archived).length;
  const expensesCount = Array.isArray(state.expenses) ? state.expenses.length : 0;
  const inventoryCount = Array.isArray(state.inventoryItems) ? state.inventoryItems.length : 0;

  let overdueCount = 0;
  let offlineCount = 0;
  for (const c of customers) {
    if (c.archived) continue;
    if (c.status === 'offline') offlineCount++;
  }

  try {
    if (typeof getPendingCollectionCustomers === 'function') {
      const pendingCustomers = getPendingCollectionCustomers(state, '', 'all-dues');
      overdueCount = Array.isArray(pendingCustomers) ? pendingCustomers.length : 0;
    }
  } catch {
    for (const c of customers) {
      if (c.archived) continue;
      if (Array.isArray(c.bills)) {
        const hasUnpaid = c.bills.some(b => Number(b.dueAmount) > 0 && b.status !== 'paid');
        if (hasUnpaid) overdueCount++;
      }
    }
  }

  let queueCount = 0;
  if (typeof options.offlineQueueCount === 'number') {
    queueCount = options.offlineQueueCount;
  } else if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('shahdara_offline_payment_queue');
      if (raw) {
        const q = JSON.parse(raw);
        if (Array.isArray(q)) queueCount = q.length;
      }
    } catch {}
  }

  let workOrdersCount = 0;
  if (typeof options.workOrdersCount === 'number') {
    workOrdersCount = options.workOrdersCount;
  } else if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('shahdara_field_work_orders_v1');
      if (raw) {
        const orders = JSON.parse(raw);
        if (Array.isArray(orders)) {
          workOrdersCount = orders.filter(o => o.status === 'open' || o.status === 'in_progress').length;
        }
      }
    } catch {}
  }
  const pendingWorkOrders = workOrdersCount > 0 ? workOrdersCount : offlineCount;

  let conflictsCount = 0;
  if (typeof options.conflictsCount === 'number') {
    conflictsCount = options.conflictsCount;
  } else if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('shahdara_sync_conflicts_v1');
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          conflictsCount = list.filter(c => c.status === 'pending').length;
        }
      }
    } catch {}
  }

  function setBadges(target, count, label, alertClass = false) {
    if (!hasDoc) return;
    const directBadges = Array.from(document.querySelectorAll(`[data-nav-badge="${target}"]`) || []);
    let aliasBadges = [];
    try {
      aliasBadges = Array.from(document.querySelectorAll(`[data-nav-badge-alias="${target}"]`) || []);
    } catch {}
    const seen = new Set();
    const badges = [...directBadges, ...aliasBadges].filter(b => {
      if (seen.has(b)) return false;
      seen.add(b);
      return true;
    });
    badges.forEach(badge => {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
      if (badge.classList?.toggle) {
        badge.classList.toggle('badge-alert', alertClass);
      }
      if (label && badge.setAttribute) {
        badge.setAttribute('aria-label', `${count} ${label}`);
      }
    });
  }

  setBadges('customers', totalCustomers, 'active customer profiles');
  setBadges('expenses', expensesCount, 'recorded expenses');
  setBadges('inventory', inventoryCount, 'inventory items');
  setBadges('collection', overdueCount, 'subscribers with pending dues', overdueCount > 0);
  setBadges('dues', overdueCount, 'subscribers with pending dues', overdueCount > 0);
  setBadges('field-route', overdueCount, 'stops pending collection', overdueCount > 0);
  setBadges('work-orders', pendingWorkOrders, 'active field work orders', pendingWorkOrders > 0);
  setBadges('sync-conflicts', conflictsCount, 'unresolved sync conflicts', conflictsCount > 0);

  let pendingActionsCount = 0;
  if (typeof options.pendingActionsCount === 'number') {
    pendingActionsCount = options.pendingActionsCount;
  } else if (typeof localStorage !== 'undefined') {
    try {
      const rawProm = localStorage.getItem('shahdara_collection_promises_v1');
      if (rawProm) {
        const promises = JSON.parse(rawProm);
        if (Array.isArray(promises)) {
          const today = new Date().toISOString().slice(0, 10);
          pendingActionsCount += promises.filter(p => p.status === 'pending' && p.promisedDate <= today).length;
        }
      }
    } catch {}
  }
  setBadges('pending-actions', pendingActionsCount, 'pending operational actions', pendingActionsCount > 0);

  let opticalAlertCount = 0;
  if (typeof options.opticalAlertCount === 'number') {
    opticalAlertCount = options.opticalAlertCount;
  }
  setBadges('optical-map', opticalAlertCount, 'optical nodes requiring attention', opticalAlertCount > 0);

  let otdrAlertCount = 0;
  if (typeof options.otdrAlertCount === 'number') {
    otdrAlertCount = options.otdrAlertCount;
  }
  setBadges('otdr-trace', otdrAlertCount, 'optical fiber trace faults', otdrAlertCount > 0);

  setBadges('more', (queueCount + conflictsCount + opticalAlertCount + otdrAlertCount), 'offline queued, conflicts, optical alerts & trace faults', (queueCount + conflictsCount + opticalAlertCount + otdrAlertCount) > 0);

  return {
    totalCustomers,
    overdueCount,
    offlineCount,
    expensesCount,
    inventoryCount,
    queueCount,
    conflictsCount,
    opticalAlertCount,
    otdrAlertCount,
    fieldRoutePendingCount: overdueCount,
    workOrdersCount: pendingWorkOrders,
    pendingActionsCount
  };
}

/**
 * Manages desktop sidebar rail mode toggle (expanded vs collapsed icon rail).
 */
export function setupSidebarRailToggle() {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') {
    return { isRailCollapsed: () => false, toggleRail: () => {} };
  }

  const toggleBtn = document.getElementById('sidebarRailToggle');
  const storage = typeof localStorage !== 'undefined' ? localStorage : null;
  const savedPref = storage?.getItem?.('shahdara_sidebar_rail');

  function applyRailState(collapsed) {
    if (document.body && document.body.classList) {
      document.body.classList.toggle('sidebar-rail-collapsed', collapsed);
    }
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-pressed', collapsed ? 'true' : 'false');
      toggleBtn.setAttribute('title', collapsed ? 'Expand sidebar' : 'Collapse to icon rail');
    }
    try {
      storage?.setItem?.('shahdara_sidebar_rail', collapsed ? 'collapsed' : 'expanded');
    } catch {
      // ignore storage errors
    }
  }

  if (savedPref === 'collapsed') {
    applyRailState(true);
  }

  if (toggleBtn && !toggleBtn.dataset?.wiredRail) {
    if (toggleBtn.dataset) toggleBtn.dataset.wiredRail = 'true';
    else if (toggleBtn.setAttribute) toggleBtn.setAttribute('data-wired-rail', 'true');
    toggleBtn.addEventListener('click', () => {
      const isCurrentlyCollapsed = document.body?.classList?.contains('sidebar-rail-collapsed') ?? false;
      applyRailState(!isCurrentlyCollapsed);
    });
  }

  return {
    isRailCollapsed: () => document.body?.classList?.contains('sidebar-rail-collapsed') ?? false,
    toggleRail: () => {
      const current = document.body?.classList?.contains('sidebar-rail-collapsed') ?? false;
      applyRailState(!current);
    }
  };
}

/**
 * Sets up accessible floating scroll-to-top button.
 */
export function setupScrollToTop() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const btn = document.getElementById('scrollTopButton');
  if (!btn) return;

  if (!btn.dataset?.wiredScroll) {
    if (btn.dataset) btn.dataset.wiredScroll = 'true';
    else if (btn.setAttribute) btn.setAttribute('data-wired-scroll', 'true');

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      btn.blur?.();
    });

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        ticking = true;
        const update = () => {
          const scrollY = typeof window !== 'undefined' ? (window.scrollY || document.documentElement?.scrollTop || 0) : 0;
          const shouldShow = scrollY > 300;
          btn.hidden = !shouldShow;
          btn.classList.toggle('is-visible', shouldShow);
          ticking = false;
        };
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(update);
        } else {
          update();
        }
      }
    }, { passive: true });
  }
}

/**
 * Monitors and displays network connection and offline cache status.
 */
export function setupNetworkStatusIndicator({ onToast } = {}) {
  if (typeof document === 'undefined') {
    return { isOnline: () => true, checkStatus: () => true };
  }

  const pill = document.getElementById('networkStatusPill');
  const dot = document.getElementById('networkStatusDot');
  const text = document.getElementById('networkStatusText');
  const drawerPill = document.getElementById('navDrawerStatusPill');
  const drawerDot = document.getElementById('navDrawerStatusDot');
  const drawerText = document.getElementById('navDrawerStatusText');

  function updateStatus(isOnline) {
    const statusClass = isOnline ? 'online' : 'offline';
    const statusText = isOnline ? 'Online · Cached' : 'Offline · Local Only';
    const drawerLabel = isOnline ? 'Online · Local Ledger' : 'Offline · Local Active';

    if (dot) {
      dot.className = `network-status-dot ${statusClass}`;
    }
    if (text) {
      text.textContent = statusText;
    }
    if (pill) {
      pill.setAttribute('aria-label', `Network status: ${statusText}`);
      pill.classList.toggle('is-offline', !isOnline);
    }
    if (drawerDot) {
      drawerDot.className = `nav-drawer-status-dot ${statusClass}`;
    }
    if (drawerText) {
      drawerText.textContent = drawerLabel;
    }
    if (drawerPill) {
      drawerPill.setAttribute('aria-label', `Network status: ${drawerLabel}`);
      drawerPill.classList.toggle('is-offline', !isOnline);
    }
  }

  const isOnlineNow = () => typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;

  updateStatus(isOnlineNow());

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      updateStatus(true);
      if (typeof onToast === 'function') {
        onToast('Connection restored. App running with cached offline assets.');
      }
    });

    window.addEventListener('offline', () => {
      updateStatus(false);
      if (typeof onToast === 'function') {
        onToast('Offline mode active. All records and changes stay saved on this device.');
      }
    });
  }

  const healthModal = document.getElementById('networkHealthModal');
  const healthCloseBtn = document.getElementById('networkHealthModalClose');
  const healthCloseBtn2 = document.getElementById('healthCloseBtn');
  const healthCheckBtn = document.getElementById('healthCheckConnectionBtn');
  const healthNetworkState = document.getElementById('healthNetworkState');
  const healthNetworkDetail = document.getElementById('healthNetworkDetail');
  const healthStorageDetail = document.getElementById('healthStorageDetail');

  function openHealthModal() {
    triggerHaptic('light');
    const online = isOnlineNow();
    if (healthNetworkState) {
      healthNetworkState.textContent = online ? 'Online · Connected' : 'Offline · Local Mode';
      healthNetworkState.style.color = online ? 'var(--green, #0e5b4d)' : 'var(--amber, #b45309)';
    }
    if (healthNetworkDetail) {
      healthNetworkDetail.textContent = online
        ? 'Browser reports active network connection'
        : 'All records and billing actions operate locally';
    }
    if (healthStorageDetail && typeof localStorage !== 'undefined') {
      try {
        const keysCount = localStorage.length;
        healthStorageDetail.textContent = `${keysCount} storage collections active on device`;
      } catch {
        healthStorageDetail.textContent = 'Storage active on device';
      }
    }
    if (healthModal) {
      if (healthModal.showModal) healthModal.showModal();
      else healthModal.setAttribute('open', '');
    } else if (typeof onToast === 'function') {
      const msg = online
        ? 'Online · App assets cached offline via Service Worker. Ledger stays on this device.'
        : 'Offline mode active. All billing and ledger changes are saved locally to this device.';
      onToast(msg);
    }
  }

  function closeHealthModal() {
    if (!healthModal) return;
    if (healthModal.close) healthModal.close();
    else healthModal.removeAttribute('open');
  }

  if (healthCloseBtn && !healthCloseBtn.dataset?.wiredHealth) {
    if (healthCloseBtn.dataset) healthCloseBtn.dataset.wiredHealth = 'true';
    else if (healthCloseBtn.setAttribute) healthCloseBtn.setAttribute('data-wired-health', 'true');
    healthCloseBtn.addEventListener('click', closeHealthModal);
  }

  if (healthCloseBtn2 && !healthCloseBtn2.dataset?.wiredHealth) {
    if (healthCloseBtn2.dataset) healthCloseBtn2.dataset.wiredHealth = 'true';
    else if (healthCloseBtn2.setAttribute) healthCloseBtn2.setAttribute('data-wired-health', 'true');
    healthCloseBtn2.addEventListener('click', closeHealthModal);
  }

  if (healthCheckBtn && !healthCheckBtn.dataset?.wiredHealth) {
    if (healthCheckBtn.dataset) healthCheckBtn.dataset.wiredHealth = 'true';
    else if (healthCheckBtn.setAttribute) healthCheckBtn.setAttribute('data-wired-health', 'true');
    healthCheckBtn.addEventListener('click', () => {
      triggerHaptic('medium');
      const online = isOnlineNow();
      updateStatus(online);
      if (healthNetworkState) {
        healthNetworkState.textContent = online ? 'Online · Connected' : 'Offline · Local Mode';
        healthNetworkState.style.color = online ? 'var(--green, #0e5b4d)' : 'var(--amber, #b45309)';
      }
      if (typeof onToast === 'function') {
        onToast(online ? 'Connection active. Service worker cache verified.' : 'Device currently offline. Safe to record transactions.');
      }
    });
  }

  if (healthModal) {
    healthModal.addEventListener('click', (e) => {
      if (e.target === healthModal) closeHealthModal();
    });
  }

  function handlePillClick() {
    const online = isOnlineNow();
    updateStatus(online);
    if (healthModal) {
      openHealthModal();
    } else if (typeof onToast === 'function') {
      const msg = online
        ? 'Online · App assets cached offline via Service Worker. Ledger stays on this device.'
        : 'Offline mode active. All billing and ledger changes are saved locally to this device.';
      onToast(msg);
    }
  }

  if (pill && !pill.dataset?.wiredStatus) {
    if (pill.dataset) pill.dataset.wiredStatus = 'true';
    else if (pill.setAttribute) pill.setAttribute('data-wired-status', 'true');
    pill.addEventListener('click', handlePillClick);
  }

  if (drawerPill && !drawerPill.dataset?.wiredStatus) {
    if (drawerPill.dataset) drawerPill.dataset.wiredStatus = 'true';
    else if (drawerPill.setAttribute) drawerPill.setAttribute('data-wired-status', 'true');
    drawerPill.addEventListener('click', handlePillClick);
  }

  function updateSyncStatus({ pendingChanges = 0, isSyncing = false } = {}) {
    if (dot) {
      if (isSyncing) {
        dot.className = 'network-status-dot syncing';
      } else {
        dot.className = `network-status-dot ${isOnlineNow() ? 'online' : 'offline'}`;
      }
    }
    if (text) {
      if (isSyncing) {
        text.textContent = 'Syncing...';
      } else if (pendingChanges > 0) {
        text.textContent = `${pendingChanges} pending`;
      } else {
        text.textContent = isOnlineNow() ? 'Online · Cached' : 'Offline · Local Only';
      }
    }
  }

  return {
    isOnline: isOnlineNow,
    checkStatus: () => {
      const online = isOnlineNow();
      updateStatus(online);
      return online;
    },
    updateStatus,
    updateSyncStatus,
    openHealthModal,
    closeHealthModal
  };
}

/**
 * Sets up global keyboard shortcuts navigation and help modal dialog.
 */
export function setupKeyboardShortcuts({
  onNavigate,
  onToggleTheme,
  onToggleDrawer,
  onToggleRail,
  onSearchFocus,
  onQuickCollect,
  onFastSearch,
  onPendingActions,
  onCollectionRounds,
  onToggleLanguage,
  onTopDefaulters,
  onToast
} = {}) {
  if (typeof document === 'undefined') {
    return { openHelp: () => {}, closeHelp: () => {} };
  }

  const modal = document.getElementById('keyboardShortcutsModal');
  const closeBtn = document.getElementById('shortcutsModalCloseBtn');
  const helpBtn = document.getElementById('shortcutsHelpButton');
  const drawerHelpBtn = document.getElementById('navDrawerShortcutsBtn');
  const moreHelpBtn = document.getElementById('mobileMoreShortcutsBtn');

  let releaseTrap = null;

  function openHelp() {
    if (modal) {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
      releaseTrap = trapModalFocus(modal, {
        onEscape: closeHelp
      });
    }
  }

  function closeHelp() {
    if (releaseTrap) {
      releaseTrap();
      releaseTrap = null;
    }
    if (modal) {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    }
  }

  if (helpBtn && !helpBtn.dataset?.wiredShortcuts) {
    if (helpBtn.dataset) helpBtn.dataset.wiredShortcuts = 'true';
    else if (helpBtn.setAttribute) helpBtn.setAttribute('data-wired-shortcuts', 'true');
    helpBtn.addEventListener('click', openHelp);
  }

  if (moreHelpBtn && !moreHelpBtn.dataset?.wiredShortcuts) {
    if (moreHelpBtn.dataset) moreHelpBtn.dataset.wiredShortcuts = 'true';
    else if (moreHelpBtn.setAttribute) moreHelpBtn.setAttribute('data-wired-shortcuts', 'true');
    moreHelpBtn.addEventListener('click', () => {
      const moreMenu = document.getElementById('mobileMoreMenu');
      if (moreMenu) moreMenu.hidden = true;
      openHelp();
    });
  }

  if (drawerHelpBtn && !drawerHelpBtn.dataset?.wiredShortcuts) {
    if (drawerHelpBtn.dataset) drawerHelpBtn.dataset.wiredShortcuts = 'true';
    else if (drawerHelpBtn.setAttribute) drawerHelpBtn.setAttribute('data-wired-shortcuts', 'true');
    drawerHelpBtn.addEventListener('click', () => {
      const drawer = document.getElementById('navDrawer');
      const backdrop = document.getElementById('navDrawerBackdrop');
      if (drawer) drawer.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-open');
      document.body?.classList?.remove('drawer-open');
      openHelp();
    });
  }

  if (closeBtn && !closeBtn.dataset?.wiredShortcuts) {
    if (closeBtn.dataset) closeBtn.dataset.wiredShortcuts = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired-shortcuts', 'true');
    closeBtn.addEventListener('click', closeHelp);
  }

  if (modal && !modal.dataset?.wiredShortcuts) {
    if (modal.dataset) modal.dataset.wiredShortcuts = 'true';
    else if (modal.setAttribute) modal.setAttribute('data-wired-shortcuts', 'true');
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeHelp();
    });
  }

  let pendingSequence = null;
  let sequenceTimer = null;

  function isEditable(el) {
    if (!el) return false;
    const tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }

  function handleKeydown(event) {
    const active = document.activeElement;
    const targetIsEditable = isEditable(active);

    // Escape closes modals/drawers or blurs input
    if (event.key === 'Escape') {
      if (modal && (modal.open || modal.hasAttribute?.('open'))) {
        event.preventDefault();
        closeHelp();
        return;
      }
      const actionSheet = document.getElementById('mobileActionSheet');
      if (actionSheet && (actionSheet.classList.contains('is-open') || actionSheet.hasAttribute?.('open'))) {
        event.preventDefault();
        actionSheet.classList.remove('is-open');
        const sheetBackdrop = document.getElementById('mobileActionSheetBackdrop');
        if (sheetBackdrop) {
          sheetBackdrop.classList.remove('is-open');
          sheetBackdrop.hidden = true;
        }
        actionSheet.hidden = true;
        return;
      }
      if (targetIsEditable) {
        active.blur?.();
        return;
      }
    }

    if (targetIsEditable) return;

    // Alt + 1..6 navigation
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      const keyNum = event.key;
      const navMap = {
        '1': 'customers',
        '2': 'transactions',
        '3': 'reports',
        '4': 'analytics',
        '5': 'inventory',
        '6': 'expenses'
      };
      if (navMap[keyNum]) {
        event.preventDefault();
        if (typeof onNavigate === 'function') onNavigate(navMap[keyNum]);
        return;
      }

      const altKeyLower = event.key ? event.key.toLowerCase() : '';
      if (altKeyLower === 'c') {
        event.preventDefault();
        if (typeof onQuickCollect === 'function') onQuickCollect();
        else document.getElementById('quickActionTileQuickCollect')?.click();
        return;
      }
      if (altKeyLower === 's') {
        event.preventDefault();
        if (typeof onFastSearch === 'function') onFastSearch();
        else document.getElementById('mobileCustomerSearchTrigger')?.click();
        return;
      }
      if (altKeyLower === 'p') {
        event.preventDefault();
        if (typeof onPendingActions === 'function') onPendingActions();
        else document.getElementById('topbarPendingActionsBtn')?.click();
        return;
      }
      if (altKeyLower === 'r') {
        event.preventDefault();
        if (typeof onCollectionRounds === 'function') onCollectionRounds();
        else document.getElementById('quickActionTileRounds')?.click();
        return;
      }
      if (altKeyLower === 'd') {
        event.preventDefault();
        if (typeof onTopDefaulters === 'function') onTopDefaulters();
        else document.getElementById('quickActionTopDefaulters')?.click();
        return;
      }
      if (altKeyLower === 'l') {
        event.preventDefault();
        if (typeof onToggleLanguage === 'function') onToggleLanguage();
        else document.getElementById('languageToggleBtn')?.click();
        return;
      }
      if (altKeyLower === 't') {
        event.preventDefault();
        if (typeof onToggleTheme === 'function') onToggleTheme();
        else document.getElementById('themeToggle')?.click();
        return;
      }
    }

    // Direct single key shortcuts
    if (!event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        if (modal && (modal.open || modal.hasAttribute?.('open'))) {
          closeHelp();
        } else {
          openHelp();
        }
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        if (typeof onSearchFocus === 'function') {
          onSearchFocus();
        } else {
          const searchInput = document.getElementById('globalCustomerSearch');
          if (searchInput) {
            searchInput.focus();
            searchInput.select?.();
          }
        }
        return;
      }

      const keyLower = event.key ? event.key.toLowerCase() : '';

      // 'g' key sequence handling (check pending sequence first)
      if (pendingSequence === 'g') {
        pendingSequence = null;
        clearTimeout(sequenceTimer);
        const seqMap = {
          d: 'customers',
          h: 'customers',
          c: 'customers',
          t: 'transactions',
          r: 'reports',
          a: 'analytics',
          i: 'inventory',
          e: 'expenses',
          k: 'backup'
        };
        const target = seqMap[keyLower];
        if (target) {
          event.preventDefault();
          if (typeof onNavigate === 'function') onNavigate(target);
          return;
        }
      }

      if (keyLower === 'g' && pendingSequence === null) {
        pendingSequence = 'g';
        clearTimeout(sequenceTimer);
        sequenceTimer = setTimeout(() => {
          pendingSequence = null;
        }, 1200);
        return;
      }

      if (keyLower === 't') {
        event.preventDefault();
        if (typeof onToggleTheme === 'function') {
          onToggleTheme();
        } else {
          document.getElementById('themeToggle')?.click();
        }
        return;
      }

      if (keyLower === 'm') {
        event.preventDefault();
        if (typeof onToggleDrawer === 'function') {
          onToggleDrawer();
        } else {
          document.getElementById('navDrawerToggle')?.click();
        }
        return;
      }

      if (keyLower === 'b') {
        event.preventDefault();
        if (typeof onToggleRail === 'function') {
          onToggleRail();
        } else {
          document.getElementById('sidebarRailToggle')?.click();
        }
        return;
      }

      if (keyLower === 'c') {
        event.preventDefault();
        if (typeof onQuickCollect === 'function') onQuickCollect();
        else document.getElementById('quickActionTileQuickCollect')?.click();
        return;
      }

      if (keyLower === 's') {
        event.preventDefault();
        if (typeof onFastSearch === 'function') onFastSearch();
        else document.getElementById('mobileCustomerSearchTrigger')?.click();
        return;
      }

      if (keyLower === 'p') {
        event.preventDefault();
        if (typeof onPendingActions === 'function') onPendingActions();
        else document.getElementById('topbarPendingActionsBtn')?.click();
        return;
      }

      if (keyLower === 'r') {
        event.preventDefault();
        if (typeof onCollectionRounds === 'function') onCollectionRounds();
        else document.getElementById('quickActionTileRounds')?.click();
        return;
      }

      if (keyLower === 'd') {
        event.preventDefault();
        if (typeof onTopDefaulters === 'function') onTopDefaulters();
        else document.getElementById('quickActionTopDefaulters')?.click();
        return;
      }

      if (keyLower === 'l') {
        event.preventDefault();
        if (typeof onToggleLanguage === 'function') onToggleLanguage();
        else document.getElementById('languageToggleBtn')?.click();
        return;
      }
    }
  }

  document.addEventListener('keydown', handleKeydown);

  return {
    openHelp,
    closeHelp
  };
}

/**
 * Sets up mobile quick actions bottom sheet.
 */
export function setupMobileActionSheet({
  onAction,
  onToast
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      setContext: () => {},
      clearContext: () => {},
      getContext: () => null,
      isOpen: () => false
    };
  }

  const toggleBtn = document.getElementById('mobileActionSheetToggle');
  const sheet = document.getElementById('mobileActionSheet');
  const backdrop = document.getElementById('mobileActionSheetBackdrop');
  const closeBtn = document.getElementById('mobileActionSheetClose');
  const contextBanner = document.getElementById('actionSheetContextBanner');
  const contextName = document.getElementById('actionSheetCustomerName');
  const contextMeta = document.getElementById('actionSheetCustomerMeta');
  const clearContextBtn = document.getElementById('actionSheetClearContextBtn');
  const heading = document.getElementById('mobileActionSheetHeading');

  if (!sheet) {
    return {
      open: () => {},
      close: () => {},
      setContext: () => {},
      clearContext: () => {},
      getContext: () => null,
      isOpen: () => false
    };
  }

  let activeContext = null;

  function updateContextUi() {
    const contextualButtons = sheet.querySelectorAll('.contextual-action');
    if (activeContext && activeContext.customerId) {
      if (contextBanner) contextBanner.hidden = false;
      if (contextName) contextName.textContent = activeContext.customerName || 'Customer Profile';
      if (contextMeta) {
        const parts = [];
        if (typeof activeContext.balance === 'number') {
          parts.push(`Balance: Rs. ${activeContext.balance.toLocaleString()}`);
        }
        if (activeContext.phone) {
          parts.push(activeContext.phone);
        }
        contextMeta.textContent = parts.join(' · ');
      }
      if (heading) heading.textContent = 'Customer Actions';
      contextualButtons.forEach(btn => { btn.hidden = false; });
    } else {
      if (contextBanner) contextBanner.hidden = true;
      if (heading) heading.textContent = 'Quick Actions';
      contextualButtons.forEach(btn => { btn.hidden = true; });
    }
  }

  function setContext(context) {
    activeContext = context ? { ...context } : null;
    updateContextUi();
  }

  function clearContext() {
    activeContext = null;
    updateContextUi();
  }

  function openSheet(context) {
    if (context) {
      setContext(context);
    }
    triggerHaptic('light');
    sheet.hidden = false;
    if (backdrop) backdrop.hidden = false;
    const activate = () => {
      sheet.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    };
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(activate);
    } else {
      activate();
    }
    const firstFocusable = sheet.querySelector('button:not([hidden]), [href], input, [tabindex]:not([tabindex="-1"])');
    firstFocusable?.focus?.();
  }

  function closeSheet() {
    sheet.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.focus?.();
    }
    setTimeout(() => {
      if (!sheet.classList.contains('is-open')) {
        sheet.hidden = true;
        if (backdrop) backdrop.hidden = true;
      }
    }, 220);
  }

  if (toggleBtn && !toggleBtn.dataset?.wiredSheet) {
    if (toggleBtn.dataset) toggleBtn.dataset.wiredSheet = 'true';
    else if (toggleBtn.setAttribute) toggleBtn.setAttribute('data-wired-sheet', 'true');
    toggleBtn.addEventListener('click', () => {
      if (sheet.classList.contains('is-open')) closeSheet();
      else openSheet();
    });
  }

  if (closeBtn && !closeBtn.dataset?.wiredSheet) {
    if (closeBtn.dataset) closeBtn.dataset.wiredSheet = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired-sheet', 'true');
    closeBtn.addEventListener('click', closeSheet);
  }

  if (clearContextBtn && !clearContextBtn.dataset?.wiredClearContext) {
    if (clearContextBtn.dataset) clearContextBtn.dataset.wiredClearContext = 'true';
    else if (clearContextBtn.setAttribute) clearContextBtn.setAttribute('data-wired-clear-context', 'true');
    clearContextBtn.addEventListener('click', () => {
      triggerHaptic('light');
      clearContext();
    });
  }

  if (backdrop && !backdrop.dataset?.wiredSheet) {
    if (backdrop.dataset) backdrop.dataset.wiredSheet = 'true';
    else if (backdrop.setAttribute) backdrop.setAttribute('data-wired-sheet', 'true');
    backdrop.addEventListener('click', closeSheet);
  }

  // Touch swipe-down to dismiss
  let startY = 0;
  if (typeof sheet.addEventListener === 'function') {
    sheet.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        startY = e.touches[0].clientY;
      }
    }, { passive: true });

    sheet.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        const currentY = e.touches[0].clientY;
        if (currentY - startY > 75) {
          closeSheet();
        }
      }
    }, { passive: true });
  }

  // Mobile Bottom Nav swipe-up to open sheet
  const bottomNav = (typeof document !== 'undefined') ? (document.querySelector?.('.mobile-bottom-nav') || document.getElementById('mobileBottomNav')) : null;
  let navTouchStartY = 0;
  let navTouchStartX = 0;
  if (bottomNav && typeof bottomNav.addEventListener === 'function' && !bottomNav.dataset?.wiredSwipeSheet) {
    if (bottomNav.dataset) bottomNav.dataset.wiredSwipeSheet = 'true';
    bottomNav.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        navTouchStartY = e.touches[0].clientY;
        navTouchStartX = e.touches[0].clientX;
      }
    }, { passive: true });

    bottomNav.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const deltaY = e.changedTouches[0].clientY - navTouchStartY;
        const deltaX = Math.abs(e.changedTouches[0].clientX - navTouchStartX);
        if (deltaY < -40 && Math.abs(deltaY) > deltaX) {
          openSheet();
        }
      }
    }, { passive: true });
  }

  // Action buttons inside sheet
  const actionButtons = sheet.querySelectorAll('[data-sheet-action]');
  actionButtons.forEach(btn => {
    if (btn.dataset?.wiredAction) return;
    if (btn.dataset) btn.dataset.wiredAction = 'true';
    else if (btn.setAttribute) btn.setAttribute('data-wired-action', 'true');
    btn.addEventListener('click', () => {
      triggerHaptic('medium');
      const action = btn.getAttribute('data-sheet-action');
      const ctx = activeContext;
      closeSheet();
      if (typeof onAction === 'function') {
        onAction(action, ctx);
      }
    });
  });

  return {
    open: openSheet,
    close: closeSheet,
    setContext,
    clearContext,
    getContext: () => activeContext,
    isOpen: () => sheet.classList.contains('is-open')
  };
}

/**
 * Triggers subtle device haptic feedback when navigator.vibrate is available.
 * @param {'light'|'medium'|'heavy'|'success'|'selection'} type
 */
export function triggerHaptic(type = 'light') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  try {
    const patterns = {
      light: 8,
      medium: 18,
      heavy: 32,
      selection: 6,
      success: [10, 30, 15]
    };
    const pattern = patterns[type] ?? 8;
    return navigator.vibrate(pattern);
  } catch {
    return false;
  }
}

/**
 * Sets up an accessible mobile touch pull-to-refresh controller on target scroll container.
 * Shows elastic pull indicator, triggers haptic feedback, and invokes onRefresh callback.
 */
export function setupPullToRefresh({
  targetContainerId = 'customerPane',
  indicatorId = 'pullToRefreshIndicator',
  containerSelector,
  indicatorSelector,
  onRefresh,
  pullThreshold = 65
} = {}) {
  if (typeof document === 'undefined') return { destroy: () => {} };

  const container = (containerSelector && document.querySelector ? document.querySelector(containerSelector) : null)
    || (document.getElementById ? document.getElementById(targetContainerId) : null)
    || (document.querySelector ? document.querySelector(`#${targetContainerId}`) : null);

  const indicator = (indicatorSelector && document.querySelector ? document.querySelector(indicatorSelector) : null)
    || (document.getElementById ? document.getElementById(indicatorId) : null)
    || (document.querySelector ? document.querySelector(`#${indicatorId}`) : null);

  if (!container || !indicator) return { destroy: () => {} };

  let startY = 0;
  let currentPull = 0;
  let isPulling = false;
  let isRefreshing = false;

  function onTouchStart(e) {
    if (isRefreshing) return;
    const scrollEl = container.scrollTop !== undefined ? container.scrollTop : (window.scrollY || 0);
    if (scrollEl > 0) return;

    if (e.touches && e.touches[0]) {
      startY = e.touches[0].clientY;
      isPulling = true;
    }
  }

  function onTouchMove(e) {
    if (!isPulling || isRefreshing) return;
    if (e.touches && e.touches[0]) {
      const y = e.touches[0].clientY;
      const diff = y - startY;
      if (diff > 0) {
        currentPull = Math.min(100, Math.pow(diff, 0.85));
        indicator.style.transform = `translateY(${currentPull}px)`;
        indicator.classList.toggle('is-pulling', currentPull > 10);
        indicator.classList.toggle('ready-to-refresh', currentPull >= pullThreshold);
      }
    }
  }

  async function onTouchEnd() {
    if (!isPulling || isRefreshing) return;
    isPulling = false;

    if (currentPull >= pullThreshold) {
      isRefreshing = true;
      triggerHaptic('success');
      indicator.classList.remove('ready-to-refresh');
      indicator.classList.add('is-refreshing');
      indicator.style.transform = `translateY(${pullThreshold}px)`;
      const statusText = indicator.querySelector('.pull-refresh-text');
      if (statusText) statusText.textContent = 'Updating ledger...';

      if (typeof onRefresh === 'function') {
        try {
          await onRefresh();
        } catch {
          // ignore
        }
      }

      setTimeout(() => {
        indicator.classList.remove('is-refreshing');
        indicator.style.transform = 'translateY(0)';
        if (statusText) statusText.textContent = 'Pull to refresh';
        isRefreshing = false;
        currentPull = 0;
      }, 350);
    } else {
      indicator.style.transform = 'translateY(0)';
      indicator.classList.remove('is-pulling', 'ready-to-refresh');
      currentPull = 0;
    }
  }

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });

  return {
    destroy: () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    }
  };
}

/**
 * Sets up the Global Omni Command Palette (Ctrl+K / Cmd+K).
 * Instant jump bar across navigation views, quick actions, and customer accounts.
 */
export function setupCommandPalette({
  getState,
  onNavigate,
  onAction,
  onSelectCustomer,
  onToggleTheme,
  onToggleRail
} = {}) {
  if (typeof document === 'undefined') return { open: () => {}, close: () => {} };

  const modal = document.getElementById('commandPaletteModal');
  const triggerBtn = document.getElementById('commandPaletteTrigger');
  const input = document.getElementById('commandPaletteInput');
  const resultsContainer = document.getElementById('commandPaletteResults');
  const closeBtn = document.getElementById('commandPaletteClose');

  if (!modal || !input || !resultsContainer) return { open: () => {}, close: () => {} };

  let activeIndex = 0;
  let currentItems = [];

  const STATIC_COMMANDS = [
    { id: 'nav-dash', type: 'page', title: 'Dashboard / Live Summary', hint: 'Jump to performance KPIs & charts', icon: '📊', action: () => onNavigate?.('dashboard') },
    { id: 'nav-cust', type: 'page', title: 'Customer Roster', hint: 'View all subscriber profiles & history', icon: '👥', action: () => onNavigate?.('customers') },
    { id: 'nav-tx', type: 'page', title: 'Transaction Ledger', hint: 'Receipts & payment allocations', icon: '💳', action: () => onNavigate?.('transactions') },
    { id: 'nav-rep', type: 'page', title: 'Monthly Reports', hint: 'Closing snapshots & reconciliation', icon: '📑', action: () => onNavigate?.('reports') },
    { id: 'nav-inv', type: 'page', title: 'Stock & Inventory', hint: 'Hardware units & movements', icon: '📦', action: () => onNavigate?.('inventory') },
    { id: 'nav-exp', type: 'page', title: 'Operational Expenses', hint: 'Dated ISP expense ledger', icon: '💸', action: () => onNavigate?.('expenses') },
    { id: 'nav-area', type: 'page', title: 'Area Intelligence', hint: 'ARPU & zone metrics', icon: '📍', action: () => onNavigate?.('analytics') },
    { id: 'act-pay', type: 'action', title: '+ Receive Customer Payment', hint: 'Quick cash receipt modal', icon: '💰', action: () => onAction?.('add-payment') },
    { id: 'act-cust', type: 'action', title: '+ New Subscriber Connection', hint: 'Register new customer profile', icon: '➕', action: () => onAction?.('add-customer') },
    { id: 'act-exp', type: 'action', title: '+ Record Dated Expense', hint: 'Log operational spending', icon: '📝', action: () => onAction?.('add-expense') },
    { id: 'act-theme', type: 'action', title: 'Toggle Dark / Light Theme', hint: 'Switch application color mode', icon: '🌓', action: () => onToggleTheme?.() },
    { id: 'act-rail', type: 'action', title: 'Toggle Desktop Sidebar Rail', hint: 'Expand / collapse compact icon rail', icon: '📐', action: () => onToggleRail?.() }
  ];

  function openPalette() {
    triggerHaptic('light');
    if (modal.showModal) modal.showModal();
    else modal.setAttribute('open', '');
    input.value = '';
    activeIndex = 0;
    renderResults('');
    setTimeout(() => input.focus(), 20);
  }

  function closePalette() {
    if (modal.close) modal.close();
    else modal.removeAttribute('open');
  }

  function renderResults(query) {
    const q = String(query).trim().toLowerCase();
    let matches = [];

    if (!q) {
      matches = STATIC_COMMANDS;
    } else {
      const staticMatches = STATIC_COMMANDS.filter(cmd =>
        cmd.title.toLowerCase().includes(q) ||
        cmd.hint.toLowerCase().includes(q)
      );

      let customerMatches = [];
      const state = typeof getState === 'function' ? getState() : null;
      if (state && Array.isArray(state.customers)) {
        customerMatches = state.customers
          .filter(c => !c.archived && (
            (c.name && c.name.toLowerCase().includes(q)) ||
            (c.phone && c.phone.includes(q)) ||
            (c.customerNumber && String(c.customerNumber).includes(q)) ||
            (c.area && c.area.toLowerCase().includes(q))
          ))
          .slice(0, 6)
          .map(c => ({
            id: `cust-${c.id}`,
            type: 'customer',
            title: c.name,
            hint: `#${c.customerNumber} · ${c.area || 'Unassigned'} · ${c.serviceStatus || 'not-set'}`,
            icon: '👤',
            action: () => onSelectCustomer?.(c)
          }));
      }

      matches = [...staticMatches, ...customerMatches];
    }

    currentItems = matches;
    if (activeIndex >= currentItems.length) activeIndex = 0;

    if (currentItems.length === 0) {
      resultsContainer.innerHTML = `
        <div class="palette-empty-state">
          <p>No matching commands or subscribers for <strong>"${escapeHtml(q)}"</strong></p>
          <small>Try searching "payment", "customer", "inventory", or an account name</small>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = currentItems.map((item, idx) => {
      const isSelected = idx === activeIndex;
      return `
        <div class="palette-item ${isSelected ? 'is-selected' : ''}" data-palette-index="${idx}" role="option" aria-selected="${isSelected ? 'true' : 'false'}">
          <span class="palette-item-icon" aria-hidden="true">${item.icon}</span>
          <div class="palette-item-text">
            <div class="palette-item-title">
              <span>${escapeHtml(item.title)}</span>
              <span class="palette-type-tag tag-${item.type}">${item.type}</span>
            </div>
            <div class="palette-item-hint">${escapeHtml(item.hint)}</div>
          </div>
          <kbd class="palette-enter-hint">↵</kbd>
        </div>
      `;
    }).join('');

    const selEl = resultsContainer.querySelector ? resultsContainer.querySelector('.palette-item.is-selected') : null;
    selEl?.scrollIntoView?.({ block: 'nearest' });
  }

  function executeItem(index) {
    const item = currentItems[index];
    if (!item) return;
    triggerHaptic('medium');
    closePalette();
    if (typeof item.action === 'function') {
      item.action();
    }
  }

  input.addEventListener('input', () => {
    activeIndex = 0;
    renderResults(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentItems.length > 0) {
        activeIndex = (activeIndex + 1) % currentItems.length;
        triggerHaptic('selection');
        updateSelectionHighlight();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentItems.length > 0) {
        activeIndex = (activeIndex - 1 + currentItems.length) % currentItems.length;
        triggerHaptic('selection');
        updateSelectionHighlight();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeItem(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  });

  function updateSelectionHighlight() {
    if (!resultsContainer.querySelectorAll) return;
    const items = resultsContainer.querySelectorAll('.palette-item');
    items.forEach((el, idx) => {
      const isSel = idx === activeIndex;
      el.classList.toggle('is-selected', isSel);
      el.setAttribute('aria-selected', isSel ? 'true' : 'false');
      if (isSel) el.scrollIntoView({ block: 'nearest' });
    });
  }

  resultsContainer.addEventListener('click', (e) => {
    const itemEl = e.target.closest('.palette-item');
    if (!itemEl) return;
    const idx = parseInt(itemEl.getAttribute('data-palette-index'), 10);
    if (!isNaN(idx)) {
      executeItem(idx);
    }
  });

  if (triggerBtn && !triggerBtn.dataset?.wiredPalette) {
    if (triggerBtn.dataset) triggerBtn.dataset.wiredPalette = 'true';
    else if (triggerBtn.setAttribute) triggerBtn.setAttribute('data-wired-palette', 'true');
    triggerBtn.addEventListener('click', openPalette);
  }

  if (closeBtn && !closeBtn.dataset?.wiredPalette) {
    if (closeBtn.dataset) closeBtn.dataset.wiredPalette = 'true';
    else if (closeBtn.setAttribute) closeBtn.setAttribute('data-wired-palette', 'true');
    closeBtn.addEventListener('click', closePalette);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closePalette();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'k') {
      e.preventDefault();
      if (modal.open || modal.hasAttribute('open')) closePalette();
      else openPalette();
    }
  });

  return {
    open: openPalette,
    close: closePalette
  };
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

/**
 * Sets up Mobile Gesture Swipe Navigation between adjacent primary ledger tabs.
 * Allows smooth horizontal flick/swipe left/right to transition between views.
 * Includes edge rejection, vertical scroll preservation, interactive element exclusion,
 * visual floating indicator pill, and tactile haptic response.
 */
export function setupSwipeNavigation({
  container = (typeof document !== 'undefined' ? (document.getElementById('main') || document.body) : null),
  views = ['customers', 'transactions', 'reports', 'analytics', 'inventory', 'expenses'],
  viewLabels = {
    customers: 'Customers',
    transactions: 'Transactions',
    reports: 'Monthly Report',
    analytics: 'Area Analytics',
    inventory: 'Inventory',
    expenses: 'Expenses'
  },
  getCurrentView,
  onNavigate,
  threshold = 60,
  maxVertical = 50,
  edgeMargin = 20,
  showHint = true
} = {}) {
  if (!container || typeof document === 'undefined') {
    return {
      destroy: () => {},
      enable: () => {},
      disable: () => {},
      next: () => null,
      prev: () => null,
      getCurrentView: () => 'customers'
    };
  }

  let isEnabled = true;
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let isTracking = false;
  let isHorizontalCandidate = false;

  const defaultGetCurrentView = () => {
    if (typeof getCurrentView === 'function') return getCurrentView();
    const map = [
      ['customers', 'customersView'],
      ['transactions', 'transactionsView'],
      ['reports', 'billingReportsView'],
      ['analytics', 'analyticsView'],
      ['inventory', 'inventoryView'],
      ['expenses', 'expensesView']
    ];
    for (const [name, id] of map) {
      const el = document.getElementById(id);
      if (el && !el.hidden) return name;
    }
    return views[0] || 'customers';
  };

  // Create or get swipe hint indicator element
  let indicator = document.getElementById('swipeNavIndicator');
  if (!indicator && showHint && typeof document.createElement === 'function') {
    indicator = document.createElement('div');
    indicator.id = 'swipeNavIndicator';
    indicator.className = 'swipe-nav-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.innerHTML = '<span class="swipe-indicator-arrow"></span><span class="swipe-indicator-label"></span>';
    if (document.body && document.body.appendChild) {
      document.body.appendChild(indicator);
    }
  }

  function showIndicator(direction, targetView) {
    if (!indicator || !showHint) return;
    const arrow = indicator.querySelector ? indicator.querySelector('.swipe-indicator-arrow') : null;
    const label = indicator.querySelector ? indicator.querySelector('.swipe-indicator-label') : null;
    const displayLabel = viewLabels[targetView] || targetView;
    if (direction === 'next') {
      if (arrow) arrow.textContent = '→';
      if (label) label.textContent = displayLabel;
      indicator.className = 'swipe-nav-indicator is-visible is-next';
    } else if (direction === 'prev') {
      if (arrow) arrow.textContent = '←';
      if (label) label.textContent = displayLabel;
      indicator.className = 'swipe-nav-indicator is-visible is-prev';
    } else if (direction === 'edge') {
      if (arrow) arrow.textContent = '•';
      if (label) label.textContent = displayLabel;
      indicator.className = 'swipe-nav-indicator is-visible is-boundary';
    }
  }

  function hideIndicator() {
    if (!indicator) return;
    indicator.className = 'swipe-nav-indicator';
  }

  function isEligibleTarget(target) {
    if (!target) return true;
    // Don't trigger if target is inside an open modal/dialog or drawer
    if (target.closest?.('dialog[open], .modal[open], .nav-drawer.is-open, .mobile-action-sheet:not([hidden])')) {
      return false;
    }
    // Don't trigger inside scrollable tables or horizontally scrollable containers
    if (target.closest?.('.table-scroll, .chart-svg-container, pre, code, .statement-preview-container, .batch-receipt-preview-container')) {
      return false;
    }
    // Don't trigger on interactive inputs or buttons
    if (target.closest?.('input, select, textarea, button, a, [contenteditable="true"]')) {
      return false;
    }
    return true;
  }

  function getTargetView(direction) {
    const cur = defaultGetCurrentView();
    const idx = views.indexOf(cur);
    if (idx === -1) return null;
    if (direction === 'next') {
      return idx < views.length - 1 ? views[idx + 1] : null;
    } else if (direction === 'prev') {
      return idx > 0 ? views[idx - 1] : null;
    }
    return null;
  }

  function onTouchStart(e) {
    if (!isEnabled || !e.touches || e.touches.length !== 1) {
      isTracking = false;
      return;
    }
    const touch = e.touches[0];
    const winWidth = typeof window !== 'undefined' && typeof window.innerWidth === 'number' ? window.innerWidth : 360;

    // Reject screen edge touches (browser history swipes & drawer edge gestures)
    if (touch.clientX < edgeMargin || touch.clientX > winWidth - edgeMargin) {
      isTracking = false;
      return;
    }

    if (!isEligibleTarget(e.target)) {
      isTracking = false;
      return;
    }

    startX = touch.clientX;
    startY = touch.clientY;
    startTime = Date.now();
    isTracking = true;
    isHorizontalCandidate = false;
  }

  function onTouchMove(e) {
    if (!isTracking || !e.touches || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // If vertical movement exceeds maxVertical before horizontal threshold, cancel swipe
    if (absY > maxVertical && !isHorizontalCandidate) {
      isTracking = false;
      hideIndicator();
      return;
    }

    // Determine horizontal swipe candidate
    if (absX > 20 && absX > absY * 1.4) {
      isHorizontalCandidate = true;
      const dir = deltaX < 0 ? 'next' : 'prev';
      const target = getTargetView(dir);
      if (target) {
        showIndicator(dir, target);
      } else {
        showIndicator('edge', dir === 'next' ? 'End of views' : 'Start of views');
      }
    }
  }

  function onTouchEnd(e) {
    if (!isTracking) {
      hideIndicator();
      return;
    }
    isTracking = false;
    const touch = e.changedTouches ? e.changedTouches[0] : null;
    if (!touch) {
      hideIndicator();
      return;
    }

    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const elapsed = Date.now() - startTime;

    hideIndicator();

    // Check threshold and velocity / vertical rejection
    if (absX >= threshold && absY <= maxVertical && elapsed < 800) {
      const dir = deltaX < 0 ? 'next' : 'prev';
      const target = getTargetView(dir);
      if (target && typeof onNavigate === 'function') {
        triggerHaptic('light');
        onNavigate(target);
      }
    }
  }

  function onTouchCancel() {
    isTracking = false;
    isHorizontalCandidate = false;
    hideIndicator();
  }

  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchmove', onTouchMove, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchCancel, { passive: true });

  return {
    destroy: () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchCancel);
      if (indicator && indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    },
    enable: () => { isEnabled = true; },
    disable: () => { isEnabled = false; isTracking = false; hideIndicator(); },
    getCurrentView: defaultGetCurrentView,
    next: () => {
      const target = getTargetView('next');
      if (target && typeof onNavigate === 'function') {
        triggerHaptic('light');
        onNavigate(target);
      }
      return target;
    },
    prev: () => {
      const target = getTargetView('prev');
      if (target && typeof onNavigate === 'function') {
        triggerHaptic('light');
        onNavigate(target);
      }
      return target;
    }
  };
}

/**
 * Offline Sync Queue Management for Field Operators in Shahdara.
 */
export const OFFLINE_SYNC_QUEUE_KEY = 'shahdara_offline_sync_queue';

export function getOfflineSyncQueue(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(OFFLINE_SYNC_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addOfflineSyncItem(item, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !item) return [];
  try {
    const queue = getOfflineSyncQueue(storage);
    const entry = {
      id: item.id || ('sync_' + Math.random().toString(36).slice(2, 9)),
      type: item.type || item.action || 'generic',
      action: item.action || item.type || 'generic',
      summary: item.summary || 'Recorded action',
      timestamp: item.timestamp || new Date().toISOString(),
      payload: item.payload ?? null,
      status: item.status || 'pending',
      retryCount: typeof item.retryCount === 'number' ? item.retryCount : 0,
      nextRetryAt: item.nextRetryAt || null,
      lastError: item.lastError || null,
      retryHistory: Array.isArray(item.retryHistory) ? item.retryHistory : [],
      ...item
    };
    queue.push(entry);
    storage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(queue));
    return queue;
  } catch {
    return [];
  }
}

/**
 * Updates an item in the offline sync queue.
 */
export function updateOfflineSyncItem(itemId, updates, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !itemId) return [];
  try {
    const queue = getOfflineSyncQueue(storage);
    const index = queue.findIndex(item => item.id === itemId);
    if (index === -1) return queue;
    queue[index] = { ...queue[index], ...updates };
    storage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(queue));
    return queue;
  } catch {
    return [];
  }
}

/**
 * Removes a specific item from the offline sync queue.
 */
export function removeOfflineSyncItem(itemId, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !itemId) return [];
  try {
    const queue = getOfflineSyncQueue(storage);
    const filtered = queue.filter(item => item.id !== itemId);
    storage.setItem(OFFLINE_SYNC_QUEUE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
}

/**
 * Calculates exponential backoff delay with decorrelated network jitter.
 * Formula: baseDelay * 2^(attempt-1) capped at maxDelay, with +/- jitterFactor variation.
 */
export function calculateRetryDelay(attempt = 1, {
  baseDelayMs = 1000,
  maxDelayMs = 30000,
  multiplier = 2,
  jitterFactor = 0.25,
  randomFn = Math.random
} = {}) {
  const safeAttempt = Math.max(1, Number(attempt) || 1);
  const rawExponential = baseDelayMs * Math.pow(multiplier, safeAttempt - 1);
  const boundedDelay = Math.min(maxDelayMs, rawExponential);
  const jitterRange = boundedDelay * jitterFactor;
  const rand = typeof randomFn === 'function' ? randomFn() : Math.random();
  const jitterOffset = (rand * 2 - 1) * jitterRange;
  return Math.max(baseDelayMs, Math.round(boundedDelay + jitterOffset));
}

/**
 * Retries a specific queue item with backoff calculation and dead-letter state transitions.
 */
export async function retryOfflineQueueItem(itemId, {
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  maxAttempts = 5,
  retryHandler,
  randomFn = Math.random
} = {}) {
  const queue = getOfflineSyncQueue(storage);
  const item = queue.find(it => it.id === itemId);
  if (!item) {
    return { success: false, item: null, status: 'not_found', error: 'Item not found in offline queue' };
  }

  const currentAttempt = (item.retryCount || 0) + 1;
  const history = Array.isArray(item.retryHistory) ? [...item.retryHistory] : [];

  let handlerSuccess = true;
  let handlerError = null;

  if (typeof retryHandler === 'function') {
    try {
      const res = await retryHandler(item);
      if (res === false) {
        handlerSuccess = false;
        handlerError = 'Retry rejected by handler';
      }
    } catch (err) {
      handlerSuccess = false;
      handlerError = err?.message || String(err);
    }
  }

  if (handlerSuccess) {
    history.push({
      attempt: currentAttempt,
      timestamp: new Date().toISOString(),
      status: 'succeeded'
    });
    const updated = {
      ...item,
      status: 'synced',
      retryCount: currentAttempt,
      retryHistory: history,
      syncedAt: new Date().toISOString(),
      lastError: null
    };
    updateOfflineSyncItem(itemId, updated, storage);
    return { success: true, item: updated, status: 'synced' };
  } else {
    const isDeadLetter = currentAttempt >= maxAttempts;
    const nextStatus = isDeadLetter ? 'dead_letter' : 'retrying';
    const delay = isDeadLetter ? null : calculateRetryDelay(currentAttempt, { randomFn });
    const nextRetryAt = isDeadLetter ? null : new Date(Date.now() + delay).toISOString();

    history.push({
      attempt: currentAttempt,
      timestamp: new Date().toISOString(),
      status: nextStatus,
      error: handlerError
    });

    const updated = {
      ...item,
      status: nextStatus,
      retryCount: currentAttempt,
      nextRetryAt,
      lastError: handlerError,
      retryHistory: history
    };

    updateOfflineSyncItem(itemId, updated, storage);
    return {
      success: false,
      item: updated,
      status: nextStatus,
      error: handlerError,
      delay
    };
  }
}

/**
 * Processes all eligible items in the offline queue (pending or scheduled retries due now).
 */
export async function processEligibleOfflineRetries({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  isOnlineCheck = () => (typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true),
  retryHandler,
  maxAttempts = 5,
  randomFn,
  now = Date.now()
} = {}) {
  const isOnline = typeof isOnlineCheck === 'function' ? isOnlineCheck() : true;
  if (!isOnline) {
    return { attempted: 0, succeeded: 0, failed: 0, deadLettered: 0, items: [], skippedOffline: true };
  }

  const queue = getOfflineSyncQueue(storage);
  const eligible = queue.filter(item => {
    if (item.status === 'dead_letter' || item.status === 'synced') return false;
    if (!item.status || item.status === 'pending') return true;
    if (item.status === 'retrying') {
      if (!item.nextRetryAt) return true;
      const retryTime = new Date(item.nextRetryAt).getTime();
      return isNaN(retryTime) || retryTime <= now;
    }
    return false;
  });

  const results = {
    attempted: eligible.length,
    succeeded: 0,
    failed: 0,
    deadLettered: 0,
    items: []
  };

  for (const item of eligible) {
    const outcome = await retryOfflineQueueItem(item.id, {
      storage,
      maxAttempts,
      retryHandler,
      randomFn
    });
    results.items.push(outcome);
    if (outcome.success) {
      results.succeeded++;
    } else if (outcome.status === 'dead_letter') {
      results.deadLettered++;
      results.failed++;
    } else {
      results.failed++;
    }
  }

  return results;
}

/**
 * Starts a background resilience engine for automatically retrying offline queued actions with exponential backoff.
 */
export function startOfflineQueueAutoRetryEngine({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  isOnlineCheck = () => (typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true),
  retryHandler,
  pollIntervalMs = 6000,
  maxAttempts = 5,
  onQueueUpdated,
  onToast
} = {}) {
  let timer = null;
  let isRunning = false;

  async function tick() {
    if (!isRunning) return;
    try {
      const res = await processEligibleOfflineRetries({
        storage,
        isOnlineCheck,
        retryHandler,
        maxAttempts
      });
      if (res.attempted > 0) {
        if (typeof onQueueUpdated === 'function') {
          onQueueUpdated(getOfflineSyncQueue(storage), res);
        }
        if (res.succeeded > 0 && typeof onToast === 'function') {
          onToast(`Auto-retry synced ${res.succeeded} offline transaction${res.succeeded === 1 ? '' : 's'}`);
        }
      }
    } catch {
      // safe error swallowing in background engine
    }
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
      timer = window.setInterval(tick, pollIntervalMs);
    }
  }

  function stop() {
    isRunning = false;
    if (timer && typeof window !== 'undefined' && typeof window.clearInterval === 'function') {
      window.clearInterval(timer);
      timer = null;
    }
  }

  const handleOnline = () => {
    if (isRunning) {
      tick();
    }
  };

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', handleOnline);
  }

  start();

  return {
    start,
    stop,
    isRunning: () => isRunning,
    triggerNow: tick
  };
}

export function clearOfflineSyncQueue(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(OFFLINE_SYNC_QUEUE_KEY);
  } catch {}
}

export function processOfflineSyncQueue({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onItemProcessed,
  onComplete
} = {}) {
  const queue = getOfflineSyncQueue(storage);
  const count = queue.length;
  if (count === 0) {
    if (typeof onComplete === 'function') onComplete({ processedCount: 0, success: true });
    return { processedCount: 0, success: true };
  }

  for (let i = 0; i < queue.length; i++) {
    if (typeof onItemProcessed === 'function') {
      onItemProcessed(queue[i], i);
    }
  }

  clearOfflineSyncQueue(storage);

  if (typeof onComplete === 'function') {
    onComplete({ processedCount: count, success: true });
  }

  return { processedCount: count, success: true };
}

/**
 * Sets up the Mobile Offline Sync & Connectivity Resilience Banner.
 */
export function setupOfflineSyncBanner({
  onToast,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onSyncProcessed,
  onOpenQueue
} = {}) {
  if (typeof document === 'undefined') {
    return {
      show: () => {},
      hide: () => {},
      syncNow: () => {},
      getQueueCount: () => 0
    };
  }

  const banner = document.getElementById('offlineSyncBanner');
  const iconEl = document.getElementById('offlineSyncIcon');
  const textEl = document.getElementById('offlineSyncText');
  const retryBtn = document.getElementById('offlineSyncRetryBtn');
  const dismissBtn = document.getElementById('offlineSyncDismissBtn');
  const viewQueueBtn = document.getElementById('offlineSyncViewQueueBtn');

  let isDismissed = false;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('shahdara_offline_dismissed') === '1') {
      isDismissed = true;
    }
  } catch (_) {}

  let syncTimeout = null;
  let autoDismissTimer = null;

  function updateBannerState() {
    if (!banner) return;
    const isOnline = typeof navigator !== 'undefined' && 'onLine' in navigator ? navigator.onLine : true;
    const queue = getOfflineSyncQueue(storage);
    const queueCount = queue.length;

    if (viewQueueBtn) viewQueueBtn.hidden = queueCount === 0;

    if (!isOnline) {
      if (isDismissed) return;
      banner.hidden = false;
      banner.className = 'offline-sync-banner is-offline';
      if (textEl) {
        textEl.textContent = queueCount > 0
          ? `Offline Mode · Local ledger active (${queueCount} pending action${queueCount === 1 ? '' : 's'})`
          : 'Offline Mode · All billing entries saved to device storage';
      }
      if (retryBtn) retryBtn.hidden = true;

      if (autoDismissTimer) clearTimeout(autoDismissTimer);
      autoDismissTimer = setTimeout(() => {
        if (banner && banner.classList.contains('is-offline')) {
          banner.hidden = true;
        }
      }, 6000);
    } else {
      if (queueCount > 0) {
        banner.hidden = false;
        banner.className = 'offline-sync-banner is-syncing';
        if (textEl) {
          textEl.textContent = `Online · Syncing ${queueCount} local change${queueCount === 1 ? '' : 's'}...`;
        }
        if (retryBtn) {
          retryBtn.hidden = false;
          retryBtn.textContent = 'Sync Now';
        }

        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
          runSync();
        }, 1200);
      } else {
        if (!banner.hidden && banner.classList.contains('is-offline')) {
          banner.className = 'offline-sync-banner is-online';
          if (textEl) textEl.textContent = 'Connection restored · Local ledger up to date';
          setTimeout(() => {
            banner.hidden = true;
          }, 2400);
        } else {
          banner.hidden = true;
        }
      }
    }
  }

  function runSync() {
    if (!banner) return;
    banner.className = 'offline-sync-banner is-syncing';
    if (textEl) textEl.textContent = 'Processing offline actions...';

    const result = processOfflineSyncQueue({
      storage,
      onComplete: (res) => {
        triggerHaptic('success');
        if (typeof onSyncProcessed === 'function') onSyncProcessed(res);
        banner.className = 'offline-sync-banner is-synced';
        if (textEl) {
          textEl.textContent = `✓ All ${res.processedCount} queued change${res.processedCount === 1 ? '' : 's'} confirmed`;
        }
        if (retryBtn) retryBtn.hidden = true;
        if (typeof onToast === 'function') {
          onToast(`Sync complete: ${res.processedCount} changes saved to ledger`);
        }
        setTimeout(() => {
          banner.hidden = true;
          updateBannerState();
        }, 2200);
      }
    });

    return result;
  }

  if (retryBtn && !retryBtn.dataset?.wired) {
    if (retryBtn.dataset) retryBtn.dataset.wired = 'true';
    else if (retryBtn.setAttribute) retryBtn.setAttribute('data-wired', 'true');
    retryBtn.addEventListener('click', () => {
      triggerHaptic('medium');
      runSync();
    });
  }

  if (viewQueueBtn && !viewQueueBtn.dataset?.wired) {
    if (viewQueueBtn.dataset) viewQueueBtn.dataset.wired = 'true';
    else if (viewQueueBtn.setAttribute) viewQueueBtn.setAttribute('data-wired', 'true');
    viewQueueBtn.addEventListener('click', () => {
      triggerHaptic('light');
      if (typeof onOpenQueue === 'function') {
        onOpenQueue();
      } else {
        const modal = document.getElementById('offlineQueueModal');
        if (modal) {
          if (typeof modal.showModal === 'function') modal.showModal();
          else modal.setAttribute('open', '');
        }
      }
    });
  }

  function dismissBanner() {
    isDismissed = true;
    triggerHaptic('light');
    if (banner) banner.hidden = true;
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('shahdara_offline_dismissed', '1');
    } catch (_) {}
  }

  if (dismissBtn && !dismissBtn.dataset?.wired) {
    if (dismissBtn.dataset) dismissBtn.dataset.wired = 'true';
    else if (dismissBtn.setAttribute) dismissBtn.setAttribute('data-wired', 'true');
    dismissBtn.addEventListener('click', (e) => {
      e?.stopPropagation?.();
      dismissBanner();
    });
  }

  if (banner && typeof banner.addEventListener === 'function' && !banner.dataset?.wiredDismiss) {
    if (banner.dataset) banner.dataset.wiredDismiss = 'true';
    else if (banner.setAttribute) banner.setAttribute('data-wired-dismiss', 'true');
    banner.addEventListener('click', (e) => {
      if (e?.target?.closest?.('#offlineSyncRetryBtn') || e?.target?.closest?.('#offlineSyncViewQueueBtn')) return;
      dismissBanner();
    });
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      isDismissed = false;
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('shahdara_offline_dismissed');
      } catch (_) {}
      updateBannerState();
    });
    window.addEventListener('offline', () => {
      isDismissed = false;
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('shahdara_offline_dismissed');
      } catch (_) {}
      updateBannerState();
    });
  }

  updateBannerState();

  return {
    show: () => {
      isDismissed = false;
      if (banner) banner.hidden = false;
      updateBannerState();
    },
    hide: () => {
      if (banner) banner.hidden = true;
    },
    syncNow: runSync,
    getQueueCount: () => getOfflineSyncQueue(storage).length,
    update: updateBannerState
  };
}

/**
 * Sets up Floating Mobile Quick Navigation Speed Dial / Action Dock.
 */
export function setupMobileSpeedDial({
  onSearchRoster,
  onRecordPayment,
  onAddCustomer,
  onFieldEnrollment,
  onFieldDiagnostics,
  onFieldRouteSheet,
  onWorkOrders,
  onReminders,
  onScrollTop
} = {}) {
  if (typeof document === 'undefined') {
    return { open: () => {}, close: () => {}, toggle: () => {} };
  }

  const container = document.getElementById('mobileSpeedDial');
  const trigger = document.getElementById('speedDialTrigger');
  const menu = document.getElementById('speedDialMenu');
  const backdrop = document.getElementById('speedDialBackdrop');

  if (!container || !trigger || !menu) {
    return { open: () => {}, close: () => {}, toggle: () => {} };
  }

  let isOpen = false;

  function openSpeedDial() {
    isOpen = true;
    triggerHaptic('medium');
    container.classList.add('is-open');
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    if (backdrop) backdrop.hidden = false;

    const firstBtn = menu.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }

  function closeSpeedDial() {
    if (!isOpen) return;
    isOpen = false;
    triggerHaptic('light');
    container.classList.remove('is-open');
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (backdrop) backdrop.hidden = true;
    trigger.focus();
  }

  function toggleSpeedDial() {
    if (isOpen) closeSpeedDial();
    else openSpeedDial();
  }

  if (!trigger.dataset?.wired) {
    if (trigger.dataset) trigger.dataset.wired = 'true';
    else if (trigger.setAttribute) trigger.setAttribute('data-wired', 'true');
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSpeedDial();
    });
  }

  if (backdrop && !backdrop.dataset?.wired) {
    if (backdrop.dataset) backdrop.dataset.wired = 'true';
    else if (backdrop.setAttribute) backdrop.setAttribute('data-wired', 'true');
    backdrop.addEventListener('click', () => {
      closeSpeedDial();
    });
  }

  const fieldToolsModal = document.getElementById('fieldToolsModal');
  const closeFieldToolsBtn = document.getElementById('closeFieldToolsModalBtn');

  function openFieldTools() {
    closeSpeedDial();
    if (fieldToolsModal) {
      triggerHaptic('medium');
      fieldToolsModal.hidden = false;
      if (typeof fieldToolsModal.removeAttribute === 'function') {
        fieldToolsModal.removeAttribute('hidden');
      }
      if (typeof fieldToolsModal.showModal === 'function') {
        fieldToolsModal.showModal();
      } else {
        fieldToolsModal.setAttribute('open', '');
      }
    }
  }

  function closeFieldTools({ skipHistoryBack = false } = {}) {
    if (fieldToolsModal) {
      if (skipHistoryBack) {
        fieldToolsModal._skipHistoryBack = true;
      }
      triggerHaptic('light');
      if (typeof fieldToolsModal.close === 'function') {
        fieldToolsModal.close();
      } else {
        fieldToolsModal.hidden = true;
        fieldToolsModal.removeAttribute('open');
      }
    }
  }

  if (closeFieldToolsBtn && !closeFieldToolsBtn.dataset?.wired) {
    if (closeFieldToolsBtn.dataset) closeFieldToolsBtn.dataset.wired = 'true';
    else if (closeFieldToolsBtn.setAttribute) closeFieldToolsBtn.setAttribute('data-wired', 'true');
    closeFieldToolsBtn.addEventListener('click', () => {
      closeFieldTools();
    });
  }

  if (fieldToolsModal && !fieldToolsModal.dataset?.wired) {
    if (fieldToolsModal.dataset) fieldToolsModal.dataset.wired = 'true';
    else if (fieldToolsModal.setAttribute) fieldToolsModal.setAttribute('data-wired', 'true');
    fieldToolsModal.addEventListener('click', (e) => {
      if (e.target === fieldToolsModal) {
        closeFieldTools();
      } else {
        const btn = e.target.closest('button');
        if (btn && btn !== closeFieldToolsBtn) {
          closeFieldTools({ skipHistoryBack: true });
        }
      }
    });
    fieldToolsModal.addEventListener('cancel', () => {
      closeFieldTools();
    });
  }

  // Wire data-speed-actions inside both speed dial menu and field tools modal
  const allActionContainers = [menu, fieldToolsModal].filter(Boolean);
  allActionContainers.forEach(containerEl => {
    const actionBtns = containerEl.querySelectorAll?.('[data-speed-action]') ?? [];
    actionBtns.forEach(btn => {
      if (!btn.dataset?.wired) {
        if (btn.dataset) btn.dataset.wired = 'true';
        else if (btn.setAttribute) btn.setAttribute('data-wired', 'true');
        btn.addEventListener('click', () => {
          const action = btn.getAttribute('data-speed-action');
          closeSpeedDial();
          triggerHaptic('light');

          if (action === 'action-sheet') {
            const toggle = document.getElementById('mobileActionSheetToggle');
            if (toggle) toggle.click();
            else {
              const sheet = document.getElementById('mobileActionSheet');
              if (sheet) {
                sheet.hidden = false;
                const backdrop = document.getElementById('mobileActionSheetBackdrop');
                if (backdrop) backdrop.hidden = false;
              }
            }
          } else if (action === 'more-tools' || action === 'field-tools') {
            openFieldTools();
          } else if (action === 'search' && typeof onSearchRoster === 'function') {
            onSearchRoster();
          } else if (action === 'payment' && typeof onRecordPayment === 'function') {
            onRecordPayment();
          } else if (action === 'add-customer' && typeof onAddCustomer === 'function') {
            onAddCustomer();
          } else if (action === 'field-enrollment' && typeof onFieldEnrollment === 'function') {
            onFieldEnrollment();
          } else if (action === 'field-diagnostics' && typeof onFieldDiagnostics === 'function') {
            onFieldDiagnostics();
          } else if (action === 'field-route' && typeof onFieldRouteSheet === 'function') {
            onFieldRouteSheet();
          } else if (action === 'work-orders' && typeof onWorkOrders === 'function') {
            onWorkOrders();
          } else if (action === 'reminders' && typeof onReminders === 'function') {
            onReminders();
          } else if (action === 'scroll-top' && typeof onScrollTop === 'function') {
            onScrollTop();
          }
        });
      }
    });
  });

  container.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSpeedDial();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const btns = Array.from(menu.querySelectorAll('button:not([disabled])'));
      if (btns.length === 0) return;
      const idx = btns.indexOf(document.activeElement);
      let nextIdx = 0;
      if (e.key === 'ArrowDown') {
        nextIdx = idx < btns.length - 1 ? idx + 1 : 0;
      } else {
        nextIdx = idx > 0 ? idx - 1 : btns.length - 1;
      }
      btns[nextIdx].focus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        closeSpeedDial();
      } else if (fieldToolsModal && (fieldToolsModal.open || !fieldToolsModal.hidden)) {
        closeFieldTools();
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (isOpen && !container.contains(e.target) && (!backdrop || !backdrop.contains(e.target))) {
      closeSpeedDial();
    }
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('popstate', () => {
      closeSpeedDial();
      closeFieldTools();
    });
  }

  return {
    open: openSpeedDial,
    close: closeSpeedDial,
    toggle: toggleSpeedDial,
    openFieldTools,
    closeFieldTools,
    isOpen: () => isOpen
  };
}

/**
 * Sets up Offline Sync Queue Inspector Modal.
 */
export function setupOfflineQueueModal({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onSync,
  onRetryItem,
  onRemoveItem,
  onToast
} = {}) {
  if (typeof document === 'undefined') {
    return { open: () => {}, close: () => {}, render: () => {} };
  }

  const modal = document.getElementById('offlineQueueModal');
  const closeBtn = document.getElementById('closeOfflineQueueModalBtn');
  const syncBtn = document.getElementById('queueSyncAllBtn');
  const retryFailedBtn = document.getElementById('queueRetryFailedBtn');
  const clearBtn = document.getElementById('queueClearAllBtn');
  const listEl = document.getElementById('offlineQueueList');
  const countBadge = document.getElementById('queueItemCountBadge');
  const deadLetterBadge = document.getElementById('queueDeadLetterBadge');
  const emptyMsg = document.getElementById('offlineQueueEmptyMessage');
  const filterBar = document.getElementById('offlineQueueFilterBar');
  const filterAllCount = document.getElementById('queueFilterAllCount');
  const filterPendingCount = document.getElementById('queueFilterPendingCount');
  const filterDeadCount = document.getElementById('queueFilterDeadCount');

  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      render: () => {},
      setFilter: () => {},
      getFilter: () => 'all'
    };
  }

  let activeFilter = 'all';

  function updateFilterCounts(queue) {
    const total = queue.length;
    const deadLetters = queue.filter(it => it.status === 'dead_letter').length;
    const pending = queue.filter(it => it.status !== 'dead_letter' && it.status !== 'synced').length;

    if (filterAllCount) filterAllCount.textContent = String(total);
    if (filterPendingCount) filterPendingCount.textContent = String(pending);
    if (filterDeadCount) filterDeadCount.textContent = String(deadLetters);

    if (deadLetterBadge) {
      deadLetterBadge.hidden = deadLetters === 0;
      deadLetterBadge.textContent = `${deadLetters} dead letter`;
    }

    if (retryFailedBtn) {
      retryFailedBtn.hidden = pending === 0;
    }
  }

  function renderQueue() {
    const queue = getOfflineSyncQueue(storage);
    const count = queue.length;

    updateFilterCounts(queue);

    if (countBadge) {
      countBadge.textContent = `${count} item${count === 1 ? '' : 's'} pending`;
    }

    let filtered = queue;
    if (activeFilter === 'pending') {
      filtered = queue.filter(it => it.status !== 'dead_letter' && it.status !== 'synced');
    } else if (activeFilter === 'dead_letter') {
      filtered = queue.filter(it => it.status === 'dead_letter');
    }

    if (emptyMsg) {
      emptyMsg.hidden = filtered.length > 0;
    }

    if (syncBtn) {
      syncBtn.disabled = count === 0;
    }

    if (listEl) {
      listEl.innerHTML = '';
      if (filtered.length > 0) {
        filtered.forEach(item => {
          const card = document.createElement('div');
          card.className = 'queue-item-card';
          if (typeof card.setAttribute === 'function') {
            card.setAttribute('role', 'listitem');
          }

          const infoDiv = document.createElement('div');
          infoDiv.className = 'queue-item-info';

          const title = document.createElement('div');
          title.className = 'queue-item-title';
          title.textContent = item.summary || (item.action ? `Action: ${item.action}` : 'Offline Entry');

          const status = item.status || 'pending';
          const statusTag = document.createElement('span');
          statusTag.className = `queue-status-tag status-${status}`;
          if (status === 'dead_letter') {
            statusTag.textContent = `Dead Letter (${item.retryCount || 0} failed)`;
          } else if (status === 'retrying') {
            statusTag.textContent = `Retry #${item.retryCount || 1}`;
          } else if (status === 'synced') {
            statusTag.textContent = 'Synced';
          } else {
            statusTag.textContent = 'Pending';
          }

          const time = document.createElement('div');
          time.className = 'queue-item-time';
          const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recent';
          const errorDetail = item.lastError ? ` · Error: ${item.lastError}` : '';
          time.textContent = `${timeStr}${errorDetail}`;

          infoDiv.appendChild(title);
          infoDiv.appendChild(statusTag);
          infoDiv.appendChild(time);
          card.appendChild(infoDiv);

          const actionsDiv = document.createElement('div');
          actionsDiv.className = 'queue-item-actions';

          const itemRetryBtn = document.createElement('button');
          itemRetryBtn.className = 'queue-item-btn btn-retry';
          itemRetryBtn.textContent = 'Retry';
          itemRetryBtn.type = 'button';
          if (typeof itemRetryBtn.addEventListener === 'function') {
            itemRetryBtn.addEventListener('click', async () => {
              triggerHaptic('medium');
              itemRetryBtn.disabled = true;
              itemRetryBtn.textContent = 'Retrying...';
              const outcome = await retryOfflineQueueItem(item.id, { storage });
              if (outcome.success) {
                if (typeof onToast === 'function') onToast(`Synced: ${item.summary || item.action}`);
              } else {
                if (typeof onToast === 'function') onToast(`Retry failed (${outcome.status}): ${outcome.error || 'Network error'}`);
              }
              renderQueue();
              if (typeof onRetryItem === 'function') onRetryItem(outcome);
            });
          }
          actionsDiv.appendChild(itemRetryBtn);

          const discardBtn = document.createElement('button');
          discardBtn.className = 'queue-item-btn btn-discard';
          discardBtn.textContent = 'Discard';
          discardBtn.type = 'button';
          if (typeof discardBtn.addEventListener === 'function') {
            discardBtn.addEventListener('click', () => {
              triggerHaptic('light');
              removeOfflineSyncItem(item.id, storage);
              renderQueue();
              if (typeof onToast === 'function') onToast('Item discarded from queue');
              if (typeof onRemoveItem === 'function') onRemoveItem(item.id);
            });
          }
          actionsDiv.appendChild(discardBtn);

          card.appendChild(actionsDiv);
          listEl.appendChild(card);
        });
      }
    }
  }

  function openModal() {
    renderQueue();
    if (typeof modal.showModal === 'function') {
      modal.showModal();
    } else {
      modal.setAttribute('open', '');
    }
  }

  function closeModal() {
    if (typeof modal.close === 'function') {
      modal.close();
    } else {
      modal.removeAttribute('open');
    }
  }

  if (closeBtn && !closeBtn.dataset?.wired) {
    if (closeBtn.dataset) closeBtn.dataset.wired = 'true';
    closeBtn.addEventListener('click', closeModal);
  }

  if (syncBtn && !syncBtn.dataset?.wired) {
    if (syncBtn.dataset) syncBtn.dataset.wired = 'true';
    syncBtn.addEventListener('click', () => {
      processOfflineSyncQueue({
        storage,
        onComplete: (r) => {
          if (typeof onSync === 'function') onSync(r);
          if (typeof onToast === 'function') onToast(`Synced ${r.processedCount} queued items`);
          renderQueue();
          closeModal();
        }
      });
    });
  }

  if (clearBtn && !clearBtn.dataset?.wired) {
    if (clearBtn.dataset) clearBtn.dataset.wired = 'true';
    clearBtn.addEventListener('click', () => {
      clearOfflineSyncQueue(storage);
      renderQueue();
      if (typeof onToast === 'function') onToast('Offline queue cleared');
    });
  }

  function setFilter(filter) {
    activeFilter = filter;
    if (filterBar && typeof filterBar.querySelectorAll === 'function') {
      const btns = filterBar.querySelectorAll('.queue-filter-btn');
      btns.forEach(b => {
        const isMatch = b.getAttribute?.('data-queue-filter') === filter;
        if (b.classList && typeof b.classList.toggle === 'function') {
          b.classList.toggle('is-active', isMatch);
        }
      });
    }
    renderQueue();
  }

  if (filterBar && !filterBar.dataset?.wiredFilter && typeof filterBar.querySelectorAll === 'function') {
    if (filterBar.dataset) filterBar.dataset.wiredFilter = 'true';
    else if (filterBar.setAttribute) filterBar.setAttribute('data-wired-filter', 'true');
    const btns = filterBar.querySelectorAll('[data-queue-filter]');
    btns.forEach(btn => {
      if (typeof btn.addEventListener === 'function') {
        btn.addEventListener('click', () => {
          triggerHaptic('light');
          const filter = btn.getAttribute('data-queue-filter');
          setFilter(filter);
        });
      }
    });
  }

  if (retryFailedBtn && !retryFailedBtn.dataset?.wired) {
    if (retryFailedBtn.dataset) retryFailedBtn.dataset.wired = 'true';
    else if (retryFailedBtn.setAttribute) retryFailedBtn.setAttribute('data-wired', 'true');
    retryFailedBtn.addEventListener('click', async () => {
      triggerHaptic('medium');
      retryFailedBtn.disabled = true;
      retryFailedBtn.textContent = 'Retrying...';
      const res = await processEligibleOfflineRetries({ storage });
      if (typeof onToast === 'function') {
        onToast(`Processed ${res.attempted} items (${res.succeeded} synced, ${res.failed} failed)`);
      }
      retryFailedBtn.disabled = false;
      retryFailedBtn.textContent = 'Retry Eligible Now';
      renderQueue();
    });
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  return {
    open: openModal,
    close: closeModal,
    render: renderQueue,
    setFilter,
    getFilter: () => activeFilter
  };
}

/**
 * Interactive Mobile Breadcrumbs Trail Navigation Bar (agent2 - shahdara-mobile-nav)
 * Provides progressive drilldown hierarchy and history navigation with accessible keyboard support.
 */
export function setupMobileBreadcrumbs({
  containerId = 'mobileBreadcrumbBar',
  listId = 'breadcrumbList',
  backBtnId = 'breadcrumbBackBtn',
  initialCrumbs = [{ id: 'home', label: 'Home' }],
  hideOnSingle = true,
  maxItems = 5,
  onNavigate = null
} = {}) {
  if (typeof document === 'undefined') {
    return {
      pushCrumb: () => {},
      pushBreadcrumb: () => {},
      popCrumb: () => null,
      popBreadcrumb: () => null,
      resetBreadcrumbs: () => {},
      setBreadcrumbs: () => {},
      setBreadcrumbTrail: () => {},
      getBreadcrumbTrail: () => [],
      render: () => {},
      destroy: () => {}
    };
  }

  const container = document.getElementById(containerId);
  const list = document.getElementById(listId);
  const backBtn = document.getElementById(backBtnId);

  let trail = Array.isArray(initialCrumbs) && initialCrumbs.length > 0
    ? initialCrumbs.map(c => ({ ...c }))
    : [{ id: 'home', label: 'Home' }];

  function render() {
    if (container) {
      if (hideOnSingle && trail.length <= 1) {
        container.hidden = true;
      } else {
        container.hidden = false;
      }
    }

    if (backBtn) {
      backBtn.hidden = trail.length <= 1;
      const prevCrumb = trail.length > 1 ? trail[trail.length - 2] : null;
      if (prevCrumb) {
        backBtn.setAttribute('aria-label', `Back to ${prevCrumb.label || prevCrumb.id}`);
        backBtn.title = `Back to ${prevCrumb.label || prevCrumb.id}`;
      } else {
        backBtn.setAttribute('aria-label', 'Go back');
        if (backBtn.removeAttribute) backBtn.removeAttribute('title');
      }
    }

    if (!list) return;
    list.innerHTML = '';

    trail.forEach((crumb, idx) => {
      const isLast = idx === trail.length - 1;
      const li = document.createElement('li');
      li.className = 'breadcrumb-item' + (isLast ? ' breadcrumb-current' : '');

      if (isLast) {
        li.setAttribute('aria-current', 'page');
        const span = document.createElement('span');
        span.className = 'breadcrumb-current-label';
        span.textContent = crumb.label || crumb.id;
        li.appendChild(span);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'breadcrumb-link';
        btn.setAttribute('data-breadcrumb-idx', String(idx));
        btn.setAttribute('data-breadcrumb-id', crumb.id);
        btn.textContent = crumb.label || crumb.id;
        btn.addEventListener('click', () => {
          navigateToIndex(idx);
        });
        li.appendChild(btn);

        const sep = document.createElement('span');
        sep.className = 'breadcrumb-separator';
        sep.setAttribute('aria-hidden', 'true');
        sep.textContent = '/';
        li.appendChild(sep);
      }

      list.appendChild(li);
    });
  }

  function navigateToIndex(index) {
    if (index < 0 || index >= trail.length - 1) return;
    triggerHaptic('selection');
    const targetCrumb = trail[index];
    trail = trail.slice(0, index + 1);
    render();
    if (typeof onNavigate === 'function') {
      onNavigate(targetCrumb.id, targetCrumb.data, targetCrumb);
    }
  }

  function pushCrumb({ id, label, icon = null, data = null } = {}) {
    if (!id) return;
    const existingIdx = trail.findIndex(c => c.id === id);
    if (existingIdx !== -1) {
      trail = trail.slice(0, existingIdx + 1);
      trail[existingIdx] = { id, label: label || trail[existingIdx].label, icon, data };
    } else {
      trail.push({ id, label: label || id, icon, data });
      if (trail.length > maxItems) {
        trail = [trail[0], ...trail.slice(trail.length - (maxItems - 1))];
      }
    }
    render();
  }

  function popCrumb() {
    if (trail.length <= 1) return null;
    triggerHaptic('light');
    const popped = trail.pop();
    const current = trail[trail.length - 1];
    render();
    if (typeof onNavigate === 'function' && current) {
      onNavigate(current.id, current.data, current);
    }
    return popped;
  }

  function resetBreadcrumbs(initial = [{ id: 'home', label: 'Home' }]) {
    trail = Array.isArray(initial) && initial.length > 0 ? initial.map(c => ({ ...c })) : [{ id: 'home', label: 'Home' }];
    render();
  }

  function setBreadcrumbs(items) {
    if (Array.isArray(items) && items.length > 0) {
      trail = items.map(c => ({ ...c }));
    } else {
      trail = [{ id: 'home', label: 'Home' }];
    }
    render();
  }

  function handleBackClick() {
    popCrumb();
  }

  if (backBtn && !backBtn.dataset?.wiredBreadcrumb) {
    if (backBtn.dataset) backBtn.dataset.wiredBreadcrumb = 'true';
    backBtn.addEventListener('click', handleBackClick);
  }

  function handleKeydown(e) {
    if (!list) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const focusables = Array.from(list.querySelectorAll('button.breadcrumb-link'));
      if (!focusables.length) return;
      const currentIdx = focusables.indexOf(document.activeElement);
      if (currentIdx !== -1) {
        e.preventDefault();
        const nextIdx = e.key === 'ArrowRight'
          ? (currentIdx + 1) % focusables.length
          : (currentIdx - 1 + focusables.length) % focusables.length;
        focusables[nextIdx]?.focus();
      }
    }
  }

  if (list && !list.dataset?.wiredKeyboard) {
    if (list.dataset) list.dataset.wiredKeyboard = 'true';
    list.addEventListener('keydown', handleKeydown);
  }

  render();

  function updateCurrentCrumb({ label, data } = {}) {
    if (!trail.length) return;
    const current = trail[trail.length - 1];
    if (label !== undefined) current.label = label;
    if (data !== undefined) current.data = data;
    render();
  }

  return {
    pushCrumb,
    pushBreadcrumb: pushCrumb,
    popCrumb,
    popBreadcrumb: popCrumb,
    updateCurrentCrumb,
    resetBreadcrumbs,
    setBreadcrumbs,
    setBreadcrumbTrail: setBreadcrumbs,
    getBreadcrumbTrail: () => [...trail],
    render,
    destroy: () => {
      if (backBtn) backBtn.removeEventListener('click', handleBackClick);
      if (list) list.removeEventListener('keydown', handleKeydown);
    }
  };
}

/**
 * Maps a screen name or URL hash to the matching mobile bottom navigation tab ID (Issue #285).
 * Valid tabs in .mobile-bottom-nav: 'home', 'customers', 'collection', 'reports', 'more'.
 */
export function getMobileNavTabForScreen(screen, hash = '') {
  const currentHash = (hash ?? (typeof window !== 'undefined' && window.location ? window.location.hash : '')).toLowerCase();
  if (currentHash === '#/collect' || currentHash === '#collect' || currentHash === '#quick-collect' || currentHash === '#/bulk-collect') {
    return 'collection';
  }
  const s = String(screen || '').toLowerCase();
  if (s === 'customers') return 'customers';
  if (s === 'transactions' || s === 'payments' || s === 'collect') return 'collection';
  if (s === 'reports' || s === 'bills' || s === 'alerts') return 'reports';
  if (s === 'recovery' || s === 'dues') return 'collection';
  if (s === 'backup' || s === 'settings' || s === 'assistant' || s === 'inventory' || s === 'analytics' || s === 'expenses' || s === 'field-tools' || s === 'tools' || s === 'more') {
    return 'more';
  }
  if (!s || s === 'home') return 'home';
  return 'more';
}

/**
 * Synchronizes aria-current state across mobile bottom navigation tabs (Issue #285).
 * Also synchronizes #showCustomersButton on Home to prevent duplicate active state on Desktop (#285 / #278),
 * and updates speed dial suppression state.
 */
export function syncMobileBottomNav(screen, hash) {
  if (typeof document === 'undefined') return 'home';
  const container = document.querySelector?.('.mobile-bottom-nav');
  if (!container) return 'home';

  const moreMenu = typeof document.getElementById === 'function' ? document.getElementById('mobileMoreMenu') : null;
  const isMoreOpen = Boolean(moreMenu && !moreMenu.hidden);
  const targetTab = isMoreOpen ? 'more' : getMobileNavTabForScreen(screen, hash);

  const buttons = (typeof container.querySelectorAll === 'function')
    ? container.querySelectorAll('[data-mobile-nav]')
    : [];
  buttons.forEach(btn => {
    const act = btn.getAttribute?.('data-mobile-nav') === targetTab;
    if (typeof btn.setAttribute === 'function') {
      btn.setAttribute('aria-current', act ? 'page' : 'false');
    }
  });

  // Keep Desktop Home view-nav buttons clean (#285 / #278)
  const isHome = targetTab === 'home';
  const showCustBtn = typeof document.getElementById === 'function' ? document.getElementById('showCustomersButton') : null;
  if (showCustBtn && typeof showCustBtn.setAttribute === 'function') {
    if (isHome && showCustBtn.getAttribute?.('aria-current') === 'page') {
      showCustBtn.setAttribute('aria-current', 'false');
    } else if (targetTab === 'customers' && showCustBtn.getAttribute?.('aria-current') !== 'page') {
      showCustBtn.setAttribute('aria-current', 'page');
    }
  }

  // Update speed dial suppression when More menu or dialogs are open
  const speedDial = typeof document.getElementById === 'function' ? document.getElementById('mobileSpeedDial') : null;
  if (speedDial && speedDial.classList && typeof speedDial.classList.toggle === 'function') {
    const hasOpenDialog = Boolean(typeof document.querySelector === 'function' && document.querySelector('dialog[open], .mobile-action-sheet.is-open'));
    speedDial.classList.toggle('is-suppressed', isMoreOpen || hasOpenDialog);
  }

  return targetTab;
}

/**
 * Tab Slider Highlight Indicator (agent2 - shahdara-mobile-nav)
 * Creates and dynamically positions a smooth sliding background highlight pill behind active tabs.
 */
export function setupTabSliderIndicator({
  containerSelector = '.mobile-bottom-nav',
  indicatorClass = 'nav-slider-indicator',
  activeAttr = 'aria-current',
  activeVal = 'page'
} = {}) {
  if (typeof document === 'undefined') {
    return {
      updateSlider: () => {},
      sync: () => {},
      destroy: () => {},
      getIndicator: () => null
    };
  }

  const container = typeof containerSelector === 'string'
    ? document.querySelector(containerSelector)
    : containerSelector;

  if (!container) {
    return {
      updateSlider: () => {},
      sync: () => {},
      destroy: () => {},
      getIndicator: () => null
    };
  }

  let indicator = container.querySelector(`.${indicatorClass}`);
  if (!indicator && typeof document.createElement === 'function') {
    indicator = document.createElement('div');
    indicator.className = indicatorClass;
    if (typeof indicator.setAttribute === 'function') {
      indicator.setAttribute('aria-hidden', 'true');
    }
    if (typeof container.insertBefore === 'function') {
      container.insertBefore(indicator, container.firstChild);
    }
  }

  function getActiveTab(target) {
    if (target && target.nodeType === 1) return target;
    if (typeof target === 'string') {
      const found = container.querySelector(
        `[data-nav-target="${target}"], [data-mobile-nav="${target}"], [id="${target}"]`
      );
      if (found) return found;
    }
    return container.querySelector(
      `[${activeAttr}="${activeVal}"], .is-active, [aria-selected="true"]`
    );
  }

  function updateSlider(target) {
    const tab = getActiveTab(target);
    if (!tab) {
      if (indicator && indicator.style) {
        indicator.style.opacity = '0';
      }
      return;
    }

    const cRect = container.getBoundingClientRect ? container.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const tRect = tab.getBoundingClientRect ? tab.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };

    const offsetLeft = tRect.left - cRect.left + (container.scrollLeft || 0);
    const offsetTop = tRect.top - cRect.top + (container.scrollTop || 0);
    const width = tRect.width;
    const height = tRect.height;

    if (indicator && indicator.style) {
      indicator.style.opacity = '1';
      indicator.style.transform = `translate3d(${offsetLeft}px, ${offsetTop}px, 0)`;
      indicator.style.width = `${width}px`;
      indicator.style.height = `${height}px`;
    }

    if (container.style && container.style.setProperty) {
      container.style.setProperty('--slider-x', `${offsetLeft}px`);
      container.style.setProperty('--slider-y', `${offsetTop}px`);
      container.style.setProperty('--slider-w', `${width}px`);
      container.style.setProperty('--slider-h', `${height}px`);
    }
  }

  function sync(screen, hash) {
    const currentScreen = screen !== undefined ? screen : (typeof document !== 'undefined' ? document.body?.dataset?.screen : '');
    const currentHash = hash !== undefined ? hash : (typeof window !== 'undefined' && window.location ? window.location.hash : '');
    const activeTab = syncMobileBottomNav(currentScreen, currentHash);
    updateSlider(activeTab);
  }

  let resizeTimer = null;
  function handleResize() {
    if (typeof window !== 'undefined' && typeof window.clearTimeout === 'function') {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        updateSlider();
      }, 60);
    } else {
      updateSlider();
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('resize', handleResize, { passive: true });
  }

  function handleContainerClick(e) {
    if (!e || !e.target || typeof e.target.closest !== 'function') return;
    const btn = e.target.closest('button, [role="tab"]');
    if (btn && (!container.contains || container.contains(btn))) {
      if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
        window.setTimeout(() => sync(), 0);
      } else {
        sync();
      }
    }
  }

  if (container.addEventListener) {
    container.addEventListener('click', handleContainerClick);
  }

  // Observers for screen router data-screen, more menu toggle, and modals
  let bodyObserver = null;
  if (typeof MutationObserver !== 'undefined' && typeof document !== 'undefined' && document.body) {
    bodyObserver = new MutationObserver(mutations => {
      for (const m of mutations) {
        if (m.type === 'attributes' && (m.attributeName === 'data-screen' || m.attributeName === 'open')) {
          sync();
          break;
        } else if (m.type === 'childList') {
          sync();
          break;
        }
      }
    });
    bodyObserver.observe(document.body, { attributes: true, attributeFilter: ['data-screen', 'open'], childList: true, subtree: true });
  }

  let moreMenuObserver = null;
  const moreMenuEl = typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById('mobileMoreMenu') : null;
  if (typeof MutationObserver !== 'undefined' && moreMenuEl) {
    moreMenuObserver = new MutationObserver(() => {
      sync();
    });
    moreMenuObserver.observe(moreMenuEl, { attributes: true, attributeFilter: ['hidden'] });
  }

  const handleRoutingEvents = () => { sync(); };
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', handleRoutingEvents, { passive: true });
    window.addEventListener('popstate', handleRoutingEvents, { passive: true });
  }

  // Initial synchronization and slider positioning
  sync();

  return {
    updateSlider,
    sync,
    destroy: () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('hashchange', handleRoutingEvents);
        window.removeEventListener('popstate', handleRoutingEvents);
      }
      if (container && container.removeEventListener) {
        container.removeEventListener('click', handleContainerClick);
      }
      if (bodyObserver) bodyObserver.disconnect();
      if (moreMenuObserver) moreMenuObserver.disconnect();
      if (indicator && indicator.parentNode && typeof indicator.parentNode.removeChild === 'function') {
        indicator.parentNode.removeChild(indicator);
      }
    },
    getIndicator: () => indicator
  };
}

/**
 * Calculates current progress percentage and metadata for customer enrollment wizard.
 */
export function calculateWizardProgress(currentStep, totalSteps = 4) {
  const total = Math.max(1, Number(totalSteps) || 4);
  const step = Math.max(1, Math.min(total, Number(currentStep) || 1));
  const percentage = Math.round((step / total) * 100);
  return {
    step,
    totalSteps: total,
    percentage,
    isFirst: step === 1,
    isLast: step === total
  };
}

/**
 * Validates a specific step of the enrollment wizard.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateWizardStep(step, data = {}) {
  const errors = [];
  const s = Number(step) || 1;

  if (s === 1) {
    const name = String(data.name || '').trim();
    if (!name) {
      errors.push('Customer name is required.');
    } else if (name.length < 2) {
      errors.push('Customer name must be at least 2 characters.');
    }
    const phone = String(data.phone || '').trim();
    if (phone) {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        errors.push('Phone number must have between 10 and 13 digits (e.g. 0300-1234567).');
      }
    }
    const cnic = String(data.cnic || '').trim();
    if (cnic) {
      const cnicDigits = cnic.replace(/\D/g, '');
      if (cnicDigits.length !== 13) {
        errors.push('CNIC must be 13 digits if provided (e.g. 35201-1234567-1).');
      }
    }
  } else if (s === 2) {
    const area = String(data.area || data.mohalla || '').trim();
    const address = String(data.address || '').trim();
    if (!area && !address) {
      errors.push('Please specify an Area, Mohalla, or Street Address for fiber installation.');
    }
  } else if (s === 3) {
    const rate = Number(data.monthlyRate);
    if (Number.isNaN(rate) || rate < 0) {
      errors.push('Monthly rate must be a valid positive number or 0.');
    }
    const fee = Number(data.installationFee ?? 0);
    if (Number.isNaN(fee) || fee < 0) {
      errors.push('Installation fee must be a valid positive number or 0.');
    }
  } else if (s === 4) {
    if (!data.agreementVerified) {
      errors.push('Field technician must confirm physical fiber link and connectivity verification.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Generates structured summary and metadata of customer enrollment data for review.
 */
export function formatCustomerSummary(data = {}) {
  const name = String(data.name || 'Not provided').trim();
  const phone = String(data.phone || 'Not provided').trim();
  const cnic = String(data.cnic || 'None recorded').trim();
  const area = String(data.area || 'Shahdara Town').trim();
  const mohalla = String(data.mohalla || '').trim();
  const address = String(data.address || '').trim();
  const fullAddress = [address, mohalla, area].filter(Boolean).join(', ') || 'Not specified';
  const fdb = String(data.fdb || 'Not assigned').trim();
  const port = data.fiberPort ? `Port #${data.fiberPort}` : 'Unassigned';
  const plan = String(data.packageLabel || data.packageSpeed || 'Standard Broadband').trim();
  const rate = Number(data.monthlyRate) || 0;
  const fee = Number(data.installationFee) || 0;
  const totalUpfront = rate + fee;
  const staticIp = Boolean(data.staticIp);
  const ontOwnership = String(data.ontOwnership || 'ISP Provided');
  const startDate = String(data.startDate || new Date().toISOString().slice(0, 10));

  return {
    name,
    phone,
    cnic,
    fullAddress,
    area,
    mohalla,
    address,
    fdb,
    port,
    plan,
    rate,
    fee,
    totalUpfront,
    staticIp,
    ontOwnership,
    startDate,
    notes: String(data.notes || '').trim()
  };
}

export const WIZARD_DRAFT_KEY = 'shahdara_field_wizard_draft';

export function getWizardDraft(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WIZARD_DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWizardDraft(draftData, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !draftData) return;
  try {
    storage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(draftData));
  } catch {
    // Ignore storage quota
  }
}

export function clearWizardDraft(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(WIZARD_DRAFT_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Mobile Field Technician Customer Onboarding & Multi-Step Enrollment Swipe Wizard Controller.
 */
export function setupCustomerEnrollmentWizard({
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onComplete,
  onCancel,
  onToast,
  packages
} = {}) {
  if (typeof document === 'undefined') {
    return {
      open: () => {},
      close: () => {},
      goToStep: () => {},
      nextStep: () => {},
      prevStep: () => {},
      getCurrentStep: () => 1,
      getFormData: () => ({}),
      reset: () => {}
    };
  }

  const modal = document.getElementById('customerEnrollmentWizard');
  if (!modal) {
    return {
      open: () => {},
      close: () => {},
      goToStep: () => {},
      nextStep: () => {},
      prevStep: () => {},
      getCurrentStep: () => 1,
      getFormData: () => ({}),
      reset: () => {}
    };
  }

  const closeBtn = document.getElementById('closeEnrollmentWizardBtn');
  const backBtn = document.getElementById('wizardBackBtn');
  const nextBtn = document.getElementById('wizardNextBtn');
  const stepIndicator = document.getElementById('wizardStepIndicator');
  const progressBar = document.getElementById('wizardProgressBar');
  const errorBox = document.getElementById('wizardErrorBox');
  const track = document.getElementById('wizardTrack');
  const stepPills = Array.from(modal.querySelectorAll?.('[data-wizard-step]') ?? []);

  // Form input elements
  const nameInput = document.getElementById('wizardCustomerName');
  const phoneInput = document.getElementById('wizardCustomerPhone');
  const cnicInput = document.getElementById('wizardCustomerCnic');
  const statusSelect = document.getElementById('wizardInitialStatus');
  const areaSelect = document.getElementById('wizardAreaSelect');
  const mohallaInput = document.getElementById('wizardMohallaInput');
  const addressInput = document.getElementById('wizardAddressInput');
  const fdbInput = document.getElementById('wizardFdbId');
  const portInput = document.getElementById('wizardFiberPort');
  const packageSelect = document.getElementById('wizardPackageSelect');
  const rateInput = document.getElementById('wizardMonthlyRate');
  const feeInput = document.getElementById('wizardInstallationFee');
  const dueDateSelect = document.getElementById('wizardDueDateDay');
  const ontSelect = document.getElementById('wizardOntOwnership');
  const staticIpCheck = document.getElementById('wizardStaticIpCheck');
  const summaryCard = document.getElementById('wizardSummaryCard');
  const startDateInput = document.getElementById('wizardStartDate');
  const techNotesInput = document.getElementById('wizardTechNotes');
  const agreementCheck = document.getElementById('wizardAgreementCheck');

  // Trigger buttons
  const openBtn = document.getElementById('openEnrollmentWizardBtn');
  const quickActionBtn = document.getElementById('quickActionFieldWizard');

  const totalSteps = 4;
  const stepTitles = [
    'Account & Contact',
    'Location & Fiber',
    'Package & Plan',
    'Review & Activate'
  ];

  let currentStep = 1;
  let isOpen = false;

  const standardPackageRates = {
    '5mbps-150gb': 1500,
    '5mbps-200gb': 2000,
    '5mbps-500gb': 2500,
    '15mbps-unlimited': 3000,
    '3mbps-100gb': 1000,
    '3mbps-300gb': 1600
  };

  function getFormData() {
    const pkgOption = packageSelect && packageSelect.options ? packageSelect.options[packageSelect.selectedIndex] : null;
    const pkgLabel = pkgOption ? pkgOption.text : (packageSelect?.value || '');

    return {
      name: nameInput?.value?.trim() || '',
      phone: phoneInput?.value?.trim() || '',
      cnic: cnicInput?.value?.trim() || '',
      serviceStatus: statusSelect?.value || 'Active',
      area: areaSelect?.value || '',
      mohalla: mohallaInput?.value?.trim() || '',
      address: addressInput?.value?.trim() || '',
      fdb: fdbInput?.value?.trim() || '',
      fiberPort: portInput?.value ? Number(portInput.value) : '',
      packageSpeed: packageSelect?.value || '5mbps-150gb',
      packageLabel: pkgLabel,
      monthlyRate: rateInput?.value !== '' ? Number(rateInput?.value) : 1500,
      installationFee: feeInput?.value !== '' ? Number(feeInput?.value) : 0,
      dueDateDay: dueDateSelect?.value ? Number(dueDateSelect.value) : 10,
      ontOwnership: ontSelect?.value || 'ISP Provided',
      staticIp: Boolean(staticIpCheck?.checked),
      startDate: startDateInput?.value || new Date().toISOString().slice(0, 10),
      notes: techNotesInput?.value?.trim() || '',
      agreementVerified: Boolean(agreementCheck?.checked)
    };
  }

  function setFormData(data = {}) {
    if (!data) return;
    if (nameInput && data.name !== undefined) nameInput.value = data.name;
    if (phoneInput && data.phone !== undefined) phoneInput.value = data.phone;
    if (cnicInput && data.cnic !== undefined) cnicInput.value = data.cnic;
    if (statusSelect && data.serviceStatus !== undefined) statusSelect.value = data.serviceStatus;
    if (areaSelect && data.area !== undefined) areaSelect.value = data.area;
    if (mohallaInput && data.mohalla !== undefined) mohallaInput.value = data.mohalla;
    if (addressInput && data.address !== undefined) addressInput.value = data.address;
    if (fdbInput && data.fdb !== undefined) fdbInput.value = data.fdb;
    if (portInput && data.fiberPort !== undefined) portInput.value = data.fiberPort;
    if (packageSelect && data.packageSpeed !== undefined) packageSelect.value = data.packageSpeed;
    if (rateInput && data.monthlyRate !== undefined) rateInput.value = data.monthlyRate;
    if (feeInput && data.installationFee !== undefined) feeInput.value = data.installationFee;
    if (dueDateSelect && data.dueDateDay !== undefined) dueDateSelect.value = data.dueDateDay;
    if (ontSelect && data.ontOwnership !== undefined) ontSelect.value = data.ontOwnership;
    if (staticIpCheck && data.staticIp !== undefined) staticIpCheck.checked = Boolean(data.staticIp);
    if (startDateInput && data.startDate !== undefined) startDateInput.value = data.startDate;
    if (techNotesInput && data.notes !== undefined) techNotesInput.value = data.notes;
    if (agreementCheck && data.agreementVerified !== undefined) agreementCheck.checked = Boolean(data.agreementVerified);
  }

  function renderSummary() {
    if (!summaryCard) return;
    const summary = formatCustomerSummary(getFormData());

    const escape = (str) => String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    summaryCard.innerHTML = `
      <div class="wizard-summary-header">
        <h4 class="wizard-summary-title">Subscriber Enrollment Overview</h4>
        <span class="wizard-status-tag ${summary.agreementVerified ? 'is-verified' : ''}">
          ${escape(summary.ontOwnership)}
        </span>
      </div>
      <div class="wizard-summary-grid">
        <div class="wizard-summary-item">
          <span class="summary-k">Customer Name</span>
          <strong class="summary-v">${escape(summary.name)}</strong>
        </div>
        <div class="wizard-summary-item">
          <span class="summary-k">Contact / WhatsApp</span>
          <span class="summary-v">${escape(summary.phone)}</span>
        </div>
        <div class="wizard-summary-item">
          <span class="summary-k">Location &amp; Address</span>
          <span class="summary-v">${escape(summary.fullAddress)}</span>
        </div>
        <div class="wizard-summary-item">
          <span class="summary-k">Optical Splitter / Port</span>
          <span class="summary-v">${escape(summary.fdb)} · ${escape(summary.port)}</span>
        </div>
        <div class="wizard-summary-item wizard-highlight-plan">
          <span class="summary-k">Assigned Tariff</span>
          <strong class="summary-v">${escape(summary.plan)}</strong>
        </div>
        <div class="wizard-summary-item wizard-highlight-dues">
          <span class="summary-k">Monthly Subscription Dues</span>
          <strong class="summary-v highlight-green">PKR ${summary.rate.toLocaleString()} / mo</strong>
        </div>
        ${summary.fee > 0 ? `
        <div class="wizard-summary-item">
          <span class="summary-k">Installation &amp; Drop Cable</span>
          <span class="summary-v">PKR ${summary.fee.toLocaleString()}</span>
        </div>
        ` : ''}
        ${summary.staticIp ? `
        <div class="wizard-summary-item">
          <span class="summary-k">Static IP Add-on</span>
          <span class="summary-v">+ PKR 500 / mo</span>
        </div>
        ` : ''}
      </div>
    `;
  }

  function updateStepView(newStep) {
    currentStep = Math.max(1, Math.min(totalSteps, newStep));

    // Progress bar
    const progress = calculateWizardProgress(currentStep, totalSteps);
    if (progressBar) {
      if (progressBar.style) {
        progressBar.style.width = `${progress.percentage}%`;
      }
      progressBar.setAttribute('aria-valuenow', String(progress.percentage));
    }

    // Slide track transform (each slide is 25% of 400% track width)
    if (track && track.style) {
      const offset = (currentStep - 1) * 25;
      track.style.transform = `translateX(-${offset}%)`;
    }

    // Update slides aria-hidden
    for (let i = 1; i <= totalSteps; i++) {
      const slide = document.getElementById(`wizardSlide${i}`);
      if (slide) {
        slide.setAttribute('aria-hidden', i === currentStep ? 'false' : 'true');
      }
    }

    // Step pills
    stepPills.forEach(pill => {
      const stepNum = Number(pill.getAttribute('data-wizard-step'));
      if (stepNum === currentStep) {
        pill.classList.add('is-active');
        pill.classList.remove('is-completed');
        pill.setAttribute('aria-selected', 'true');
      } else if (stepNum < currentStep) {
        pill.classList.remove('is-active');
        pill.classList.add('is-completed');
        pill.setAttribute('aria-selected', 'false');
      } else {
        pill.classList.remove('is-active', 'is-completed');
        pill.setAttribute('aria-selected', 'false');
      }
    });

    // Step indicator text
    if (stepIndicator) {
      stepIndicator.textContent = `Step ${currentStep} of ${totalSteps}`;
    }

    // Navigation buttons
    if (backBtn) {
      backBtn.disabled = currentStep === 1;
    }
    if (nextBtn) {
      if (currentStep === totalSteps) {
        nextBtn.textContent = 'Complete Enrollment ✓';
        nextBtn.classList.add('btn-complete-enrollment');
      } else {
        nextBtn.textContent = `Next: ${stepTitles[currentStep] || 'Next'} →`;
        nextBtn.classList.remove('btn-complete-enrollment');
      }
    }

    // Render summary on Step 4
    if (currentStep === 4) {
      renderSummary();
    }

    // Clear error box
    if (errorBox) {
      errorBox.hidden = true;
      errorBox.innerHTML = '';
    }

    // Save draft automatically on step change
    saveWizardDraft(getFormData(), storage);
    triggerHaptic('selection');
  }

  function goToStep(stepNumber) {
    const target = Math.max(1, Math.min(totalSteps, stepNumber));
    if (target > currentStep) {
      for (let s = currentStep; s < target; s++) {
        const validation = validateWizardStep(s, getFormData());
        if (!validation.valid) {
          showErrors(validation.errors);
          return false;
        }
      }
    }
    updateStepView(target);
    return true;
  }

  function nextStep() {
    const validation = validateWizardStep(currentStep, getFormData());
    if (!validation.valid) {
      showErrors(validation.errors);
      return false;
    }

    if (currentStep === totalSteps) {
      const data = getFormData();
      clearWizardDraft(storage);
      triggerHaptic('success');
      close();
      if (typeof onComplete === 'function') {
        onComplete(data);
      }
      return true;
    }

    return goToStep(currentStep + 1);
  }

  function prevStep() {
    if (currentStep > 1) {
      return goToStep(currentStep - 1);
    }
    return false;
  }

  function showErrors(errors) {
    if (!errorBox) return;
    const escape = (str) => String(str || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
    errorBox.innerHTML = errors.map(err => `<p class="wizard-error-line">⚠️ ${escape(err)}</p>`).join('');
    errorBox.hidden = false;
    triggerHaptic('warning');
  }

  function open(initialData) {
    isOpen = true;
    if (startDateInput && !startDateInput.value) {
      startDateInput.value = new Date().toISOString().slice(0, 10);
    }

    // Check draft or initialData
    if (initialData) {
      setFormData(initialData);
    } else {
      const draft = getWizardDraft(storage);
      if (draft) {
        setFormData(draft);
      }
    }

    updateStepView(1);

    if (typeof modal.showModal === 'function') {
      try { modal.showModal(); } catch { modal.setAttribute('open', ''); }
    } else {
      modal.setAttribute('open', '');
    }

    if (nameInput) {
      setTimeout(() => { nameInput.focus(); }, 50);
    }
  }

  function close() {
    isOpen = false;
    if (typeof modal.close === 'function') {
      try { modal.close(); } catch { modal.removeAttribute('open'); }
    } else {
      modal.removeAttribute('open');
    }
    if (typeof onCancel === 'function') {
      onCancel();
    }
  }

  function reset() {
    clearWizardDraft(storage);
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (cnicInput) cnicInput.value = '';
    if (statusSelect) statusSelect.value = 'Active';
    if (areaSelect) areaSelect.value = 'Shahdara Town';
    if (mohallaInput) mohallaInput.value = '';
    if (addressInput) addressInput.value = '';
    if (fdbInput) fdbInput.value = '';
    if (portInput) portInput.value = '';
    if (packageSelect) packageSelect.value = '5mbps-150gb';
    if (rateInput) rateInput.value = '1500';
    if (feeInput) feeInput.value = '0';
    if (dueDateSelect) dueDateSelect.value = '10';
    if (ontSelect) ontSelect.value = 'ISP Provided';
    if (staticIpCheck) staticIpCheck.checked = false;
    if (startDateInput) startDateInput.value = new Date().toISOString().slice(0, 10);
    if (techNotesInput) techNotesInput.value = '';
    if (agreementCheck) agreementCheck.checked = false;
    updateStepView(1);
  }

  // Package select auto-updates monthly rate
  if (packageSelect && !packageSelect.dataset?.wiredWizard) {
    if (packageSelect.dataset) packageSelect.dataset.wiredWizard = 'true';
    packageSelect.addEventListener('change', () => {
      const selected = packageSelect.value;
      if (standardPackageRates[selected] && rateInput) {
        rateInput.value = String(standardPackageRates[selected]);
      }
    });
  }

  // Wire buttons
  if (closeBtn && !closeBtn.dataset?.wiredWizard) {
    if (closeBtn.dataset) closeBtn.dataset.wiredWizard = 'true';
    closeBtn.addEventListener('click', close);
  }
  if (backBtn && !backBtn.dataset?.wiredWizard) {
    if (backBtn.dataset) backBtn.dataset.wiredWizard = 'true';
    backBtn.addEventListener('click', prevStep);
  }
  if (nextBtn && !nextBtn.dataset?.wiredWizard) {
    if (nextBtn.dataset) nextBtn.dataset.wiredWizard = 'true';
    nextBtn.addEventListener('click', nextStep);
  }

  // Step pills click
  stepPills.forEach(pill => {
    if (!pill.dataset?.wiredWizard) {
      if (pill.dataset) pill.dataset.wiredWizard = 'true';
      pill.addEventListener('click', () => {
        const stepNum = Number(pill.getAttribute('data-wizard-step'));
        if (stepNum <= currentStep) {
          goToStep(stepNum);
        } else {
          nextStep();
        }
      });
    }
  });

  // Open trigger buttons
  if (openBtn && !openBtn.dataset?.wiredWizard) {
    if (openBtn.dataset) openBtn.dataset.wiredWizard = 'true';
    openBtn.addEventListener('click', () => open());
  }
  if (quickActionBtn && !quickActionBtn.dataset?.wiredWizard) {
    if (quickActionBtn.dataset) quickActionBtn.dataset.wiredWizard = 'true';
    quickActionBtn.addEventListener('click', () => open());
  }

  // Keyboard navigation
  modal.addEventListener('keydown', (e) => {
    if (!isOpen && !modal.open && !modal.hasAttribute('open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter' && e.target && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      nextStep();
    }
  });

  // Touch Swipe gesture support on track
  let touchStartX = 0;
  let touchStartY = 0;

  if (track && !track.dataset?.wiredSwipe) {
    if (track.dataset) track.dataset.wiredSwipe = 'true';
    track.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    track.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches[0]) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
          if (deltaX < -50) {
            nextStep();
          } else if (deltaX > 50) {
            prevStep();
          }
        }
      }
    }, { passive: true });
  }

  return {
    open,
    close,
    goToStep,
    nextStep,
    prevStep,
    getCurrentStep: () => currentStep,
    getFormData,
    setFormData,
    reset,
    isOpen: () => isOpen
  };
}

/**
 * Calculates optical link budget, fiber link attenuation, and ONU receive power.
 * Based on GPON ITU-T G.984 standards for FTTH distribution.
 */
export function calculateOpticalLinkBudget(options = {}) {
  const distanceKm = Math.max(0.1, parseFloat(options.distanceKm) || 2.0);
  const splitterRatio = String(options.splitterRatio || '1:8').trim();
  const connectorsCount = Math.max(0, parseInt(options.connectorsCount, 10) || 4);
  const spliceLossDb = Math.max(0, parseFloat(options.spliceLossDb) || 0.4);
  const fiberAttenuationDbPerKm = Math.max(0.1, parseFloat(options.fiberAttenuationDbPerKm) || 0.35);
  const oltTxPowerDbm = parseFloat(options.oltTxPowerDbm) || 4.5;
  const onuSensitivityDbm = parseFloat(options.onuSensitivityDbm) || -28.0;

  const SPLITTER_LOSSES = {
    '1:2': 3.7,
    '1:4': 7.2,
    '1:8': 10.5,
    '1:16': 13.8,
    '1:32': 17.1,
    '1:64': 20.5
  };

  const splitterLossDb = SPLITTER_LOSSES[splitterRatio] ?? 10.5;
  const fiberLossDb = parseFloat((distanceKm * fiberAttenuationDbPerKm).toFixed(2));
  const connectorsLossDb = parseFloat((connectorsCount * spliceLossDb).toFixed(2));
  const safetyMarginDb = 1.5;

  const totalLinkLossDb = parseFloat((splitterLossDb + fiberLossDb + connectorsLossDb + safetyMarginDb).toFixed(2));
  const estRxPowerDbm = parseFloat((oltTxPowerDbm - (splitterLossDb + fiberLossDb + connectorsLossDb)).toFixed(2));
  const linkMarginDb = parseFloat((estRxPowerDbm - onuSensitivityDbm).toFixed(2));

  let diagnosisTier = 'Excellent Optical Signal';
  let badgeClass = 'status-good';
  let advice = 'Optimal GPON optical link. Clean reception well within ONU sensitivity specs.';

  if (estRxPowerDbm < onuSensitivityDbm) {
    diagnosisTier = 'Critical Attenuation / Link Fault';
    badgeClass = 'status-danger';
    advice = 'Received signal below ONU sensitivity floor (-28 dBm). Link will drop or flap. Check drop cable micro-bends, bad splices, or dirty SC/APC connectors.';
  } else if (estRxPowerDbm <= -26.0) {
    diagnosisTier = 'Marginal Signal Warning';
    badgeClass = 'status-warn';
    advice = 'Optical power near cut-off threshold. Clean optical connectors, check outdoor patch box, verify splitter port insertion.';
  } else if (estRxPowerDbm <= -23.5) {
    diagnosisTier = 'Good / Standard Link';
    badgeClass = 'status-normal';
    advice = 'Stable link power. Suitable for all standard residential and commercial packages.';
  }

  return {
    distanceKm,
    splitterRatio,
    splitterLossDb,
    fiberLossDb,
    connectorsCount,
    connectorsLossDb,
    safetyMarginDb,
    totalLinkLossDb,
    oltTxPowerDbm,
    onuSensitivityDbm,
    estRxPowerDbm,
    linkMarginDb,
    diagnosisTier,
    badgeClass,
    advice
  };
}

/**
 * Calculates theoretical download throughput and peak hour CIR floor.
 */
export function calculateBandwidthThrottle(options = {}) {
  const speedMbps = Math.max(1, parseFloat(options.speedMbps) || 15);
  const contentionRatio = Math.max(1, parseInt(options.contentionRatio, 10) || 8);
  const simulatedLatencyMs = Math.max(1, parseInt(options.simulatedLatencyMs, 10) || 12);

  const downloadRateKbps = Math.round(speedMbps * 1024);
  const downloadRateKBps = Math.round(downloadRateKbps / 8);
  const downloadRateMBps = parseFloat((speedMbps / 8).toFixed(2));

  const peakCirMbps = parseFloat((speedMbps / contentionRatio).toFixed(2));
  const peakCirKBps = Math.round((peakCirMbps * 1024) / 8);

  const streams1080p = Math.max(1, Math.floor(speedMbps / 5));
  const streams4k = Math.max(0, Math.floor(speedMbps / 25));

  let latencyRating = 'Ultra-Low Latency (Local GPON Gateway)';
  let latencyBadge = 'status-good';
  if (simulatedLatencyMs > 60) {
    latencyRating = 'High Latency / Jitter Warning';
    latencyBadge = 'status-danger';
  } else if (simulatedLatencyMs > 30) {
    latencyRating = 'National Spine Latency (Karachi/Transit)';
    latencyBadge = 'status-warn';
  } else if (simulatedLatencyMs > 15) {
    latencyRating = 'Metro Core Latency (Lahore IXP)';
    latencyBadge = 'status-normal';
  }

  return {
    speedMbps,
    contentionRatio,
    downloadRateKbps,
    downloadRateKBps,
    downloadRateMBps,
    peakCirMbps,
    peakCirKBps,
    streams1080p,
    streams4k,
    simulatedLatencyMs,
    latencyRating,
    latencyBadge
  };
}

/**
 * Generates plain-text field diagnostic report for field technicians.
 */
export function generateFieldDiagnosticReportText(optical, bandwidth, options = {}) {
  const ref = (options.referenceDate instanceof Date && !isNaN(options.referenceDate))
    ? options.referenceDate
    : new Date();
  const dateStr = ref.toISOString().slice(0, 10);
  const area = options.area || 'Shahdara Area Drop';
  const customerName = options.customerName || 'General Subscriber Inspection';

  const lines = [
    '====================================================',
    'SHAHDARA ISP - FIELD CONNECTIVITY DIAGNOSTIC REPORT',
    '====================================================',
    `Date: ${dateStr} PKT | Target: ${customerName}`,
    `Location: ${area} | OLT Core: Shahdara Core Hub`,
    '',
    '----------------------------------------------------',
    '1. OPTICAL LINK BUDGET (FTTH GPON):',
    '----------------------------------------------------',
    `  Distance from OLT: ${optical.distanceKm} km`,
    `  Splitter Ratio: ${optical.splitterRatio} (Splitter Loss: ${optical.splitterLossDb} dB)`,
    `  Fiber Cable Loss: ${optical.fiberLossDb} dB (0.35 dB/km)`,
    `  Connectors / Splices: ${optical.connectorsCount} points (${optical.connectorsLossDb} dB)`,
    `  OLT Launch Power: +${optical.oltTxPowerDbm} dBm (Class C+)`,
    `  Est. Received Power (Rx): ${optical.estRxPowerDbm} dBm`,
    `  ONU Link Margin: +${optical.linkMarginDb} dB above threshold`,
    `  Optical Health: ${optical.diagnosisTier}`,
    `  Field Advice: ${optical.advice}`,
    '',
    '----------------------------------------------------',
    '2. BANDWIDTH & THROUGHPUT VERIFICATION:',
    '----------------------------------------------------',
    `  Subscribed Package Speed: ${bandwidth.speedMbps} Mbps`,
    `  Max Download Throughput: ${bandwidth.downloadRateMBps} MB/s (${bandwidth.downloadRateKBps} KB/s)`,
    `  Peak Concurrency CIR Floor: ${bandwidth.peakCirMbps} Mbps (Ratio 1:${bandwidth.contentionRatio})`,
    `  Video Streaming Capacity: ${bandwidth.streams1080p}x HD 1080p / ${bandwidth.streams4k}x 4K UHD`,
    `  Ping Latency: ${bandwidth.simulatedLatencyMs} ms (${bandwidth.latencyRating})`,
    '',
    '====================================================',
    'Technician Signature: _______________________________',
    'Shahdara Fiber Net Field Ops Support'
  ];

  return lines.join('\n');
}

/**
 * Wires the Field Diagnostics Modal dialog and interactive calculations.
 */
export function setupFieldDiagnosticsModal(options = {}) {
  if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;

  const modal = document.getElementById('fieldDiagnosticsModal');
  const openBtns = (typeof document.querySelectorAll === 'function')
    ? document.querySelectorAll('[data-open-field-diagnostics]')
    : [];
  const closeBtn = document.getElementById('fieldDiagnosticsCloseBtn');
  const copyBtn = document.getElementById('copyFieldDiagnosticReportBtn');
  const runPingBtn = document.getElementById('runPingTestBtn');

  const distInput = document.getElementById('diagDistanceInput');
  const splitterSelect = document.getElementById('diagSplitterSelect');
  const speedSelect = document.getElementById('diagSpeedSelect');
  const contentionSelect = document.getElementById('diagContentionSelect');

  const rxPowerVal = document.getElementById('diagRxPowerVal');
  const linkMarginVal = document.getElementById('diagLinkMarginVal');
  const diagStatusBadge = document.getElementById('diagStatusBadge');
  const diagAdviceText = document.getElementById('diagAdviceText');

  const maxSpeedVal = document.getElementById('diagMaxSpeedVal');
  const cirFloorVal = document.getElementById('diagCirFloorVal');
  const pingVal = document.getElementById('diagPingVal');
  const pingBadge = document.getElementById('diagPingBadge');

  const onToast = options.onToast;
  const clipboard = options.clipboard;

  let currentPingMs = 12;

  function recalculate() {
    const dist = parseFloat(distInput?.value) || 2.0;
    const split = splitterSelect?.value || '1:8';
    const speed = parseFloat(speedSelect?.value) || 15;
    const contention = parseInt(contentionSelect?.value, 10) || 8;

    const opt = calculateOpticalLinkBudget({ distanceKm: dist, splitterRatio: split });
    const bw = calculateBandwidthThrottle({ speedMbps: speed, contentionRatio: contention, simulatedLatencyMs: currentPingMs });

    if (rxPowerVal) rxPowerVal.textContent = `${opt.estRxPowerDbm} dBm`;
    if (linkMarginVal) linkMarginVal.textContent = `+${opt.linkMarginDb} dB`;
    if (diagStatusBadge) {
      diagStatusBadge.textContent = opt.diagnosisTier;
      diagStatusBadge.className = `role-badge ${opt.badgeClass === 'status-good' ? 'role-primary' : (opt.badgeClass === 'status-danger' ? 'role-danger' : 'role-warn')}`;
    }
    if (diagAdviceText) diagAdviceText.textContent = opt.advice;

    if (maxSpeedVal) maxSpeedVal.textContent = `${bw.downloadRateMBps} MB/s`;
    if (cirFloorVal) cirFloorVal.textContent = `${bw.peakCirMbps} Mbps`;
    if (pingVal) pingVal.textContent = `${bw.simulatedLatencyMs} ms`;
    if (pingBadge) {
      pingBadge.textContent = bw.latencyRating.split('(')[0].trim();
      pingBadge.className = `role-badge ${bw.latencyBadge === 'status-good' ? 'role-primary' : 'role-warn'}`;
    }

    return { opt, bw };
  }

  [distInput, splitterSelect, speedSelect, contentionSelect].forEach(input => {
    if (input && !input.dataset?.wiredDiag) {
      if (input.dataset) input.dataset.wiredDiag = 'true';
      input.addEventListener('change', recalculate);
      input.addEventListener('input', recalculate);
    }
  });

  if (runPingBtn && !runPingBtn.dataset?.wiredDiag) {
    if (runPingBtn.dataset) runPingBtn.dataset.wiredDiag = 'true';
    runPingBtn.addEventListener('click', () => {
      currentPingMs = Math.floor(Math.random() * 12) + 8;
      recalculate();
      if (typeof onToast === 'function') onToast(`Gateway ping test complete: ${currentPingMs} ms`);
    });
  }

  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredDiag) {
      if (btn.dataset) btn.dataset.wiredDiag = 'true';
      btn.addEventListener('click', () => {
        recalculate();
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  if (closeBtn && !closeBtn.dataset?.wiredDiag) {
    if (closeBtn.dataset) closeBtn.dataset.wiredDiag = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  if (copyBtn && !copyBtn.dataset?.wiredDiag) {
    if (copyBtn.dataset) copyBtn.dataset.wiredDiag = 'true';
    copyBtn.addEventListener('click', async () => {
      const { opt, bw } = recalculate();
      const text = generateFieldDiagnosticReportText(opt, bw);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Diagnostic report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this environment.');
      }
    });
  }

  return {
    recalculate,
    open: () => {
      recalculate();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    }
  };
}

/**
 * Technician Field Collection Route Sheet & Mobile Route Dispatcher (agent2 - shahdara-mobile-nav)
 */

export {
  FIELD_ROUTE_PROGRESS_KEY,
  FIELD_ROUTE_NOTES_KEY,
  FIELD_ROUTE_OUTCOMES_KEY,
  FIELD_ROUTE_ORDER_KEY,
  FIELD_ROUTE_OUTCOMES,
  getTodayDateString,
  getFieldRouteProgress,
  markRouteStopCollected,
  clearFieldRouteProgress,
  getFieldRouteNotes,
  saveFieldRouteNote,
  getFieldRouteOutcomes,
  saveFieldRouteOutcome,
  getFieldRouteCustomOrder,
  saveFieldRouteCustomOrder,
  moveRouteStop,
  calculateFieldCollectionRoutes,
  generateFieldRouteManifestText,
  generateFieldRouteSlipHtml,
  setupFieldRouteSheet
} from './nav-collection-rounds.js';



/* ==========================================================================
   Field Technician Work Order & Customer Service Dispatch Engine (agent2)
   ========================================================================== */

export const WORK_ORDERS_STORAGE_KEY = 'shahdara_field_work_orders_v1';

export const WORK_ORDER_CATEGORIES = {
  fiber_cut: { label: 'Red LOS / Fiber Break', icon: '🔴', defaultPriority: 'urgent' },
  low_signal: { label: 'High Loss / Low Optical Power', icon: '🟡', defaultPriority: 'high' },
  ont_fault: { label: 'ONT / ONU Hardware Fault', icon: '⚙️', defaultPriority: 'high' },
  wifi_config: { label: 'Wi-Fi Router Configuration', icon: '📶', defaultPriority: 'normal' },
  shift_line: { label: 'Shift / Relocate Connection', icon: '📦', defaultPriority: 'normal' },
  new_install: { label: 'New Drop Cable Installation', icon: '🔌', defaultPriority: 'normal' },
  speed_issue: { label: 'Speed Degradation / Packet Loss', icon: '⚡', defaultPriority: 'normal' },
  other: { label: 'General Service Request', icon: '📝', defaultPriority: 'normal' }
};

export const WORK_ORDER_PRIORITIES = {
  urgent: { label: 'Urgent', class: 'badge-alert', weight: 4 },
  high: { label: 'High', class: 'badge-warning', weight: 3 },
  normal: { label: 'Normal', class: 'badge-primary', weight: 2 },
  low: { label: 'Low', class: 'badge-neutral', weight: 1 }
};

export function getFieldWorkOrders(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(WORK_ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFieldWorkOrders(orders, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage || !Array.isArray(orders)) return;
  try {
    storage.setItem(WORK_ORDERS_STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Ignore storage quota
  }
}

export function clearFieldWorkOrders(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  try {
    storage.removeItem(WORK_ORDERS_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function createFieldWorkOrder(data = {}, storage = (typeof localStorage !== 'undefined' ? localStorage : null), nowStr) {
  const currentOrders = getFieldWorkOrders(storage);
  const dateIso = nowStr || new Date().toISOString();
  const dateStr = dateIso.slice(0, 10);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const ticketId = `WO-${dateStr.replace(/-/g, '').slice(2)}-${randomSuffix}`;

  const categoryKey = data.category && WORK_ORDER_CATEGORIES[data.category] ? data.category : 'other';
  const categoryInfo = WORK_ORDER_CATEGORIES[categoryKey];
  const priorityKey = data.priority && WORK_ORDER_PRIORITIES[data.priority] ? data.priority : categoryInfo.defaultPriority;

  const newOrder = {
    id: ticketId,
    customerId: data.customerId ? String(data.customerId) : null,
    customerName: String(data.customerName || 'Subscriber Service Request').trim(),
    username: String(data.username || '').trim(),
    phone: String(data.phone || '').trim(),
    area: String(data.area || 'Shahdara Town').trim(),
    address: String(data.address || '').trim(),
    category: categoryKey,
    categoryLabel: categoryInfo.label,
    categoryIcon: categoryInfo.icon,
    priority: priorityKey,
    status: 'open',
    notes: String(data.notes || '').trim(),
    assignedTech: String(data.assignedTech || 'Field Line Worker').trim(),
    createdAt: dateIso,
    updatedAt: dateIso,
    resolvedAt: null,
    resolutionNotes: '',
    history: [
      {
        timestamp: dateIso,
        action: 'Created Ticket',
        tech: String(data.assignedTech || 'Field Line Worker').trim()
      }
    ]
  };

  currentOrders.unshift(newOrder);
  saveFieldWorkOrders(currentOrders, storage);
  return newOrder;
}

export function updateFieldWorkOrderStatus(orderId, newStatus, resolutionNotes = '', storage = (typeof localStorage !== 'undefined' ? localStorage : null), nowStr) {
  const currentOrders = getFieldWorkOrders(storage);
  const target = currentOrders.find(o => o.id === orderId);
  const dateIso = nowStr || new Date().toISOString();

  if (!target) return null;

  target.status = newStatus;
  target.updatedAt = dateIso;
  if (resolutionNotes) {
    target.resolutionNotes = String(resolutionNotes).trim();
  }
  if (newStatus === 'resolved') {
    target.resolvedAt = dateIso;
  } else if (newStatus !== 'resolved' && target.resolvedAt) {
    target.resolvedAt = null;
  }

  if (!Array.isArray(target.history)) {
    target.history = [];
  }
  target.history.push({
    timestamp: dateIso,
    action: `Status marked as ${newStatus.replace('_', ' ').toUpperCase()}`,
    notes: resolutionNotes ? String(resolutionNotes).trim() : ''
  });

  saveFieldWorkOrders(currentOrders, storage);
  return target;
}

export function calculateFieldWorkOrders(state, {
  sector = 'All',
  status = 'all',
  priority = 'all',
  searchQuery = '',
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  nowStr = new Date().toISOString().slice(0, 10)
} = {}) {
  const customers = Array.isArray(state?.customers) ? state.customers : [];
  const storedOrders = getFieldWorkOrders(storage);
  const activeOrdersMap = new Map();

  storedOrders.forEach(order => {
    activeOrdersMap.set(order.id, order);
    if (order.customerId && order.status !== 'resolved' && order.status !== 'cancelled') {
      activeOrdersMap.set(`cust-${order.customerId}`, order);
    }
  });

  const allOrders = [...storedOrders];

  customers.forEach(cust => {
    if (cust.archived) return;
    if (cust.status === 'offline') {
      const autoId = `AUTO-OFFLINE-${cust.id}`;
      if (!activeOrdersMap.has(autoId) && !activeOrdersMap.has(`cust-${cust.id}`)) {
        const cat = WORK_ORDER_CATEGORIES.fiber_cut;
        const autoTicket = {
          id: autoId,
          customerId: cust.id,
          customerName: cust.name || 'Offline Subscriber',
          username: cust.username || cust.id,
          phone: cust.phone || '',
          area: cust.area || cust.mohalla || 'Shahdara Town',
          address: [cust.address, cust.mohalla].filter(Boolean).join(', ') || cust.area || 'Shahdara Town',
          category: 'fiber_cut',
          categoryLabel: cat.label,
          categoryIcon: cat.icon,
          priority: 'urgent',
          status: 'open',
          notes: 'Automatic alert: Subscriber connection offline. Suspected physical fiber break or power loss at customer premises.',
          assignedTech: 'Field Line Worker',
          createdAt: `${nowStr}T08:00:00Z`,
          updatedAt: `${nowStr}T08:00:00Z`,
          resolvedAt: null,
          resolutionNotes: '',
          isAutoGenerated: true,
          history: []
        };
        allOrders.push(autoTicket);
      }
    }
  });

  let totalOrders = 0;
  let openOrders = 0;
  let inProgressOrders = 0;
  let resolvedCount = 0;
  let urgentCount = 0;
  let highPriorityCount = 0;
  let slaBreachedCount = 0;

  const nowTime = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  allOrders.forEach(o => {
    if (o.status === 'cancelled') return;
    totalOrders++;
    if (o.status === 'open') openOrders++;
    if (o.status === 'in_progress') inProgressOrders++;
    if (o.status === 'resolved') resolvedCount++;
    if (o.priority === 'urgent' && o.status !== 'resolved') urgentCount++;
    if (o.priority === 'high' && o.status !== 'resolved') highPriorityCount++;

    if (o.status !== 'resolved') {
      const createdTime = Date.parse(o.createdAt || nowStr);
      if (!Number.isNaN(createdTime) && (nowTime - createdTime) > dayMs) {
        slaBreachedCount++;
      }
    }
  });

  const activeCount = openOrders + inProgressOrders;
  const resolutionRate = totalOrders > 0 ? Math.round((resolvedCount / totalOrders) * 100) : 100;

  const sectorSet = new Set(['All']);
  allOrders.forEach(o => {
    if (o.area && o.area.trim()) sectorSet.add(o.area.trim());
  });
  customers.forEach(c => {
    const a = (c.area || c.mohalla || '').trim();
    if (a) sectorSet.add(a);
  });
  const sectors = Array.from(sectorSet).sort();

  const q = String(searchQuery || '').trim().toLowerCase();
  const selSector = String(sector || 'All').trim();
  const selStatus = String(status || 'all').trim().toLowerCase();
  const selPriority = String(priority || 'all').trim().toLowerCase();

  const filtered = allOrders.filter(o => {
    if (selSector !== 'All' && o.area?.toLowerCase() !== selSector.toLowerCase()) {
      return false;
    }

    if (selStatus === 'urgent') {
      if (o.priority !== 'urgent' || o.status === 'resolved' || o.status === 'cancelled') {
        return false;
      }
    } else if (selStatus !== 'all') {
      if (o.status !== selStatus) return false;
    }

    if (selPriority !== 'all') {
      if (o.priority !== selPriority) return false;
    }

    if (q) {
      const match =
        o.id.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.username && o.username.toLowerCase().includes(q)) ||
        (o.phone && o.phone.includes(q)) ||
        (o.address && o.address.toLowerCase().includes(q)) ||
        (o.area && o.area.toLowerCase().includes(q)) ||
        (o.categoryLabel && o.categoryLabel.toLowerCase().includes(q)) ||
        (o.notes && o.notes.toLowerCase().includes(q)) ||
        (o.assignedTech && o.assignedTech.toLowerCase().includes(q));
      if (!match) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    const statusWeight = (s) => (s === 'in_progress' ? 3 : s === 'open' ? 2 : s === 'resolved' ? 1 : 0);
    const priorityWeight = (p) => (p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'normal' ? 2 : 1);

    const pwDiff = priorityWeight(b.priority) - priorityWeight(a.priority);
    if (pwDiff !== 0) return pwDiff;

    const swDiff = statusWeight(b.status) - statusWeight(a.status);
    if (swDiff !== 0) return swDiff;

    return Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0);
  });

  const enrichedOrders = filtered.map((o, idx) => {
    const rawPhone = String(o.phone || '').trim();
    let phoneUrl = '';
    let whatsappUrl = '';
    if (rawPhone) {
      const cleanPhone = rawPhone.replace(/\D/g, '');
      phoneUrl = `tel:${rawPhone.startsWith('+') ? rawPhone : '+92' + (cleanPhone.startsWith('92') ? cleanPhone.slice(2) : cleanPhone.replace(/^0/, ''))}`;
      const intlPhone = cleanPhone.startsWith('92') ? cleanPhone : `92${cleanPhone.replace(/^0/, '')}`;
      const waText = encodeURIComponent(`Assalam-o-Alaikum ${o.customerName}, Shahdara Fiber Net field technician is on the way for Ticket #${o.id} (${o.categoryLabel}).`);
      whatsappUrl = `https://wa.me/${intlPhone}?text=${waText}`;
    }

    const mapQuery = encodeURIComponent([o.customerName, o.address, o.area, 'Shahdara Lahore'].filter(Boolean).join(', '));
    const mapsQueryUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    return {
      ...o,
      ticketIndex: idx + 1,
      phoneUrl,
      whatsappUrl,
      mapsQueryUrl
    };
  });

  return {
    date: nowStr,
    selectedSector: selSector,
    selectedStatus: selStatus,
    selectedPriority: selPriority,
    totalOrders,
    openOrders,
    inProgressOrders,
    activeCount,
    resolvedCount,
    urgentCount,
    highPriorityCount,
    slaBreachedCount,
    resolutionRate,
    sectors,
    orders: enrichedOrders
  };
}

export function generateWorkOrderManifestText(woData = {}) {
  const date = woData.date || new Date().toISOString().slice(0, 10);
  const sector = woData.selectedSector || 'All Sectors';
  const orders = Array.isArray(woData.orders) ? woData.orders : [];

  let text = `⚡ *SHAHDARA FIBER NET — FIELD WORK ORDER MANIFEST*\n`;
  text += `📅 Date: ${date} | 📍 Sector: ${sector}\n`;
  text += `📊 Summary: ${woData.openOrders ?? 0} Open, ${woData.inProgressOrders ?? 0} In Progress, ${woData.urgentCount ?? 0} Urgent, ${woData.resolvedCount ?? 0} Resolved (${woData.resolutionRate ?? 0}% Completion)\n`;
  text += `─────────────────────────────────────────\n`;

  if (orders.length === 0) {
    text += `🎉 No pending field service tickets matching current filter.\n`;
  } else {
    orders.forEach((o, i) => {
      const statusIcon = o.status === 'resolved' ? '✅ [RESOLVED]' : o.status === 'in_progress' ? '⚡ [IN PROGRESS]' : o.priority === 'urgent' ? '🔴 [URGENT]' : '🟡 [OPEN]';
      text += `${i + 1}. ${statusIcon} *#${o.id}* — ${o.categoryLabel}\n`;
      text += `   👤 ${o.customerName}${o.username ? ` (@${o.username})` : ''}\n`;
      text += `   📍 ${o.address ? `${o.address} ` : ''}[${o.area}]\n`;
      if (o.phone) text += `   📞 ${o.phone}\n`;
      if (o.assignedTech) text += `   👷 Assigned: ${o.assignedTech}\n`;
      if (o.notes) text += `   📝 Note: ${o.notes}\n`;
      if (o.resolutionNotes) text += `   ✨ Resolution: ${o.resolutionNotes}\n`;
      text += `\n`;
    });
  }

  text += `─────────────────────────────────────────\n`;
  text += `⚠️ Field Line Staff: Confirm fiber fusion splice optical power (-15 to -22 dBm) before marking resolved.`;
  return text;
}

export function setupFieldWorkOrderSheet({
  getState,
  storage = (typeof localStorage !== 'undefined' ? localStorage : null),
  onNavigateCustomer,
  onToast,
  clipboard = (typeof navigator !== 'undefined' ? navigator.clipboard : null)
} = {}) {
  if (typeof document === 'undefined') {
    return {
      recalculate: () => null,
      getWorkOrderData: () => null,
      open: () => {},
      close: () => {},
      setState: () => {}
    };
  }

  const modal = document.getElementById('fieldWorkOrderModal');
  if (!modal) {
    return {
      recalculate: () => null,
      getWorkOrderData: () => null,
      open: () => {},
      close: () => {},
      setState: () => {}
    };
  }

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const closeBtn = document.getElementById('fieldWorkOrderCloseBtn');
  const sectorFilter = document.getElementById('woSectorFilter');
  const statusFilter = document.getElementById('woStatusFilter');
  const priorityFilter = document.getElementById('woPriorityFilter');
  const searchInput = document.getElementById('woSearchInput');
  const ordersList = document.getElementById('fieldWorkOrderList');
  const emptyState = document.getElementById('woEmptyState');

  const metricOpen = document.getElementById('woMetricOpen');
  const metricInProgress = document.getElementById('woMetricInProgress');
  const metricUrgent = document.getElementById('woMetricUrgent');
  const metricResolved = document.getElementById('woMetricResolved');

  const toggleNewBtn = document.getElementById('woToggleNewBtn');
  const newTicketPanel = document.getElementById('woNewTicketPanel');
  const closeNewTicketBtn = document.getElementById('woCloseNewTicketBtn');
  const newTicketForm = document.getElementById('woNewTicketForm');
  const formCustomerSelect = document.getElementById('woFormCustomer');
  const formCategorySelect = document.getElementById('woFormCategory');
  const formPrioritySelect = document.getElementById('woFormPriority');
  const formTechInput = document.getElementById('woFormTech');
  const formNotesInput = document.getElementById('woFormNotes');

  const copyBtn = document.getElementById('copyWorkOrderManifestBtn');
  const shareWhatsappBtn = document.getElementById('shareWorkOrderWhatsappBtn');
  const openBtns = Array.from(document.querySelectorAll('[data-open-work-orders]'));

  let currentState = typeof getState === 'function' ? getState() : null;
  let lastData = null;

  function updateUi() {
    currentState = typeof getState === 'function' ? getState() : currentState;
    const selectedSector = sectorFilter?.value || 'All';
    const selectedStatus = statusFilter?.value || 'urgent';
    const selectedPriority = priorityFilter?.value || 'all';
    const searchQuery = searchInput?.value || '';

    const woData = calculateFieldWorkOrders(currentState, {
      sector: selectedSector,
      status: selectedStatus,
      priority: selectedPriority,
      searchQuery,
      storage
    });
    lastData = woData;

    if (metricOpen) metricOpen.textContent = String(woData.openOrders);
    if (metricInProgress) metricInProgress.textContent = String(woData.inProgressOrders);
    if (metricUrgent) metricUrgent.textContent = String(woData.urgentCount);
    if (metricResolved) metricResolved.textContent = String(woData.resolvedCount);

    if (sectorFilter && woData.sectors) {
      const currentVal = sectorFilter.value;
      const opts = woData.sectors.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
      if (sectorFilter.dataset.lastSectors !== JSON.stringify(woData.sectors)) {
        sectorFilter.innerHTML = opts;
        sectorFilter.dataset.lastSectors = JSON.stringify(woData.sectors);
        if (woData.sectors.includes(currentVal)) {
          sectorFilter.value = currentVal;
        } else {
          sectorFilter.value = 'All';
        }
      }
    }

    if (formCustomerSelect && currentState?.customers) {
      const activeCusts = currentState.customers.filter(c => !c.archived);
      const custOpts = [
        '<option value="">-- Select Subscriber --</option>',
        ...activeCusts.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.area || 'Shahdara')})</option>`)
      ].join('');
      if (formCustomerSelect.dataset.lastCustCount !== String(activeCusts.length)) {
        formCustomerSelect.innerHTML = custOpts;
        formCustomerSelect.dataset.lastCustCount = String(activeCusts.length);
      }
    }

    if (ordersList) {
      ordersList.innerHTML = '';
      if (!woData.orders || woData.orders.length === 0) {
        if (emptyState) emptyState.hidden = false;
      } else {
        if (emptyState) emptyState.hidden = true;
        woData.orders.forEach(order => {
          const card = document.createElement('div');
          card.className = `work-order-card is-${order.status} is-priority-${order.priority}`;
          card.setAttribute('role', 'listitem');

          const statusBadge = order.status === 'resolved'
            ? '<span class="role-badge role-primary">Resolved</span>'
            : order.status === 'in_progress'
            ? '<span class="role-badge role-warning">In Progress</span>'
            : '<span class="role-badge role-alert">Open</span>';

          const priorityBadge = order.priority === 'urgent'
            ? '<span class="role-badge badge-alert">🔴 Urgent</span>'
            : order.priority === 'high'
            ? '<span class="role-badge badge-warning">🟡 High</span>'
            : '<span class="role-badge badge-neutral">Normal</span>';

          card.innerHTML = `
            <div class="wo-card-top">
              <div class="wo-card-header">
                <span class="wo-card-ticket-id">#${esc(order.id)}</span>
                <span class="wo-card-category">${esc(order.categoryIcon || '🛠️')} ${esc(order.categoryLabel)}</span>
                ${priorityBadge}
                ${statusBadge}
              </div>
              <div class="wo-card-subscriber">
                <strong class="wo-card-name">${esc(order.customerName)}</strong>
                ${order.username ? `<span class="wo-card-user">@${esc(order.username)}</span>` : ''}
              </div>
              <div class="wo-card-meta">
                <span class="wo-card-addr">📍 ${esc(order.address || order.area)} [${esc(order.area)}]</span>
                <span class="wo-card-tech">👷 Tech: ${esc(order.assignedTech)}</span>
              </div>
              ${order.notes ? `<div class="wo-card-notes">📝 ${esc(order.notes)}</div>` : ''}
              ${order.resolutionNotes ? `<div class="wo-card-res-notes">✨ Resolved: ${esc(order.resolutionNotes)}</div>` : ''}
              <div class="wo-card-contact-row">
                ${order.phoneUrl ? `<a href="${order.phoneUrl}" class="action-btn-sm" aria-label="Call ${esc(order.customerName)}">📞 Call</a>` : ''}
                ${order.whatsappUrl ? `<a href="${order.whatsappUrl}" target="_blank" rel="noopener noreferrer" class="action-btn-sm" aria-label="WhatsApp ${esc(order.customerName)}">💬 WhatsApp</a>` : ''}
                <a href="${order.mapsQueryUrl}" target="_blank" rel="noopener noreferrer" class="action-btn-sm" aria-label="Navigate to ${esc(order.customerName)}">🗺️ Map</a>
              </div>
            </div>
            <div class="wo-card-actions">
              ${order.status === 'open' ? `<button type="button" class="action-btn-sm primary-sm" data-wo-start="${esc(order.id)}">⚡ Start Work</button>` : ''}
              ${order.status === 'in_progress' ? `<button type="button" class="action-btn-sm primary-sm" data-wo-resolve="${esc(order.id)}">✅ Mark Resolved</button>` : ''}
              ${order.status === 'resolved' ? `<button type="button" class="action-btn-sm" data-wo-reopen="${esc(order.id)}">↺ Reopen</button>` : ''}
              ${order.customerId ? `<button type="button" class="action-btn-sm" data-wo-profile="${esc(order.customerId)}">Profile</button>` : ''}
            </div>
          `;
          ordersList.appendChild(card);
        });
      }
    }

    const badge = document.querySelector('[data-nav-badge="work-orders"]');
    if (badge) {
      const activeTickets = woData.openOrders + woData.inProgressOrders;
      badge.textContent = activeTickets > 99 ? '99+' : String(activeTickets);
      badge.hidden = activeTickets === 0;
      badge.classList.toggle('badge-alert', woData.urgentCount > 0);
    }

    return woData;
  }

  if (sectorFilter && !sectorFilter.dataset?.wiredWo) {
    if (sectorFilter.dataset) sectorFilter.dataset.wiredWo = 'true';
    sectorFilter.addEventListener('change', () => {
      triggerHaptic('selection');
      updateUi();
    });
  }

  if (statusFilter && !statusFilter.dataset?.wiredWo) {
    if (statusFilter.dataset) statusFilter.dataset.wiredWo = 'true';
    statusFilter.addEventListener('change', () => {
      triggerHaptic('selection');
      updateUi();
    });
  }

  if (priorityFilter && !priorityFilter.dataset?.wiredWo) {
    if (priorityFilter.dataset) priorityFilter.dataset.wiredWo = 'true';
    priorityFilter.addEventListener('change', () => {
      triggerHaptic('selection');
      updateUi();
    });
  }

  if (searchInput && !searchInput.dataset?.wiredWo) {
    if (searchInput.dataset) searchInput.dataset.wiredWo = 'true';
    searchInput.addEventListener('input', () => {
      updateUi();
    });
  }

  if (ordersList && !ordersList.dataset?.wiredWo) {
    if (ordersList.dataset) ordersList.dataset.wiredWo = 'true';
    ordersList.addEventListener('click', (e) => {
      const startBtn = e.target.closest('[data-wo-start]');
      if (startBtn) {
        const ticketId = startBtn.getAttribute('data-wo-start');
        triggerHaptic('medium');
        if (ticketId.startsWith('AUTO-OFFLINE-')) {
          const custId = ticketId.replace('AUTO-OFFLINE-', '');
          const cust = currentState?.customers?.find(c => c.id === custId);
          if (cust) {
            const created = createFieldWorkOrder({
              customerId: cust.id,
              customerName: cust.name,
              username: cust.username,
              phone: cust.phone,
              area: cust.area || 'Shahdara Town',
              address: cust.address,
              category: 'fiber_cut',
              priority: 'urgent',
              notes: 'Field worker initiated repair for offline connection.'
            }, storage);
            updateFieldWorkOrderStatus(created.id, 'in_progress', 'Technician on-site inspecting fiber drop.', storage);
          }
        } else {
          updateFieldWorkOrderStatus(ticketId, 'in_progress', 'Technician en route to location.', storage);
        }
        updateUi();
        if (typeof onToast === 'function') onToast('Ticket status updated: In Progress');
        return;
      }

      const resolveBtn = e.target.closest('[data-wo-resolve]');
      if (resolveBtn) {
        const ticketId = resolveBtn.getAttribute('data-wo-resolve');
        triggerHaptic('medium');
        updateFieldWorkOrderStatus(ticketId, 'resolved', 'Fiber splice verified with optimal optical power.', storage);
        updateUi();
        if (typeof onToast === 'function') onToast('Ticket marked as resolved!');
        return;
      }

      const reopenBtn = e.target.closest('[data-wo-reopen]');
      if (reopenBtn) {
        const ticketId = reopenBtn.getAttribute('data-wo-reopen');
        triggerHaptic('selection');
        updateFieldWorkOrderStatus(ticketId, 'open', 'Ticket reopened for further inspection.', storage);
        updateUi();
        if (typeof onToast === 'function') onToast('Ticket reopened.');
        return;
      }

      const profileBtn = e.target.closest('[data-wo-profile]');
      if (profileBtn) {
        const custId = profileBtn.getAttribute('data-wo-profile');
        triggerHaptic('selection');
        if (typeof modal?.close === 'function') modal.close();
        else if (modal) modal.removeAttribute('open');
        if (typeof onNavigateCustomer === 'function') {
          onNavigateCustomer(custId);
        }
        return;
      }
    });
  }

  if (toggleNewBtn && !toggleNewBtn.dataset?.wiredWo) {
    if (toggleNewBtn.dataset) toggleNewBtn.dataset.wiredWo = 'true';
    toggleNewBtn.addEventListener('click', () => {
      if (newTicketPanel) {
        newTicketPanel.hidden = !newTicketPanel.hidden;
        if (!newTicketPanel.hidden) {
          formCustomerSelect?.focus();
        }
      }
    });
  }

  if (closeNewTicketBtn && !closeNewTicketBtn.dataset?.wiredWo) {
    if (closeNewTicketBtn.dataset) closeNewTicketBtn.dataset.wiredWo = 'true';
    closeNewTicketBtn.addEventListener('click', () => {
      if (newTicketPanel) newTicketPanel.hidden = true;
    });
  }

  if (newTicketForm && !newTicketForm.dataset?.wiredWo) {
    if (newTicketForm.dataset) newTicketForm.dataset.wiredWo = 'true';
    newTicketForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const custId = formCustomerSelect?.value;
      const cust = currentState?.customers?.find(c => c.id === custId);
      if (!cust && !custId) {
        if (typeof onToast === 'function') onToast('Please select a subscriber account.');
        return;
      }

      const category = formCategorySelect?.value || 'other';
      const priority = formPrioritySelect?.value || 'normal';
      const tech = formTechInput?.value || 'Field Line Worker';
      const notes = formNotesInput?.value || '';

      const created = createFieldWorkOrder({
        customerId: cust ? cust.id : null,
        customerName: cust ? cust.name : 'Subscriber Ticket',
        username: cust ? cust.username : '',
        phone: cust ? cust.phone : '',
        area: cust ? (cust.area || cust.mohalla || 'Shahdara Town') : 'Shahdara Town',
        address: cust ? (cust.address || '') : '',
        category,
        priority,
        assignedTech: tech,
        notes
      }, storage);

      triggerHaptic('success');
      newTicketForm.reset();
      if (newTicketPanel) newTicketPanel.hidden = true;
      updateUi();
      if (typeof onToast === 'function') onToast(`Work Order #${created.id} created and dispatched!`);
    });
  }

  if (copyBtn && !copyBtn.dataset?.wiredWo) {
    if (copyBtn.dataset) copyBtn.dataset.wiredWo = 'true';
    copyBtn.addEventListener('click', async () => {
      const woData = updateUi();
      const text = generateWorkOrderManifestText(woData);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Work order manifest copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this browser.');
      }
    });
  }

  if (shareWhatsappBtn && !shareWhatsappBtn.dataset?.wiredWo) {
    if (shareWhatsappBtn.dataset) shareWhatsappBtn.dataset.wiredWo = 'true';
    shareWhatsappBtn.addEventListener('click', () => {
      const woData = updateUi();
      const text = generateWorkOrderManifestText(woData);
      const encoded = encodeURIComponent(text);
      const whatsappUrl = `https://wa.me/?text=${encoded}`;
      if (typeof window !== 'undefined' && typeof window.open === 'function') {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }
      if (typeof onToast === 'function') onToast('Opening WhatsApp dispatch...');
    });
  }

  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredWoOpen) {
      if (btn.dataset) btn.dataset.wiredWoOpen = 'true';
      btn.addEventListener('click', () => {
        updateUi();
        triggerHaptic('medium');
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  if (closeBtn && !closeBtn.dataset?.wiredWo) {
    if (closeBtn.dataset) closeBtn.dataset.wiredWo = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    recalculate: updateUi,
    getWorkOrderData: () => lastData,
    open: () => {
      updateUi();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    },
    setState: (newState) => {
      currentState = newState;
      updateUi();
    }
  };
}

/**
 * =========================================================================
 * Mobile Offline Sync Conflict Resolver & Parallel Field Receipt Reconciler
 * =========================================================================
 */

export const SYNC_CONFLICT_STORAGE_KEY = 'shahdara_sync_conflicts_v1';

export function getSyncConflicts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.getItem !== 'function') return [];
  try {
    const raw = store.getItem(SYNC_CONFLICT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveSyncConflicts(conflicts, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.setItem !== 'function') return false;
  try {
    store.setItem(SYNC_CONFLICT_STORAGE_KEY, JSON.stringify(conflicts || []));
    return true;
  } catch {
    return false;
  }
}

export function recordSyncConflict(conflict = {}, storage) {
  const list = getSyncConflicts(storage);
  const now = new Date().toISOString();
  const dateTag = now.slice(2, 10).replace(/-/g, '');
  const randTag = Math.floor(1000 + Math.random() * 9000);
  const id = conflict.id || `CONF-${dateTag}-${randTag}`;

  const existingIdx = list.findIndex(c => c.id === id);
  const existing = existingIdx !== -1 ? list[existingIdx] : {};

  const entry = {
    id,
    type: conflict.type || existing.type || 'DUPLICATE_PAYMENT',
    severity: conflict.severity || existing.severity || 'warning',
    status: conflict.status || existing.status || 'pending',
    title: conflict.title || existing.title || 'Sync Conflict',
    customerId: conflict.customerId !== undefined ? conflict.customerId : (existing.customerId || null),
    customerName: conflict.customerName || existing.customerName || 'Subscriber',
    username: conflict.username || existing.username || '',
    phone: conflict.phone !== undefined ? conflict.phone : (existing.phone || ''),
    area: conflict.area || existing.area || 'Shahdara Town',
    billMonth: conflict.billMonth !== undefined ? conflict.billMonth : (existing.billMonth || null),
    disputedPkr: conflict.disputedPkr !== undefined ? Number(conflict.disputedPkr) : (existing.disputedPkr || 0),
    diff: conflict.diff || existing.diff || { local: {}, incoming: {} },
    suggestedAction: conflict.suggestedAction || existing.suggestedAction || 'smart_merge',
    resolutionStrategy: conflict.resolutionStrategy !== undefined ? conflict.resolutionStrategy : (existing.resolutionStrategy || null),
    resolvedAt: conflict.resolvedAt || existing.resolvedAt || null,
    resolvedBy: conflict.resolvedBy || existing.resolvedBy || null,
    resolutionNote: conflict.resolutionNote || existing.resolutionNote || null,
    createdAt: conflict.createdAt || existing.createdAt || now,
    ...existing,
    ...conflict
  };

  if (existingIdx !== -1) {
    list[existingIdx] = entry;
  } else {
    list.unshift(entry);
  }

  saveSyncConflicts(list, storage);
  return entry;
}

export function resolveSyncConflict(conflictId, resolutionStrategy, storage, { resolvedBy = 'Counter Owner', resolutionNote = '' } = {}) {
  const list = getSyncConflicts(storage);
  const idx = list.findIndex(c => c.id === conflictId);
  const now = new Date().toISOString();

  let resolved;
  if (idx !== -1) {
    resolved = {
      ...list[idx],
      status: 'resolved',
      resolutionStrategy,
      resolvedAt: now,
      resolvedBy,
      resolutionNote: resolutionNote || `Resolved via ${resolutionStrategy}`
    };
    list[idx] = resolved;
  } else {
    resolved = {
      id: conflictId,
      status: 'resolved',
      resolutionStrategy,
      resolvedAt: now,
      resolvedBy,
      resolutionNote: resolutionNote || `Resolved via ${resolutionStrategy}`
    };
    list.unshift(resolved);
  }

  saveSyncConflicts(list, storage);
  return resolved;
}

export function clearSyncConflicts(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store || typeof store.removeItem !== 'function') return;
  try {
    store.removeItem(SYNC_CONFLICT_STORAGE_KEY);
  } catch {}
}

export function detectSyncConflicts(state, options = {}) {
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const filter = options.filter || 'all';
  const query = (options.query || '').toLowerCase().trim();

  let queue = [];
  if (Array.isArray(options.pendingQueue)) {
    queue = options.pendingQueue;
  } else if (storage && typeof storage.getItem === 'function') {
    try {
      const raw = storage.getItem('shahdara_offline_payment_queue');
      if (raw) queue = JSON.parse(raw);
    } catch {}
  }

  const storedConflicts = getSyncConflicts(storage);
  const detectedList = [...storedConflicts];

  const customers = Array.isArray(state?.customers) ? state.customers.filter(c => !c.archived) : [];

  for (const item of queue) {
    if (!item) continue;
    const cust = customers.find(c => c.id === item.customerId || (item.customerName && c.name?.toLowerCase() === item.customerName.toLowerCase()));
    if (!cust) continue;

    const itemMonth = item.billMonth || item.month;
    const itemAmount = Number(item.amount || item.collectedAmount || 0);

    // Check 1: Duplicate Payment for same bill month
    if (itemMonth && Array.isArray(cust.bills)) {
      const bill = cust.bills.find(b => b.month === itemMonth);
      const isAlreadyPaid = bill && (bill.status === 'paid' || Number(bill.dueAmount || 0) === 0);
      if (isAlreadyPaid) {
        const conflictKey = `dup-${cust.id}-${itemMonth}`;
        const alreadyInList = detectedList.some(c => c.id === conflictKey || (c.customerId === cust.id && c.billMonth === itemMonth && c.type === 'DUPLICATE_PAYMENT'));
        if (!alreadyInList) {
          detectedList.push({
            id: conflictKey,
            type: 'DUPLICATE_PAYMENT',
            severity: 'critical',
            status: 'pending',
            title: `Duplicate Payment on Paid Bill (${itemMonth})`,
            customerId: cust.id,
            customerName: cust.name,
            username: cust.username || '',
            phone: cust.phone || '',
            area: cust.area || cust.mohalla || 'Shahdara Town',
            billMonth: itemMonth,
            disputedPkr: itemAmount,
            diff: {
              local: {
                billMonth: itemMonth,
                status: 'Already Paid (Ledger Settled)',
                dueAmount: 0,
                collector: 'Shop Register'
              },
              incoming: {
                billMonth: itemMonth,
                amount: itemAmount,
                method: item.method || 'Cash',
                receiptId: item.receiptId || item.id || 'OFFLINE-TX',
                collector: item.collectorName || 'Field Van Collector'
              }
            },
            suggestedAction: 'smart_merge',
            createdAt: item.createdAt || new Date().toISOString()
          });
        }
      } else if (bill && itemAmount > Number(bill.dueAmount || bill.amount || 0)) {
        // Check 2: Overpayment
        const diffPkr = itemAmount - Number(bill.dueAmount || bill.amount || 0);
        const conflictKey = `over-${cust.id}-${itemMonth}`;
        const alreadyInList = detectedList.some(c => c.id === conflictKey || (c.customerId === cust.id && c.billMonth === itemMonth && c.type === 'OVERPAYMENT_EXCESS'));
        if (!alreadyInList) {
          detectedList.push({
            id: conflictKey,
            type: 'OVERPAYMENT_EXCESS',
            severity: 'warning',
            status: 'pending',
            title: `Collection Exceeds Stored Balance (${itemMonth})`,
            customerId: cust.id,
            customerName: cust.name,
            username: cust.username || '',
            phone: cust.phone || '',
            area: cust.area || cust.mohalla || 'Shahdara Town',
            billMonth: itemMonth,
            disputedPkr: diffPkr,
            diff: {
              local: {
                billMonth: itemMonth,
                expectedDue: Number(bill.dueAmount || bill.amount || 0),
                packagePrice: cust.packagePrice || 1500
              },
              incoming: {
                billMonth: itemMonth,
                submittedAmount: itemAmount,
                excessCarryForward: diffPkr,
                method: item.method || 'Cash'
              }
            },
            suggestedAction: 'accept_incoming',
            createdAt: item.createdAt || new Date().toISOString()
          });
        }
      }
    }

    // Check 3: Profile Data Drift
    if (item.phone && item.phone !== cust.phone) {
      const conflictKey = `drift-phone-${cust.id}`;
      const alreadyInList = detectedList.some(c => c.id === conflictKey);
      if (!alreadyInList) {
        detectedList.push({
          id: conflictKey,
          type: 'PROFILE_DATA_DRIFT',
          severity: 'info',
          status: 'pending',
          title: 'Subscriber Mobile Number Drift',
          customerId: cust.id,
          customerName: cust.name,
          username: cust.username || '',
          phone: cust.phone || '',
          area: cust.area || cust.mohalla || 'Shahdara Town',
          billMonth: itemMonth || null,
          disputedPkr: 0,
          diff: {
            local: {
              phone: cust.phone,
              address: cust.address || ''
            },
            incoming: {
              phone: item.phone,
              address: item.address || cust.address || ''
            }
          },
          suggestedAction: 'accept_incoming',
          createdAt: item.createdAt || new Date().toISOString()
        });
      }
    }
  }

  // Filter items
  const filtered = detectedList.filter(item => {
    if (filter === 'critical' && item.severity !== 'critical') return false;
    if (filter === 'payment' && item.type !== 'DUPLICATE_PAYMENT' && item.type !== 'OVERPAYMENT_EXCESS') return false;
    if (filter === 'profile' && item.type !== 'PROFILE_DATA_DRIFT') return false;
    if (filter === 'duplicate' && item.type !== 'DUPLICATE_PAYMENT') return false;
    if (filter === 'overpayment' && item.type !== 'OVERPAYMENT_EXCESS') return false;
    if (filter === 'drift' && item.type !== 'PROFILE_DATA_DRIFT') return false;
    if (filter === 'resolved' && item.status !== 'resolved') return false;
    if (filter !== 'resolved' && item.status === 'resolved' && filter !== 'all') return false;

    if (query) {
      const matchName = item.customerName?.toLowerCase().includes(query);
      const matchPhone = item.phone?.toLowerCase().includes(query);
      const matchArea = item.area?.toLowerCase().includes(query);
      const matchTitle = item.title?.toLowerCase().includes(query);
      if (!matchName && !matchPhone && !matchArea && !matchTitle) return false;
    }
    return true;
  });

  const pendingItems = detectedList.filter(c => c.status === 'pending');
  const criticalCount = pendingItems.filter(c => c.severity === 'critical').length;
  const warningCount = pendingItems.filter(c => c.severity === 'warning').length;
  const driftCount = pendingItems.filter(c => c.type === 'PROFILE_DATA_DRIFT').length;
  const resolvedCount = detectedList.filter(c => c.status === 'resolved').length;
  const totalDisputedPkr = pendingItems.reduce((sum, c) => sum + (c.disputedPkr || 0), 0);
  const autoResolvableCount = pendingItems.filter(c => c.severity !== 'critical').length;
  const resolutionRate = detectedList.length > 0 ? Math.round((resolvedCount / detectedList.length) * 100) : 100;

  return {
    conflicts: filtered,
    allConflicts: detectedList,
    summary: {
      totalCount: pendingItems.length,
      allTotalCount: detectedList.length,
      criticalCount,
      warningCount,
      driftCount,
      resolvedCount,
      totalDisputedPkr,
      autoResolvableCount,
      resolutionRate
    }
  };
}

export function autoResolveSafeConflicts(state, storage, options = {}) {
  const data = detectSyncConflicts(state, { storage, pendingQueue: options.pendingQueue });
  const pending = data.allConflicts.filter(c => c.status === 'pending' && c.severity !== 'critical');

  let resolvedCount = 0;
  for (const c of pending) {
    resolveSyncConflict(c.id, c.suggestedAction || 'accept_incoming', storage, {
      resolvedBy: 'Auto-Reconciliation Engine',
      resolutionNote: 'Auto-resolved safe non-critical conflict'
    });
    resolvedCount++;
  }
  return resolvedCount;
}

export function generateSyncConflictReport(conflictData, options = {}) {
  const data = conflictData || detectSyncConflicts();
  const summary = data.summary || {};
  const dateStr = options.dateStr || new Date().toISOString().slice(0, 10);

  const lines = [
    '================================================================',
    'SHAHDARA ISP — OFFLINE SYNC CONFLICT & RECONCILIATION AUDIT',
    '================================================================',
    `Date: ${dateStr} PKT | Reconciliation Engine: Active`,
    `Pending Conflicts: ${summary.totalCount} (${summary.criticalCount} Critical Duplicates)`,
    `Disputed Ledger Volume: PKR ${(summary.totalDisputedPkr || 0).toLocaleString()}`,
    `Reconciliation Rate: ${summary.resolutionRate}% (${summary.resolvedCount} Resolved)`,
    '----------------------------------------------------------------',
    'DISPUTED ITEMS & FIELD SUBMISSION BREAKDOWN:',
    '----------------------------------------------------------------'
  ];

  if (!data.conflicts || data.conflicts.length === 0) {
    lines.push('No pending sync conflicts recorded. All field receipts reconciled.');
  } else {
    data.conflicts.forEach((c, idx) => {
      lines.push(
        `${idx + 1}. [${c.severity.toUpperCase()}] *#${c.id}* — ${c.title}`,
        `   Subscriber: ${c.customerName} (${c.area || 'Shahdara'}) | 📞 ${c.phone || 'N/A'}`,
        `   Disputed Volume: PKR ${(c.disputedPkr || 0).toLocaleString()} | Status: ${c.status}`,
        `   Suggested Action: ${c.suggestedAction} | Resolved: ${c.resolutionStrategy || 'Pending'}`
      );
    });
  }

  lines.push('');
  lines.push('----------------------------------------------------------------');
  lines.push('OWNER RECONCILIATION INSTRUCTIONS:');
  lines.push('----------------------------------------------------------------');
  lines.push('• Critical Duplicates: Verify physical cash collection with field collector before marking.');
  lines.push('• Overpayments: Accepted incoming amounts are credited to subscriber account for next month.');
  lines.push('• Profile Drift: Updated mobile numbers are synchronized automatically across all devices.');
  lines.push('================================================================');

  return lines.join('\n');
}

/**
 * Controller for the Mobile Offline Sync Conflict Resolver Modal Dialog.
 */
export function setupSyncConflictModal({
  getState,
  storage,
  onNavigateCustomer,
  onToast,
  clipboard
} = {}) {
  if (typeof document === 'undefined') return { recalculate: () => {}, open: () => {}, close: () => {} };

  const modal = document.getElementById('syncConflictModal');
  const closeBtn = document.getElementById('syncConflictCloseBtn');
  const openBtns = document.querySelectorAll('[data-open-sync-conflicts]');

  const filterBtns = document.querySelectorAll('[data-conflict-filter]');
  const searchInput = document.getElementById('conflictSearchInput');
  const listContainer = document.getElementById('syncConflictList');

  const countPill = document.getElementById('conflictTotalCountVal');
  const disputedPkrPill = document.getElementById('conflictDisputedPkrVal');
  const criticalPill = document.getElementById('conflictCriticalCountVal');
  const ratePill = document.getElementById('conflictResolutionRateVal');

  const autoResolveBtn = document.getElementById('autoResolveSafeConflictsBtn');
  const copyReportBtn = document.getElementById('copySyncConflictReportBtn');

  let currentFilter = 'all';
  let searchQuery = '';
  let currentState = typeof getState === 'function' ? getState() : null;

  function updateUi() {
    const state = typeof getState === 'function' ? getState() : currentState;
    const conflictData = detectSyncConflicts(state, {
      storage,
      filter: currentFilter,
      query: searchQuery
    });

    const summary = conflictData.summary;

    if (countPill) countPill.textContent = `${summary.totalCount} Pending`;
    if (disputedPkrPill) disputedPkrPill.textContent = `PKR ${(summary.totalDisputedPkr || 0).toLocaleString()}`;
    if (criticalPill) criticalPill.textContent = `${summary.criticalCount} Critical`;
    if (ratePill) ratePill.textContent = `${summary.resolutionRate}% Done`;

    updateNavigationBadges(state, { conflictsCount: summary.totalCount });

    if (!listContainer) return conflictData;

    if (!conflictData.conflicts || conflictData.conflicts.length === 0) {
      listContainer.innerHTML = `
        <div class="work-order-empty-state">
          <span class="work-order-empty-icon">✨</span>
          <h5 class="work-order-empty-title">All Sync Items Reconciled</h5>
          <p class="work-order-empty-sub">No offline conflict submissions pending for Shahdara ledger.</p>
        </div>
      `;
      return conflictData;
    }

    listContainer.innerHTML = conflictData.conflicts.map(c => {
      const isResolved = c.status === 'resolved';
      const isCritical = c.severity === 'critical';
      const isWarning = c.severity === 'warning';

      const cardClass = `conflict-card ${isResolved ? 'is-resolved' : (isCritical ? 'is-critical' : (isWarning ? 'is-warning' : ''))}`;

      let localDiffHtml = '';
      if (c.diff?.local) {
        localDiffHtml = Object.entries(c.diff.local).map(([k, v]) => `<div><strong>${escapeXml(k)}:</strong> ${escapeXml(String(v))}</div>`).join('');
      }

      let incomingDiffHtml = '';
      if (c.diff?.incoming) {
        incomingDiffHtml = Object.entries(c.diff.incoming).map(([k, v]) => `<div><strong>${escapeXml(k)}:</strong> ${escapeXml(String(v))}</div>`).join('');
      }

      return `
        <div class="${cardClass}" data-conflict-id="${escapeXml(c.id)}">
          <div class="conflict-card-header">
            <div class="conflict-card-title-group">
              <span class="wo-card-ticket-id">#${escapeXml(c.id)}</span>
              <span class="conflict-type-tag ${c.severity}">${escapeXml(c.type.replace(/_/g, ' '))}</span>
              <h5 class="conflict-title">${escapeXml(c.title)}</h5>
            </div>
            <div class="conflict-card-meta">
              <span class="conflict-subscriber-name">${escapeXml(c.customerName)}</span>
              <span class="text-muted">(${escapeXml(c.area || 'Shahdara')})</span>
              ${c.disputedPkr > 0 ? `<strong class="conflict-amount-pill">PKR ${c.disputedPkr.toLocaleString()}</strong>` : ''}
            </div>
          </div>

          <div class="conflict-diff-grid">
            <div class="diff-column diff-column-local">
              <h6 class="diff-column-header">🏛️ Local Saved Ledger</h6>
              <div class="diff-content">${localDiffHtml || 'No local record'}</div>
            </div>
            <div class="diff-column diff-column-incoming">
              <h6 class="diff-column-header">📱 Incoming Offline Submission</h6>
              <div class="diff-content">${incomingDiffHtml || 'No incoming payload'}</div>
            </div>
          </div>

          <div class="conflict-card-footer">
            <div class="conflict-status-info">
              ${isResolved
                ? `<span class="badge-resolved">✅ Resolved via ${escapeXml(c.resolutionStrategy)}</span>`
                : `<span class="badge-pending">⚠️ Suggested: ${escapeXml(c.suggestedAction)}</span>`}
            </div>
            <div class="conflict-actions-group">
              ${!isResolved ? `
                <button type="button" class="btn-conflict-action btn-accept" data-resolve-id="${escapeXml(c.id)}" data-strategy="accept_incoming">Accept Incoming</button>
                <button type="button" class="btn-conflict-action btn-keep" data-resolve-id="${escapeXml(c.id)}" data-strategy="keep_local">Keep Local</button>
                <button type="button" class="btn-conflict-action btn-merge" data-resolve-id="${escapeXml(c.id)}" data-strategy="smart_merge">Smart Merge</button>
              ` : `
                <button type="button" class="btn-conflict-action btn-reopen" data-reopen-id="${escapeXml(c.id)}">Reopen</button>
              `}
              ${c.customerId && typeof onNavigateCustomer === 'function' ? `
                <button type="button" class="btn-conflict-action btn-profile" data-nav-cust-id="${escapeXml(c.customerId)}">Profile</button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Wire conflict resolution buttons
    listContainer.querySelectorAll('[data-resolve-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-resolve-id');
        const strategy = btn.getAttribute('data-strategy');
        resolveSyncConflict(id, strategy, storage, {
          resolvedBy: 'Owner Console',
          resolutionNote: `Manual resolution via ${strategy}`
        });
        triggerHaptic('success');
        updateUi();
        if (typeof onToast === 'function') onToast(`Conflict #${id} resolved using ${strategy}!`);
      });
    });

    listContainer.querySelectorAll('[data-reopen-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-reopen-id');
        recordSyncConflict({ id, status: 'pending', resolutionStrategy: null }, storage);
        triggerHaptic('selection');
        updateUi();
        if (typeof onToast === 'function') onToast(`Conflict #${id} reopened.`);
      });
    });

    listContainer.querySelectorAll('[data-nav-cust-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const custId = btn.getAttribute('data-nav-cust-id');
        if (typeof onNavigateCustomer === 'function' && custId) {
          if (typeof modal?.close === 'function') modal.close();
          else if (modal) modal.removeAttribute('open');
          onNavigateCustomer(custId);
        }
      });
    });

    return conflictData;
  }

  // Wire filter buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      currentFilter = btn.getAttribute('data-conflict-filter') || 'all';
      triggerHaptic('selection');
      updateUi();
    });
  });

  // Wire search input
  if (searchInput && !searchInput.dataset?.wiredConflict) {
    if (searchInput.dataset) searchInput.dataset.wiredConflict = 'true';
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value || '';
      updateUi();
    });
  }

  // Wire auto-resolve button
  if (autoResolveBtn && !autoResolveBtn.dataset?.wiredConflict) {
    if (autoResolveBtn.dataset) autoResolveBtn.dataset.wiredConflict = 'true';
    autoResolveBtn.addEventListener('click', () => {
      const state = typeof getState === 'function' ? getState() : currentState;
      const count = autoResolveSafeConflicts(state, storage);
      triggerHaptic('success');
      updateUi();
      if (typeof onToast === 'function') {
        onToast(count > 0 ? `Auto-resolved ${count} safe sync conflicts!` : 'No safe conflicts eligible for auto-resolve.');
      }
    });
  }

  // Wire copy report button
  if (copyReportBtn && !copyReportBtn.dataset?.wiredConflict) {
    if (copyReportBtn.dataset) copyReportBtn.dataset.wiredConflict = 'true';
    copyReportBtn.addEventListener('click', async () => {
      const state = typeof getState === 'function' ? getState() : currentState;
      const conflictData = detectSyncConflicts(state, { storage });
      const text = generateSyncConflictReport(conflictData);
      const clip = clipboard || (typeof navigator !== 'undefined' ? navigator.clipboard : null);
      if (clip && typeof clip.writeText === 'function') {
        try {
          await clip.writeText(text);
          if (typeof onToast === 'function') onToast('Conflict report copied to clipboard!');
        } catch {
          if (typeof onToast === 'function') onToast('Failed to copy to clipboard.');
        }
      } else if (typeof onToast === 'function') {
        onToast('Clipboard not supported in this browser.');
      }
    });
  }

  // Wire open buttons
  openBtns.forEach(btn => {
    if (!btn.dataset?.wiredConflictOpen) {
      if (btn.dataset) btn.dataset.wiredConflictOpen = 'true';
      btn.addEventListener('click', () => {
        updateUi();
        triggerHaptic('medium');
        if (typeof modal?.showModal === 'function') modal.showModal();
        else if (modal) modal.setAttribute('open', '');
      });
    }
  });

  // Wire close button
  if (closeBtn && !closeBtn.dataset?.wiredConflict) {
    if (closeBtn.dataset) closeBtn.dataset.wiredConflict = 'true';
    closeBtn.addEventListener('click', () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (typeof modal?.close === 'function') modal.close();
        else modal.removeAttribute('open');
      }
    });
  }

  return {
    recalculate: updateUi,
    open: () => {
      updateUi();
      if (typeof modal?.showModal === 'function') modal.showModal();
      else if (modal) modal.setAttribute('open', '');
    },
    close: () => {
      if (typeof modal?.close === 'function') modal.close();
      else if (modal) modal.removeAttribute('open');
    },
    setState: (newState) => {
      currentState = newState;
      updateUi();
    }
  };
}

export {
  SHAHDARA_OPTICAL_NODES,
  OPTICAL_STORAGE_KEY,
  getOpticalMeasurements,
  saveOpticalMeasurements,
  recordOpticalMeasurement,
  clearOpticalMeasurements,
  calculateOpticalSignalMapMetrics,
  renderOpticalSignalMapSvg,
  generateOpticalSignalMapReport,
  setupOpticalSignalMapModal
} from './nav-optical-map.js';

export {
  SHAHDARA_VEHICLE_FLEET,
  SHAHDARA_STANDARD_HARDWARE,
  VEHICLE_STORAGE_KEY,
  getVehicleInventoryStore,
  saveVehicleInventoryStore,
  recordVehicleTransfer,
  calculateVehicleStock,
  renderVehicleInventorySvg,
  generateVehicleTransferReceipt,
  setupVehicleTransferModal
} from './nav-van-inventory.js';

export {
  AERIAL_ALERTS_STORAGE_KEY,
  SHAHDARA_AERIAL_SECTORS,
  getAerialInspectionsStore,
  saveAerialInspectionsStore,
  recordAerialInspection,
  clearAerialInspectionsStore,
  calculateCatenarySag,
  calculateAerialAlertsSummary,
  renderAerialCatenarySvg,
  generateAerialHazardWorkOrder,
  setupAerialAlertsModal
} from './nav-aerial-alerts.js';

export {
  OTDR_TRACE_STORAGE_KEY,
  SHAHDARA_OTDR_CORRIDORS,
  OTDR_THRESHOLDS,
  getOtdrSelectedCorridor,
  setOtdrSelectedCorridor,
  getOtdrSelectedWavelength,
  setOtdrSelectedWavelength,
  getOtdrSelectedPulseWidth,
  setOtdrSelectedPulseWidth,
  resetOtdrMobileState,
  getOtdrMobileTracesStore,
  saveOtdrMobileTracesStore,
  recordOtdrEventResolution,
  clearOtdrMobileTracesStore,
  calculateOtdrTracePhysics,
  calculateOtdrMobileSummary,
  renderMobileOtdrTraceSvg,
  generateOtdrDispatchOrder,
  setupMobileOtdrTraceModal
} from './nav-otdr-trace.js';

export {
  GPS_BREADCRUMBS_STORAGE_KEY,
  SHAHDARA_FIELD_NODES,
  haversineDistanceMeters,
  calculateBearingDegrees,
  evaluateNodeGeofence,
  findNearestFieldNode,
  getGpsBreadcrumbsStore,
  saveGpsBreadcrumbsStore,
  clearGpsBreadcrumbsStore,
  recordGpsBreadcrumb,
  calculateBreadcrumbMetrics,
  generateTechnicianLocationShare,
  renderMobileGpsBreadcrumbsSvg,
  setupMobileGpsBreadcrumbsModal
} from './nav-gps-tracking.js';

export {
  OPM_TEST_LOGS_STORAGE_KEY,
  OPM_CALIBRATED_WAVELENGTHS,
  OPM_TEST_POINTS,
  CONNECTOR_POLISH_TYPES,
  CONTAMINATION_LEVELS,
  dBmToMilliwatts,
  milliwattsToDbm,
  calculateInsertionLoss,
  evaluateOpmSignalGrade,
  calculateLinkLossBudget,
  getOpmTestLogsStore,
  saveOpmTestLogsStore,
  recordOpmTestLog,
  clearOpmTestLogsStore,
  generateOpmFieldReport,
  renderMobileOpmGaugeSvg,
  calculateFiberAttenuation,
  estimateMaxAllowableDropDistanceKm,
  evaluateReturnLossSafety,
  setupMobileOpmTestingModal
} from './nav-opm-testing.js';

export {
  VFL_TEST_LOGS_STORAGE_KEY,
  TIA_598_COLOR_CODES,
  VFL_CABLE_TYPES,
  VFL_LASER_MODES,
  VFL_POWER_LEVELS,
  VFL_FAULT_CONDITIONS,
  SHAHDARA_OSP_CABINETS,
  resolveFiberCoreFromNumber,
  resolveCoreNumberFromTubeAndFiber,
  getVflTestLogsStore,
  saveVflTestLogsStore,
  recordVflTestLog,
  clearVflTestLogsStore,
  generateVflFieldReport,
  renderMobileVflLaserSvg,
  setupMobileVflModal
} from './nav-vfl-tracer.js';

export {
  FUSION_SPLICE_STORAGE_KEY,
  FUSION_FIBER_TYPES,
  FUSION_ALIGN_MODES,
  FUSION_SLEEVE_TYPES,
  FUSION_SLEEVE_STATUSES,
  SPLICE_QUALITY_GRADES,
  SHAHDARA_SPLICE_CLOSURES,
  calculateEstimatedSpliceLoss,
  evaluateSpliceQuality,
  getSpliceAuditStore,
  saveSpliceAuditStore,
  recordSpliceAudit,
  clearSpliceAuditStore,
  renderMobileSpliceSvg,
  generateSpliceWhatsAppReport,
  setupMobileFusionSpliceModal
} from './nav-fusion-splice.js';

export {
  WIFI_SURVEY_STORAGE_KEY,
  WIFI_FREQUENCY_BANDS,
  WIFI_SIGNAL_GRADES,
  OBSTACLE_TYPES,
  SHAHDARA_ROOM_ZONES,
  calculateEstimatedRssi,
  calculateChannelInterferencePenalty,
  evaluateWifiSignalQuality,
  getWifiSurveyStore,
  saveWifiSurveyStore,
  recordWifiSurvey,
  clearWifiSurveyStore,
  renderMobileWifiSurveySvg,
  generateWifiSurveyReport,
  setupMobileWifiSurveyModal
} from './nav-wifi-survey.js';

export {
  OPTICAL_BUDGET_STORAGE_KEY,
  PON_OPTICAL_STANDARDS,
  SPLITTER_LOSS_TABLE,
  WAVELENGTH_ATTENUATION_TABLE,
  BUDGET_QUALITY_GRADES,
  SHAHDARA_FEEDER_PRESETS,
  calculateFiberDistanceLoss,
  calculateSplitterLoss,
  calculateSplicesAndConnectorsLoss,
  evaluateOpticalBudgetQuality,
  calculateOpticalLinkBudget as calculateFieldOpticalBudget,
  getOpticalBudgetStore,
  saveOpticalBudgetStore,
  recordOpticalBudgetCalculation,
  clearOpticalBudgetStore,
  renderMobileOpticalBudgetSvg,
  generateOpticalBudgetWhatsAppReport,
  setupMobileOpticalBudgetModal
} from './nav-optical-budget.js';

export {
  FDT_ALLOCATIONS_STORAGE_KEY,
  PORT_STATUSES,
  FDT_CONNECTOR_POLISH_TYPES,
  OPTICAL_POWER_STANDARDS,
  DROP_SPAN_LIMITS,
  DEFAULT_SHAHDARA_FAT_ENCLOSURES,
  calculateFatCapacitySummary,
  evaluatePortOpticalHealth,
  evaluateDropCableSpan,
  getFatAllocationsStore,
  saveFatAllocationsStore,
  updatePortAllocation,
  resetPortToSpare,
  resetFatStoreToDefault,
  renderMobileFdtMatrixSvg,
  generateFdtAllocationWhatsAppReport,
  setupMobileFdtAllocationModal
} from './nav-fdt-allocation.js';

export {
  ONT_DIAGNOSTICS_STORAGE_KEY,
  ONT_MODELS,
  ONT_PRESETS,
  evaluateOntRxPower,
  evaluateOntTxPower,
  evaluateOntLaserBias,
  evaluateOntTemperature,
  evaluateOntVoltage,
  diagnoseOntHealth,
  getOntDiagnosticsStore,
  saveOntDiagnosticsStore,
  recordOntDiagnosticLog,
  clearOntDiagnosticsStore,
  renderMobileOntDiagnosticsSvg,
  generateOntDiagnosticsWhatsAppReport,
  setupMobileOntDiagnosticsModal
} from './nav-ont-diagnostics.js';

export {
  FIBER_PROBE_STORAGE_KEY,
  CONNECTOR_TYPES,
  IEC_ZONES,
  INSPECTION_PRESETS,
  CLEANING_METHODS,
  evaluateDefectZone,
  evaluateIec61300Criteria,
  remediateConnectorCleaning,
  getFiberProbeStore,
  saveFiberProbeStore,
  recordFiberProbeAudit,
  clearFiberProbeStore,
  renderMobileFiberProbeSvg,
  generateFiberProbeWhatsAppReport,
  setupMobileFiberProbeModal
} from './nav-fiber-probe.js';

export {
  SPLITTER_TREE_STORAGE_KEY,
  BALANCED_SPLITTERS,
  TAP_SPLITTERS,
  ODN_CLASSES,
  SHAHDARA_CASCADE_PRESETS,
  calculateSplitterLoss as calculateSplitterTreeLoss,
  calculateCascadedBranchBudget,
  getSplitterTreeStore,
  saveSplitterTreeStore,
  recordSplitterTreeAudit,
  clearSplitterTreeStore,
  getDefaultSplitterTreeAudits,
  renderMobileSplitterTreeSvg,
  generateSplitterTreeWhatsAppReport,
  setupMobileSplitterTreeModal
} from './nav-splitter-tree.js';

export {
  MACRO_BEND_STORAGE_KEY,
  FIBER_STANDARDS,
  WAVELENGTH_BEND_FACTORS,
  CABLE_CONSTRUCTIONS,
  SHAHDARA_MACRO_BEND_PRESETS,
  calculateMacroBendLoss,
  getMacroBendStore,
  saveMacroBendStore,
  recordMacroBendAudit,
  clearMacroBendStore,
  getDefaultMacroBendAudits,
  renderMobileMacroBendSvg,
  generateMacroBendWhatsAppReport,
  setupMobileMacroBendModal
} from './nav-macro-bend.js';

export {
  OPTICAL_ATTENUATOR_STORAGE_KEY,
  ONU_RECEIVER_CLASSES,
  ATTENUATOR_HARDWARE_TYPES,
  ATTENUATOR_FIELD_PRESETS,
  calculateAttenuationLoss,
  renderMobileAttenuatorSvg,
  getDefaultAttenuatorAudits,
  getAttenuatorStore,
  saveAttenuatorStore,
  recordAttenuatorAudit,
  clearAttenuatorStore,
  generateAttenuatorWhatsAppReport,
  setupMobileAttenuatorModal
} from './nav-optical-attenuator.js';

export {
  OPTICAL_RETURN_LOSS_STORAGE_KEY,
  OPTICAL_NETWORK_STANDARDS,
  ORL_CONNECTOR_POLISH_TYPES,
  ORL_FIELD_PRESETS,
  calculateOpticalReturnLoss,
  renderMobileOrlSvg,
  getDefaultOrlAudits,
  getOrlStore,
  saveOrlStore,
  recordOrlAudit,
  clearOrlStore,
  generateOrlWhatsAppReport,
  setupMobileOrlModal
} from './nav-optical-return-loss.js';

export {
  FIBER_CLEAVER_STORAGE_KEY,
  CLEAVER_MODELS,
  CLEAVE_DEFECT_TYPES,
  CLEAVE_ANGLE_SPEC,
  calculateCleaverPositionDynamics,
  calculateCleaverAuditMetrics,
  renderCleaverDialSvg,
  generateCleaverAuditReport,
  generateCleaverWhatsAppDispatch,
  loadCleaverAuditLog,
  saveCleaverAuditLog,
  clearCleaverAuditLog,
  exportCleaverAuditsCsv,
  setupMobileCleaverModal
} from './nav-fiber-cleaver.js';

export {
  OLTS_CERT_STORAGE_KEY,
  OLTS_WAVELENGTHS,
  REFERENCE_METHODS,
  OLTS_CONNECTOR_TYPES,
  OLTS_SPLICE_TYPES,
  OLTS_PRESETS,
  calculateTier1LossBudget,
  calculateBidirectionalCertification,
  renderOltsCertificationSvg,
  renderOltsReferenceDiagramSvg,
  generateOltsAuditReport,
  generateOltsWhatsAppDispatch,
  loadOltsAuditLog,
  saveOltsAuditLog,
  clearOltsAuditLog,
  exportOltsAuditsCsv,
  setupMobileOltsModal
} from './nav-olts-cert.js';

export {
  FIBER_IDENTIFIER_STORAGE_KEY,
  CLAMP_ADAPTER_HEADS,
  DETECTED_SIGNAL_MODES,
  TRAFFIC_DIRECTIONS,
  IDENTIFIER_PRESETS,
  evaluateLiveFiberDetection,
  renderFiberIdentifierSvg,
  generateFiberIdentifierReport,
  generateFiberIdentifierWhatsAppDispatch,
  loadFiberIdentifierAuditLog,
  saveFiberIdentifierAuditLog,
  clearFiberIdentifierAuditLog,
  exportFiberIdentifierAuditsCsv,
  setupMobileFiberIdentifierModal
} from './nav-fiber-identifier.js';

export {
  MPO_POLARITY_STORAGE_KEY,
  TIA598_COLOR_CODES,
  POLARITY_METHODS,
  CONNECTOR_GENDERS,
  MPO_PRESETS,
  calculateMpoChannelMapping,
  renderMpoPolaritySvg,
  generateMpoPolarityReport,
  generateMpoPolarityWhatsAppDispatch,
  loadMpoPolarityAuditLog,
  saveMpoPolarityAuditLog,
  clearMpoPolarityAuditLog,
  exportMpoPolarityAuditsCsv,
  setupMobileMpoModal
} from './nav-mpo-polarity.js';

export {
  FAST_CONNECTOR_STORAGE_KEY,
  FAST_CONNECTOR_TYPES,
  GEL_CONDITIONS,
  FAST_CONNECTOR_PRESETS,
  calculateFastConnectorMetrics,
  renderFastConnectorDiagramSvg,
  formatFastConnectorWhatsApp,
  generateFastConnectorCsv,
  setupMobileFastConnectorModal
} from './nav-fast-connector.js';

export {
  OTDR_LAUNCH_STORAGE_KEY,
  OTDR_PULSE_WIDTHS,
  OTDR_LAUNCH_FIBER_TYPES,
  OTDR_LAUNCH_WAVELENGTHS,
  OTDR_LAUNCH_PRESETS,
  calculateOtdrLaunchMetrics,
  renderOtdrLaunchDiagramSvg,
  formatOtdrLaunchWhatsApp,
  generateOtdrLaunchCsv,
  setupMobileOtdrLaunchModal
} from './nav-otdr-launch-cable.js';

export {
  BARE_FIBER_ADAPTER_STORAGE_KEY,
  BFA_CONNECTOR_TYPES,
  INDEX_MATCHING_CONDITIONS,
  VGROOVE_CONDITIONS,
  BFA_PRESETS,
  calculateBareFiberAdapterMetrics,
  renderBareFiberAdapterSvg,
  formatBareFiberAdapterWhatsApp,
  loadBareFiberAdapterAuditLog,
  saveBareFiberAdapterAuditLog,
  clearBareFiberAdapterAuditLog,
  generateBareFiberAdapterCsv,
  setupMobileBareFiberAdapterModal
} from './nav-bare-fiber-adapter.js';

export {
  SLS_TONE_STORAGE_KEY,
  SLS_WAVELENGTHS,
  SLS_MODULATION_MODES,
  SLS_CONNECTOR_TYPES,
  SLS_PRESETS,
  dbmToMilliwatts,
  calculateSlsMetrics,
  renderSlsDiagramSvg,
  formatSlsToneWhatsApp,
  loadSlsToneAuditLog,
  saveSlsToneAuditLog,
  clearSlsToneAuditLog,
  generateSlsToneCsv,
  setupMobileSlsToneModal
} from './nav-stabilized-light-source.js';

export {
  FIBER_TALKSET_STORAGE_KEY,
  TALKSET_UNITS,
  TALKSET_SPLITTER_OPTIONS,
  TALKSET_PRESETS,
  calculateFiberTalksetMetrics,
  renderFiberTalksetSvg,
  formatFiberTalksetWhatsApp,
  loadFiberTalksetAuditLog,
  saveFiberTalksetAuditLog,
  clearFiberTalksetAuditLog,
  generateFiberTalksetCsv,
  setupMobileFiberTalksetModal
} from './nav-fiber-talkset.js';

export {
  WDM_SPECTRUM_STORAGE_KEY,
  WDM_GRIDS,
  WDM_PRESETS,
  calculateChromaticDispersion,
  calculateWdmSpectrumMetrics,
  renderWdmSpectrumSvg,
  formatWdmSpectrumWhatsApp,
  generateWdmSpectrumCsv,
  loadWdmSpectrumAuditLog,
  saveWdmSpectrumAuditLog,
  clearWdmSpectrumAuditLog,
  setupMobileWdmSpectrumModal
} from './nav-wdm-spectrum.js';

export {
  MIDSPAN_ACCESS_STORAGE_KEY,
  MIDSPAN_CABLE_CONSTRUCTIONS,
  SLITTER_TOOL_TYPES,
  MIDSPAN_PRESETS,
  calculateMidspanAccessMetrics,
  renderMidspanAccessSvg,
  formatMidspanAccessWhatsApp,
  generateMidspanAccessCsv,
  loadMidspanAccessAuditLog,
  saveMidspanAccessAuditLog,
  clearMidspanAccessAuditLog,
  setupMobileMidspanAccessModal
} from './nav-midspan-access.js';

export {
  POWER_LOGGER_STORAGE_KEY,
  POWER_LOGGER_PRESETS,
  calculatePowerLoggerMetrics,
  renderPowerLoggerSvg,
  formatPowerLoggerWhatsApp,
  generatePowerLoggerCsv,
  loadPowerLoggerAuditLog,
  savePowerLoggerAuditLog,
  clearPowerLoggerAuditLog,
  setupMobilePowerLoggerModal
} from './nav-power-logger.js';

export {
  DROP_RETENTION_STORAGE_KEY,
  RETENTION_CLAMP_TYPES,
  RETENTION_CABLE_TYPES,
  RETENTION_PRESETS,
  calculateDropRetentionMetrics,
  renderDropRetentionSvg,
  formatDropRetentionWhatsApp,
  generateDropRetentionCsv,
  loadDropRetentionAuditLog,
  saveDropRetentionAuditLog,
  clearDropRetentionAuditLog,
  setupMobileDropRetentionModal
} from './nav-drop-retention.js';

export {
  REF_JUMPERS_STORAGE_KEY,
  REFERENCING_METHODS,
  JUMPER_GRADES,
  REF_JUMPERS_PRESETS,
  calculateReferenceJumpersMetrics,
  renderReferenceJumpersSvg,
  formatReferenceJumpersWhatsAppText,
  generateReferenceJumpersCsv,
  loadReferenceJumpersAuditLog,
  saveReferenceJumpersAuditLog,
  clearReferenceJumpersAuditLog,
  setupMobileRefJumpersModal
} from './nav-reference-jumpers.js';

export {
  RIBBON_SEPARATOR_STORAGE_KEY,
  RIBBON_COLOR_CODES,
  DE_RIBBON_METHODS,
  RIBBON_PRESETS,
  calculateRibbonSeparatorMetrics,
  renderRibbonSeparatorSvg,
  loadRibbonSeparatorAuditLog,
  saveRibbonSeparatorAuditLog,
  clearRibbonSeparatorAuditLog,
  formatRibbonSeparatorWhatsAppText,
  generateRibbonSeparatorCsv,
  setupMobileRibbonSeparatorModal
} from './nav-ribbon-separator.js';

export {
  MECHANICAL_SPLICE_STORAGE_KEY,
  SPLICE_ELEMENT_TYPES,
  GEL_STATES,
  MECHANICAL_SPLICE_PRESETS,
  calculateMechanicalSpliceMetrics,
  renderMechanicalSpliceSvg,
  loadMechanicalSpliceAuditLog,
  saveMechanicalSpliceAuditLog,
  clearMechanicalSpliceAuditLog,
  formatMechanicalSpliceWhatsAppText,
  generateMechanicalSpliceCsv,
  setupMobileMechanicalSpliceModal
} from './nav-mechanical-splice.js';

export {
  FIBER_MICROSCOPE_STORAGE_KEY,
  INSPECTION_ZONES,
  MICROSCOPE_PRESETS,
  evaluateConnectorSurface,
  renderMicroscopeSvg,
  saveMicroscopeAuditRecord,
  loadMicroscopeAuditRecords,
  clearMicroscopeAuditRecords,
  exportMicroscopeCsv,
  formatMicroscopeWhatsAppText,
  setupMobileFiberMicroscopeModal
} from './nav-fiber-microscope.js';

export {
  CONNECTOR_CLEANING_STORAGE_KEY,
  CLEANER_TOOL_STATE_STORAGE_KEY,
  CLEANING_TOOLS,
  CONTAMINATION_TYPES,
  CLEANING_PRESETS,
  evaluateCleaningProtocol,
  renderCleaningSvg,
  saveCleaningRecord,
  loadCleaningRecords,
  clearCleaningRecords,
  loadToolCounters,
  decrementToolCounter,
  resetToolCounter,
  exportCleaningCsv,
  formatCleaningWhatsAppText,
  setupMobileConnectorCleaningModal
} from './nav-connector-cleaning.js';

export {
  OTDR_DEADZONE_STORAGE_KEY,
  PULSE_WIDTH_SPECS,
  DEADZONE_PRESETS,
  calculateDeadZoneMetrics,
  saveDeadZoneAudit,
  getSavedDeadZoneAudits,
  clearDeadZoneAudits,
  renderOtdrDeadzoneTraceSvg,
  generateDeadzoneWhatsAppReport,
  exportDeadZoneAuditsCsv,
  setupMobileOtdrDeadzoneModal
} from './nav-otdr-deadzone.js';

export {
  TUBE_SPECS,
  TUBE_MATERIALS,
  FIBER_COLORS_TIA598,
  calculateTubeShavingParameters,
  renderTubeCrossSectionSvg,
  saveTubeShavingRecord,
  getTubeShavingHistory,
  clearTubeShavingHistory,
  exportTubeShavingReportCsv,
  generateTubeShavingSummary,
  setupMobileTubeShavingModal
} from './nav-tube-shaving.js';

export {
  QUICK_COLLECT_STORAGE_KEY,
  QUICK_COLLECT_AUDIT_KEY,
  getPakistanLocalDate,
  getPendingCollectionCustomers,
  getCustomerPaymentDefaults,
  executeQuickCollection,
  formatQuickCollectWhatsAppReceipt,
  renderQuickCollectCustomerListHtml,
  renderQuickCollectReceiptCardHtml,
  setupQuickCollectModal
} from './nav-quick-collect.js';

export {
  RECENT_CUSTOMERS_STORAGE_KEY,
  recordRecentCustomer,
  getRecentCustomers,
  clearRecentCustomers,
  searchFastCustomers,
  renderFastCustomerSearchResultsHtml,
  setupFastCustomerSearchModal
} from './nav-customer-search.js';

export {
  RECEIPT_SHARED_STORAGE_KEY,
  escapeHtml as escapeQuickProfileHtml,
  formatPakistaniPhone,
  markReceiptShared,
  isReceiptShared,
  getSharedReceipts,
  clearSharedReceipts,
  executeReceiptWhatsAppShare,
  calculateCustomerQuickProfile,
  renderReceiptSharedBadgeHtml,
  renderQuickProfileCardHtml,
  setupMobileQuickProfileModal
} from './nav-quick-profile.js';

export {
  LANGUAGE_STORAGE_KEY,
  DEFAULT_LANGUAGE,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  getAppLanguage,
  t,
  applyLanguageDirection,
  updateDocumentTranslations,
  setAppLanguage,
  toggleAppLanguage,
  formatBilingualCurrency,
  formatBilingualStatus,
  renderLanguageToggleBtnHtml,
  setupLanguageToggle
} from './nav-language.js';

export {
  COLLECTION_PROMISES_STORAGE_KEY,
  getTodayDateString as getPendingActionsDateString,
  getCollectionPromises,
  saveCollectionPromise,
  fulfillCollectionPromise,
  cancelCollectionPromise,
  rescheduleCollectionPromise,
  clearCollectionPromises,
  getPendingActionsSummary,
  markAllReceiptsSharedInQueue,
  generatePendingActionsDigest,
  updatePendingActionsBadges,
  setupPendingActionsModal
} from './nav-pending-actions.js';

export {
  A11Y_LIVE_REGION_ID,
  A11Y_ALERT_REGION_ID,
  ensureLiveRegions,
  announceToScreenReader,
  trapModalFocus,
  announcePaymentSuccess,
  setupAccessibleKeyboardShortcuts,
  A11Y_AUDIT_CHECKLIST,
  verifyAccessibilityStandards,
  initUniversalDialogController
} from './nav-accessibility.js';

export {
  PWA_INSTALLED_STORAGE_KEY,
  PWA_BANNER_DISMISSED_KEY,
  PWA_METRICS_STORAGE_KEY,
  CACHE_NAME_VERSION,
  isStandaloneMode,
  isPwaInstalled,
  getPwaInstallState,
  isIosDevice,
  parsePwaActionFromUrl,
  executePwaAction,
  deferLowPriorityInit,
  createLazyModalController,
  measurePwaPerformance,
  setupPwaInstallPrompt,
  setupPwaStatusModal,
  setupPwaShortcuts
} from './nav-pwa.js';

export {
  REMINDER_STAGES_SETTINGS_KEY,
  REMINDER_HISTORY_STORAGE_KEY,
  DEFAULT_REMINDER_STAGES,
  getReminderStagesSettings,
  saveReminderStagesSettings,
  resetReminderStagesSettings,
  calculateCustomerDueDay,
  calculateCustomerDueDate,
  calendarDaysDifference,
  getMatchingReminderStage,
  getReminderHistory,
  isCustomerRemindedToday,
  recordReminderDispatched,
  getCustomerReminderHistory,
  getRemindersTodayQueue,
  getPromiseToPayFollowupList,
  formatPromiseFollowupWhatsApp,
  recordCustomerPromise,
  markPromiseFulfilled,
  cancelPromise,
  reschedulePromise
} from './reminder-queue.js';






