(function () {
  'use strict';

  function track(name, params) {
    try {
      chrome.runtime.sendMessage({ type: 'gpap_analytics_event', name, params: params || {} });
    } catch (e) { /* analytics must never break the extension */ }
  }

  const KEY = 'gpap_newtab_sections_v1';
  const SECTIONS = ['cgpa', 'today', 'attendance', 'routine', 'todo', 'pomodoro', 'links', 'weekly'];

  function defaults() {
    return { cgpa: true, today: true, attendance: true, routine: true, todo: true, pomodoro: true, links: true, weekly: true };
  }

  chrome.storage.local.get(KEY).then((result) => {
    const state = Object.assign(defaults(), result[KEY] || {});
    SECTIONS.forEach((section) => {
      document.getElementById(`gpap-toggle-${section}`).checked = state[section] !== false;
    });
  });

  SECTIONS.forEach((section) => {
    document.getElementById(`gpap-toggle-${section}`).addEventListener('change', async (ev) => {
      const result = await chrome.storage.local.get(KEY);
      const state = Object.assign(defaults(), result[KEY] || {});
      state[section] = ev.target.checked;
      await chrome.storage.local.set({ [KEY]: state });
      track('popup_section_toggle', { section, enabled: ev.target.checked });
    });
  });

  // ---- Theme ----
  const THEME_KEY = 'gpap_theme_v1';
  const GPAP_THEMES = {
    cream: {
      bg: '#faf5ee', surface2: '#f6efe4', border: '#e7dbc7', ink: '#3d362f', inkSoft: '#8c8072',
      accent: '#c1774c', accentDark: '#a6613b', accentSoft: '#f3e2d0'
    },
    midnight: {
      bg: '#1e1b18', surface2: '#322c26', border: '#453e35', ink: '#f3ece1', inkSoft: '#a89c8c',
      accent: '#e2905f', accentDark: '#f0a878', accentSoft: '#3d2a20'
    },
    ocean: {
      bg: '#f2f7f8', surface2: '#eaf2f3', border: '#cfe1e3', ink: '#223338', inkSoft: '#6f8489',
      accent: '#2f7f8c', accentDark: '#23636e', accentSoft: '#dcedef'
    },
    forest: {
      bg: '#f5f7ee', surface2: '#eef1e2', border: '#d8ddc3', ink: '#2f3626', inkSoft: '#7c8468',
      accent: '#6b8f3f', accentDark: '#556f30', accentSoft: '#e4ecd4'
    },
    plum: {
      bg: '#f8f3f6', surface2: '#f4e9ef', border: '#e3cdd9', ink: '#372733', inkSoft: '#8c7686',
      accent: '#9a5b84', accentDark: '#7c4568', accentSoft: '#f0dce9'
    },
    white: {
      bg: '#ffffff', surface2: '#f0f0f0', border: '#d4d4d4', ink: '#111111', inkSoft: '#666666',
      accent: '#111111', accentDark: '#000000', accentSoft: '#e2e2e2'
    },
    dark: {
      bg: '#000000', surface2: '#1c1c1c', border: '#333333', ink: '#f5f5f5', inkSoft: '#999999',
      accent: '#d8d8d8', accentDark: '#efefef', accentSoft: '#262626'
    }
  };
  const THEME_VARS = {
    bg: '--gpap-bg', surface2: '--gpap-surface-2', border: '--gpap-border', ink: '--gpap-ink',
    inkSoft: '--gpap-ink-soft', accent: '--gpap-accent', accentDark: '--gpap-accent-dark', accentSoft: '--gpap-accent-soft'
  };

  function applyPopupTheme(themeId) {
    const theme = GPAP_THEMES[themeId] || GPAP_THEMES.cream;
    const root = document.documentElement;
    Object.keys(THEME_VARS).forEach((key) => root.style.setProperty(THEME_VARS[key], theme[key]));
    document.querySelectorAll('.gpap-swatch').forEach((btn) => {
      btn.classList.toggle('gpap-swatch-active', btn.dataset.theme === themeId);
    });
  }

  chrome.storage.local.get(THEME_KEY).then((result) => applyPopupTheme(result[THEME_KEY] || 'cream'));

  document.querySelectorAll('.gpap-swatch').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const themeId = btn.dataset.theme;
      applyPopupTheme(themeId);
      await chrome.storage.local.set({ [THEME_KEY]: themeId });
      track('popup_theme_change', { theme: themeId });
    });
  });

  track('popup_open');
})();
