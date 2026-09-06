(function () {
  'use strict';

  function track(name, params) {
    try {
      chrome.runtime.sendMessage({ type: 'gpap_analytics_event', name, params: params || {} });
    } catch (e) { /* analytics must never break the extension */ }
  }

  // ---- New Tab Dashboard master toggle ----
  const MASTER_MODE_KEY = 'gpap_newtab_master_mode_v1';
  const masterToggle = document.getElementById('gpap-toggle-master-mode');
  if (masterToggle) {
    chrome.storage.local.get(MASTER_MODE_KEY).then((result) => {
      masterToggle.checked = (result[MASTER_MODE_KEY] || 'full') !== 'minimal';
    });
    masterToggle.addEventListener('change', async () => {
      const mode = masterToggle.checked ? 'full' : 'minimal';
      await chrome.storage.local.set({ [MASTER_MODE_KEY]: mode });
      track('popup_master_mode_change', { mode });
    });
  }

  const KEY = 'gpap_newtab_sections_v1';
  const SECTIONS = ['cgpa', 'today', 'attendance', 'routine', 'todo', 'pomodoro', 'links', 'favorites', 'weekly'];

  function defaults() {
    return { cgpa: true, today: true, attendance: true, routine: true, todo: true, pomodoro: true, links: true, favorites: true, weekly: true };
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
    },
    rose: {
      bg: '#fbf3f2', surface2: '#f9ebe9', border: '#edd6d3', ink: '#3d2a28', inkSoft: '#8c7370',
      accent: '#c76b6f', accentDark: '#a8494e', accentSoft: '#f3dcda'
    },
    slate: {
      bg: '#f3f5f7', surface2: '#eef1f4', border: '#d6dde3', ink: '#2b333b', inkSoft: '#707c87',
      accent: '#52708c', accentDark: '#3d5670', accentSoft: '#dee7ee'
    },
    sand: {
      bg: '#faf1e6', surface2: '#f6ead9', border: '#e6d2b8', ink: '#3f2f21', inkSoft: '#8f7a63',
      accent: '#c17840', accentDark: '#9c5b2b', accentSoft: '#f0dcc4'
    },
    sage: {
      bg: '#f4f6f0', surface2: '#eef1e6', border: '#dde3d0', ink: '#313a2b', inkSoft: '#7c8874',
      accent: '#7a9169', accentDark: '#5c7350', accentSoft: '#e3ead9'
    },
    neon: {
      bg: '#0a0a0c', surface2: '#1e1e22', border: '#2c2c31', ink: '#f3f6f2', inkSoft: '#9aa39a',
      accent: '#39e07a', accentDark: '#1fb85f', accentSoft: '#14301f'
    },
    crimson: {
      bg: '#0c0808', surface2: '#221818', border: '#3a2626', ink: '#f7ecec', inkSoft: '#b08e8e',
      accent: '#e0333f', accentDark: '#b31f29', accentSoft: '#3a1418'
    },
    signal: {
      bg: '#ffffff', surface2: '#ececec', border: '#cfcfcf', ink: '#050505', inkSoft: '#4d4d4d',
      accent: '#e8590c', accentDark: '#b8430a', accentSoft: '#fde3d1'
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
