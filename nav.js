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
