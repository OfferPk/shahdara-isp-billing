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
