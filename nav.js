/**
 * Navigation Drawer & Responsive Navigation Management (agent2 - shahdara-mobile-nav)
 */

export function setupNavigationDrawer({
  onNavigate,
  onBackup
} = {}) {
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
export function updateNavigationBadges(state) {
  if (!state || typeof document === 'undefined' || typeof document.querySelectorAll !== 'function') return;

  const customers = Array.isArray(state.customers) ? state.customers : [];
  const totalCustomers = customers.filter(c => !c.archived).length;
  const expensesCount = Array.isArray(state.expenses) ? state.expenses.length : 0;
  const inventoryCount = Array.isArray(state.inventoryItems) ? state.inventoryItems.length : 0;

  function setBadges(target, count, label) {
    const badges = document.querySelectorAll(`[data-nav-badge="${target}"]`);
    badges.forEach(badge => {
      badge.textContent = String(count);
      badge.hidden = count === 0;
      if (label && badge.setAttribute) {
        badge.setAttribute('aria-label', `${count} ${label}`);
      }
    });
  }

  setBadges('customers', totalCustomers, 'active customer profiles');
  setBadges('expenses', expensesCount, 'recorded expenses');
  setBadges('inventory', inventoryCount, 'inventory items');
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

  function handlePillClick() {
    const online = isOnlineNow();
    updateStatus(online);
    if (typeof onToast === 'function') {
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

  return {
    isOnline: isOnlineNow,
    checkStatus: () => {
      const online = isOnlineNow();
      updateStatus(online);
      return online;
    }
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
  onToast
} = {}) {
  if (typeof document === 'undefined') {
    return { openHelp: () => {}, closeHelp: () => {} };
  }

  const modal = document.getElementById('keyboardShortcutsModal');
  const closeBtn = document.getElementById('shortcutsModalCloseBtn');
  const helpBtn = document.getElementById('shortcutsHelpButton');
  const drawerHelpBtn = document.getElementById('navDrawerShortcutsBtn');

  function openHelp() {
    if (modal) {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');
    }
  }

  function closeHelp() {
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
    return { open: () => {}, close: () => {} };
  }

  const toggleBtn = document.getElementById('mobileActionSheetToggle');
  const sheet = document.getElementById('mobileActionSheet');
  const backdrop = document.getElementById('mobileActionSheetBackdrop');
  const closeBtn = document.getElementById('mobileActionSheetClose');

  if (!sheet) {
    return { open: () => {}, close: () => {} };
  }

  function openSheet() {
    triggerHaptic('light');
    sheet.hidden = false;
    if (backdrop) backdrop.hidden = false;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        sheet.classList.add('is-open');
        if (backdrop) backdrop.classList.add('is-open');
        sheet.setAttribute('aria-hidden', 'false');
        if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
      });
    } else {
      sheet.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-open');
      sheet.setAttribute('aria-hidden', 'false');
      if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    }
    const firstFocusable = sheet.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
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

  // Action buttons inside sheet
  const actionButtons = sheet.querySelectorAll('[data-sheet-action]');
  actionButtons.forEach(btn => {
    if (btn.dataset?.wiredAction) return;
    if (btn.dataset) btn.dataset.wiredAction = 'true';
    else if (btn.setAttribute) btn.setAttribute('data-wired-action', 'true');
    btn.addEventListener('click', () => {
      triggerHaptic('medium');
      const action = btn.getAttribute('data-sheet-action');
      closeSheet();
      if (typeof onAction === 'function') {
        onAction(action);
      }
    });
  });

  return {
    open: openSheet,
    close: closeSheet
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
