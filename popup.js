(function () {
  'use strict';

  function track(name, params) {
    try {
      chrome.runtime.sendMessage({ type: 'gpap_analytics_event', name, params: params || {} });
    } catch (e) { /* analytics must never break the extension */ }
  }

  // ---- Theme ----
  // The popup is a help page now (theme and section controls live in the new
  // tab's Customize panel), but it still follows the user's chosen theme.
  const THEME_KEY = 'gpap_theme_v1';
  const GPAP_THEMES = {
    cream: { bg: '#faf5ee', surface: '#fffbf6', surface2: '#f6efe4', border: '#e7dbc7', ink: '#3d362f', inkSoft: '#8c8072', accent: '#c1774c', accentDark: '#a6613b', accentSoft: '#f3e2d0', accentInk: '#fffbf6' },
    midnight: { bg: '#1e1b18', surface: '#2a2521', surface2: '#322c26', border: '#453e35', ink: '#f3ece1', inkSoft: '#a89c8c', accent: '#e2905f', accentDark: '#f0a878', accentSoft: '#3d2a20', accentInk: '#fffbf6' },
    ocean: { bg: '#f2f7f8', surface: '#ffffff', surface2: '#eaf2f3', border: '#cfe1e3', ink: '#223338', inkSoft: '#6f8489', accent: '#2f7f8c', accentDark: '#23636e', accentSoft: '#dcedef', accentInk: '#fffbf6' },
    forest: { bg: '#f5f7ee', surface: '#ffffff', surface2: '#eef1e2', border: '#d8ddc3', ink: '#2f3626', inkSoft: '#7c8468', accent: '#6b8f3f', accentDark: '#556f30', accentSoft: '#e4ecd4', accentInk: '#fffbf6' },
    plum: { bg: '#f8f3f6', surface: '#fffbfd', surface2: '#f4e9ef', border: '#e3cdd9', ink: '#372733', inkSoft: '#8c7686', accent: '#9a5b84', accentDark: '#7c4568', accentSoft: '#f0dce9', accentInk: '#fffbf6' },
    white: { bg: '#ffffff', surface: '#ffffff', surface2: '#f0f0f0', border: '#d4d4d4', ink: '#111111', inkSoft: '#666666', accent: '#111111', accentDark: '#000000', accentSoft: '#e2e2e2', accentInk: '#fffbf6' },
    dark: { bg: '#000000', surface: '#121212', surface2: '#1c1c1c', border: '#333333', ink: '#f5f5f5', inkSoft: '#999999', accent: '#d8d8d8', accentDark: '#efefef', accentSoft: '#262626', accentInk: '#141414' },
    rose: { bg: '#fbf3f2', surface: '#fffbfa', surface2: '#f9ebe9', border: '#edd6d3', ink: '#3d2a28', inkSoft: '#8c7370', accent: '#c76b6f', accentDark: '#a8494e', accentSoft: '#f3dcda', accentInk: '#fffbf6' },
    slate: { bg: '#f3f5f7', surface: '#ffffff', surface2: '#eef1f4', border: '#d6dde3', ink: '#2b333b', inkSoft: '#707c87', accent: '#52708c', accentDark: '#3d5670', accentSoft: '#dee7ee', accentInk: '#fffbf6' },
    sand: { bg: '#faf1e6', surface: '#fffaf2', surface2: '#f6ead9', border: '#e6d2b8', ink: '#3f2f21', inkSoft: '#8f7a63', accent: '#c17840', accentDark: '#9c5b2b', accentSoft: '#f0dcc4', accentInk: '#fffbf6' },
    sage: { bg: '#f4f6f0', surface: '#fdfdf9', surface2: '#eef1e6', border: '#dde3d0', ink: '#313a2b', inkSoft: '#7c8874', accent: '#7a9169', accentDark: '#5c7350', accentSoft: '#e3ead9', accentInk: '#fffbf6' },
    neon: { bg: '#0a0a0c', surface: '#17171a', surface2: '#1e1e22', border: '#2c2c31', ink: '#f3f6f2', inkSoft: '#9aa39a', accent: '#39e07a', accentDark: '#1fb85f', accentSoft: '#14301f', accentInk: '#06170d' },
    crimson: { bg: '#0c0808', surface: '#1a1313', surface2: '#221818', border: '#3a2626', ink: '#f7ecec', inkSoft: '#b08e8e', accent: '#e0333f', accentDark: '#b31f29', accentSoft: '#3a1418', accentInk: '#fdf4f4' },
    signal: { bg: '#ffffff', surface: '#ffffff', surface2: '#ececec', border: '#cfcfcf', ink: '#050505', inkSoft: '#4d4d4d', accent: '#e8590c', accentDark: '#b8430a', accentSoft: '#fde3d1', accentInk: '#fffbf6' }
  };
  const THEME_VARS = {
    bg: '--gpap-bg', surface: '--gpap-surface', surface2: '--gpap-surface-2', border: '--gpap-border',
    ink: '--gpap-ink', inkSoft: '--gpap-ink-soft', accent: '--gpap-accent', accentDark: '--gpap-accent-dark',
    accentSoft: '--gpap-accent-soft', accentInk: '--gpap-accent-ink'
  };
  const DARK_THEMES = new Set(['midnight', 'dark', 'neon', 'crimson']);

  function applyPopupTheme(themeId) {
    const theme = GPAP_THEMES[themeId] || GPAP_THEMES.cream;
    const root = document.documentElement;
    Object.keys(THEME_VARS).forEach((key) => root.style.setProperty(THEME_VARS[key], theme[key]));
    root.style.colorScheme = DARK_THEMES.has(themeId) ? 'dark' : 'light';
  }
  chrome.storage.local.get(THEME_KEY).then((result) => applyPopupTheme(result[THEME_KEY] || 'cream'));

  // ---- Version ----
  const versionEl = document.getElementById('pop-version');
  if (versionEl) versionEl.textContent = `v${chrome.runtime.getManifest().version}`;

  // ---- Tabs (remembers the last one viewed) ----
  const TAB_KEY = 'gpap_popup_tab_v1';
  const tabs = [...document.querySelectorAll('.pop-tab')];

  function showTab(tabId) {
    tabs.forEach((tab) => {
      const active = tab.id === tabId;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !active;
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      showTab(tab.id);
      chrome.storage.local.set({ [TAB_KEY]: tab.id });
      track('popup_view_tab', { tab_name: tab.id.replace('tab-', '') });
    });
    // Arrow keys move between tabs, as screen-reader users expect.
    tab.addEventListener('keydown', (ev) => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      const next = tabs[(i + (ev.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
  });

  chrome.storage.local.get(TAB_KEY).then((r) => {
    const saved = r[TAB_KEY];
    if (saved && document.getElementById(saved)) showTab(saved);
  });

  // ---- Q&A / feature cards: track which ones people open ----
  document.querySelectorAll('details.pop-item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (!item.open) return;
      const label = item.querySelector('summary').textContent.trim().slice(0, 60);
      track('popup_open_item', { item: label });
    });
  });

  // ---- Links & buttons ----
  const newTabBtn = document.getElementById('pop-open-newtab');
  if (newTabBtn) {
    newTabBtn.addEventListener('click', () => {
      track('popup_open_newtab');
      chrome.tabs.create({});
    });
  }

  [
    ['pop-open-grades', 'popup_click_grade_history'],
    ['pop-credit', 'popup_click_credit'],
    ['pop-linkedin', 'popup_click_linkedin'],
    ['pop-nsumate', 'popup_click_nsumate']
  ].forEach(([id, event]) => {
    const link = document.getElementById(id);
    if (link) link.addEventListener('click', () => track(event));
  });

  track('popup_open');
})();
