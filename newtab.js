(function () {
  'use strict';

  function track(name, params) {
    try {
      chrome.runtime.sendMessage({ type: 'gpap_analytics_event', name, params: params || {} });
    } catch (e) { /* analytics must never break the extension */ }
  }

  const GRADES_KEY = 'gpap_newtab_grades_v1';
  const MRDS_KEY = 'mrds_cache_v1';
  const TODO_KEY = 'gpap_newtab_todos_v1';
  const WEEKLY_TODO_KEY = 'gpap_newtab_weekly_todos_v1';
  const POMO_KEY = 'gpap_newtab_pomodoro_v1';
  const SECTIONS_KEY = 'gpap_newtab_sections_v1';
  const CARD_ORDER_KEY = 'gpap_newtab_card_order_v1';
  const GRID_CARD_KEYS = ['today', 'attendance', 'routine', 'todo', 'pomodoro'];
  const SECTION_IDS = {
    cgpa: 'nt-section-cgpa',
    today: 'nt-section-today',
    attendance: 'nt-section-attendance',
    routine: 'nt-section-routine',
    todo: 'nt-section-todo',
    pomodoro: 'nt-section-pomodoro',
    search: 'nt-section-search',
    links: 'nt-section-links',
    favorites: 'nt-section-favorites',
    weekly: 'nt-section-weekly'
  };
  const DAY_CODES = ['S', 'M', 'T', 'W', 'R', 'F', 'A'];
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const WORK_MIN = 25;
  const BREAK_MIN = 5;

  // Kept identical to the table in content.js and mini-rds3.js — all three
  // read the same 'gpap_theme_v1' key so one pick re-themes every surface.
  const GPAP_THEMES = {
    cream: {
      bg: '#faf5ee', bgAlt: '#f1e6d6', surface: '#fffbf6', surface2: '#f6efe4', border: '#e7dbc7',
      ink: '#3d362f', inkSoft: '#8c8072', accent: '#c1774c', accentDark: '#a6613b', accentSoft: '#f3e2d0', accentInk: '#fffbf6',
      sage: '#74915f', sageSoft: '#e6ebdc', rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    midnight: {
      bg: '#1e1b18', bgAlt: '#26221d', surface: '#2a2521', surface2: '#322c26', border: '#453e35',
      ink: '#f3ece1', inkSoft: '#a89c8c', accent: '#e2905f', accentDark: '#f0a878', accentSoft: '#3d2a20', accentInk: '#fffbf6',
      sage: '#8fae78', sageSoft: '#263323', rust: '#d97b6c', rustSoft: '#3a2320', gold: '#d9ae5e', goldSoft: '#3a2f1c'
    },
    ocean: {
      bg: '#f2f7f8', bgAlt: '#e3eef0', surface: '#ffffff', surface2: '#eaf2f3', border: '#cfe1e3',
      ink: '#223338', inkSoft: '#6f8489', accent: '#2f7f8c', accentDark: '#23636e', accentSoft: '#dcedef', accentInk: '#fffbf6',
      sage: '#5f9e7a', sageSoft: '#e1f0e6', rust: '#c2604f', rustSoft: '#f6ded9', gold: '#c99a3f', goldSoft: '#f6ebd3'
    },
    forest: {
      bg: '#f5f7ee', bgAlt: '#e9edda', surface: '#ffffff', surface2: '#eef1e2', border: '#d8ddc3',
      ink: '#2f3626', inkSoft: '#7c8468', accent: '#6b8f3f', accentDark: '#556f30', accentSoft: '#e4ecd4', accentInk: '#fffbf6',
      sage: '#4f8f5e', sageSoft: '#dcefe0', rust: '#b6604a', rustSoft: '#f2ded6', gold: '#bd9a3c', goldSoft: '#f2ead0'
    },
    plum: {
      bg: '#f8f3f6', bgAlt: '#efe1e9', surface: '#fffbfd', surface2: '#f4e9ef', border: '#e3cdd9',
      ink: '#372733', inkSoft: '#8c7686', accent: '#9a5b84', accentDark: '#7c4568', accentSoft: '#f0dce9', accentInk: '#fffbf6',
      sage: '#6f9a6e', sageSoft: '#e2eee0', rust: '#b95a5f', rustSoft: '#f4dcdd', gold: '#bb8f45', goldSoft: '#f2e6cf'
    },
    white: {
      bg: '#ffffff', bgAlt: '#f4f4f4', surface: '#ffffff', surface2: '#f0f0f0', border: '#d4d4d4',
      ink: '#111111', inkSoft: '#666666', accent: '#111111', accentDark: '#000000', accentSoft: '#e2e2e2', accentInk: '#fffbf6',
      sage: '#3f7d4f', sageSoft: '#e3efe4', rust: '#b23b3b', rustSoft: '#f4dede', gold: '#a3821f', goldSoft: '#f2e9d0'
    },
    dark: {
      bg: '#000000', bgAlt: '#0a0a0a', surface: '#121212', surface2: '#1c1c1c', border: '#333333',
      ink: '#f5f5f5', inkSoft: '#999999', accent: '#d8d8d8', accentDark: '#efefef', accentSoft: '#262626', accentInk: '#141414',
      sage: '#6fae7a', sageSoft: '#16241a', rust: '#d97a7a', rustSoft: '#2a1616', gold: '#d8b962', goldSoft: '#2a2213'
    },
    rose: {
      bg: '#fbf3f2', bgAlt: '#f5e3e1', surface: '#fffbfa', surface2: '#f9ebe9', border: '#edd6d3',
      ink: '#3d2a28', inkSoft: '#8c7370', accent: '#c76b6f', accentDark: '#a8494e', accentSoft: '#f3dcda', accentInk: '#fffbf6',
      sage: '#74915f', sageSoft: '#e6ebdc', rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    slate: {
      bg: '#f3f5f7', bgAlt: '#e5e9ed', surface: '#ffffff', surface2: '#eef1f4', border: '#d6dde3',
      ink: '#2b333b', inkSoft: '#707c87', accent: '#52708c', accentDark: '#3d5670', accentSoft: '#dee7ee', accentInk: '#fffbf6',
      sage: '#5f9e7a', sageSoft: '#e1f0e6', rust: '#c2604f', rustSoft: '#f6ded9', gold: '#c99a3f', goldSoft: '#f6ebd3'
    },
    sand: {
      bg: '#faf1e6', bgAlt: '#f0decb', surface: '#fffaf2', surface2: '#f6ead9', border: '#e6d2b8',
      ink: '#3f2f21', inkSoft: '#8f7a63', accent: '#c17840', accentDark: '#9c5b2b', accentSoft: '#f0dcc4', accentInk: '#fffbf6',
      sage: '#74915f', sageSoft: '#e6ebdc', rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    sage: {
      bg: '#f4f6f0', bgAlt: '#e6ebdd', surface: '#fdfdf9', surface2: '#eef1e6', border: '#dde3d0',
      ink: '#313a2b', inkSoft: '#7c8874', accent: '#7a9169', accentDark: '#5c7350', accentSoft: '#e3ead9', accentInk: '#fffbf6',
      sage: '#74915f', sageSoft: '#e6ebdc', rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    neon: {
      bg: '#0a0a0c', bgAlt: '#121215', surface: '#17171a', surface2: '#1e1e22', border: '#2c2c31',
      ink: '#f3f6f2', inkSoft: '#9aa39a', accent: '#39e07a', accentDark: '#1fb85f', accentSoft: '#14301f', accentInk: '#06170d',
      sage: '#39e07a', sageSoft: '#14301f', rust: '#ff5c5c', rustSoft: '#3a1414', gold: '#f5d442', goldSoft: '#332a0a'
    },
    crimson: {
      bg: '#0c0808', bgAlt: '#150f0f', surface: '#1a1313', surface2: '#221818', border: '#3a2626',
      ink: '#f7ecec', inkSoft: '#b08e8e', accent: '#e0333f', accentDark: '#b31f29', accentSoft: '#3a1418', accentInk: '#fdf4f4',
      sage: '#4fae6f', sageSoft: '#142a1c', rust: '#e0333f', rustSoft: '#3a1418', gold: '#f0b23e', goldSoft: '#332510'
    },
    signal: {
      bg: '#ffffff', bgAlt: '#f2f2f2', surface: '#ffffff', surface2: '#ececec', border: '#cfcfcf',
      ink: '#050505', inkSoft: '#4d4d4d', accent: '#e8590c', accentDark: '#b8430a', accentSoft: '#fde3d1', accentInk: '#fffbf6',
      sage: '#2f9e44', sageSoft: '#d3f9d8', rust: '#e03131', rustSoft: '#ffe3e3', gold: '#f08c00', goldSoft: '#fff3bf'
    }
  };
  const THEME_KEY = 'gpap_theme_v1';
  const NT_THEME_VARS = {
    bg: '--gpap-bg', bgAlt: '--gpap-bg-alt', surface: '--gpap-surface', surface2: '--gpap-surface-2',
    border: '--gpap-border', ink: '--gpap-ink', inkSoft: '--gpap-ink-soft', accent: '--gpap-accent',
    accentDark: '--gpap-accent-dark', accentSoft: '--gpap-accent-soft', accentInk: '--gpap-accent-ink',
    sage: '--gpap-sage', sageSoft: '--gpap-sage-soft',
    rust: '--gpap-rust', rustSoft: '--gpap-rust-soft', gold: '--gpap-gold', goldSoft: '--gpap-gold-soft'
  };
  const DARK_THEMES = new Set(['midnight', 'dark', 'neon', 'crimson']);

  function applyTheme(themeId) {
    const theme = GPAP_THEMES[themeId] || GPAP_THEMES.cream;
    const root = document.documentElement;
    Object.keys(NT_THEME_VARS).forEach((key) => root.style.setProperty(NT_THEME_VARS[key], theme[key]));
    root.style.colorScheme = DARK_THEMES.has(themeId) ? 'dark' : 'light';
    root.dataset.gpapTheme = themeId;
  }

  function initTheme() {
    chrome.storage.local.get(THEME_KEY).then((r) => applyTheme(r[THEME_KEY] || 'cream'));
  }

  // ---- Clock font ----
  const CLOCK_FONT_KEY = 'gpap_newtab_clock_font_v1';
  const CLOCK_FONTS = {
    default: { label: 'Default', family: 'var(--gpap-font)', tracking: 'normal' },
    playfair: { label: 'Playfair', family: "'Playfair Display', serif", tracking: 'normal' },
    bebas: { label: 'Bebas', family: "'Bebas Neue', sans-serif", tracking: '0.03em' },
    orbitron: { label: 'Orbitron', family: "'Orbitron', sans-serif", tracking: '0.02em' },
    mono: { label: 'Mono', family: "'Space Mono', monospace", tracking: 'normal' },
    caveat: { label: 'Script', family: "'Caveat', cursive", tracking: 'normal' },
    poppins: { label: 'Poppins', family: "'Poppins', sans-serif", tracking: 'normal' },
    oswald: { label: 'Oswald', family: "'Oswald', sans-serif", tracking: '0.02em' },
    righteous: { label: 'Righteous', family: "'Righteous', cursive", tracking: 'normal' },
    abril: { label: 'Abril', family: "'Abril Fatface', serif", tracking: 'normal' },
    pacifico: { label: 'Pacifico', family: "'Pacifico', cursive", tracking: 'normal' },
    pixel: { label: 'Pixel', family: "'Press Start 2P', monospace", tracking: '0.01em' }
  };

  function applyClockFont(fontId) {
    const font = CLOCK_FONTS[fontId] || CLOCK_FONTS.default;
    const root = document.documentElement;
    root.style.setProperty('--gpap-clock-font', font.family);
    root.style.setProperty('--gpap-clock-tracking', font.tracking);
    root.dataset.gpapClockFont = fontId in CLOCK_FONTS ? fontId : 'default';
  }

  function initClockFont() {
    chrome.storage.local.get(CLOCK_FONT_KEY).then((r) => applyClockFont(r[CLOCK_FONT_KEY] || 'default'));
  }

  // ---- Clock size ----
  const CLOCK_SIZE_KEY = 'gpap_newtab_clock_size_v1';
  const CLOCK_SIZES = {
    small: { label: 'Small', size: '40px' },
    medium: { label: 'Medium', size: '52px' },
    large: { label: 'Large', size: '66px' },
    xlarge: { label: 'Extra Large', size: '82px' }
  };

  function applyClockSize(sizeId) {
    const size = CLOCK_SIZES[sizeId] || CLOCK_SIZES.small;
    document.documentElement.style.setProperty('--gpap-clock-size', size.size);
  }

  function initClockSize() {
    chrome.storage.local.get(CLOCK_SIZE_KEY).then((r) => applyClockSize(r[CLOCK_SIZE_KEY] || 'small'));
  }

  // ---- Search bar style ----
  const SEARCH_STYLE_KEY = 'gpap_newtab_search_style_v1';
  const SEARCH_STYLES = {
    pill: { label: 'Boxed' },
    underline: { label: 'Underline' },
    minimal: { label: 'Minimal' },
    card: { label: 'Card' }
  };

  function applySearchStyle(styleId) {
    const form = document.getElementById('nt-search-form');
    if (!form) return;
    const id = SEARCH_STYLES[styleId] ? styleId : 'pill';
    Object.keys(SEARCH_STYLES).forEach((key) => form.classList.remove(`nt-search-style-${key}`));
    form.classList.add(`nt-search-style-${id}`);
  }

  function initSearchStyle() {
    chrome.storage.local.get(SEARCH_STYLE_KEY).then((r) => applySearchStyle(r[SEARCH_STYLE_KEY] || 'pill'));
  }

  // ---- Search bar width ----
  const SEARCH_WIDTH_KEY = 'gpap_newtab_search_width_v1';
  const SEARCH_WIDTHS = {
    small: { label: 'Small', width: '320px' },
    default: { label: 'Default', width: '420px' },
    medium: { label: 'Medium', width: '560px' },
    large: { label: 'Large', width: '680px' }
  };

  function applySearchWidth(widthId) {
    const width = (SEARCH_WIDTHS[widthId] || SEARCH_WIDTHS.default).width;
    document.documentElement.style.setProperty('--gpap-search-width', width);
  }

  function initSearchWidth() {
    chrome.storage.local.get(SEARCH_WIDTH_KEY).then((r) => applySearchWidth(r[SEARCH_WIDTH_KEY] || 'default'));
  }

  function el(tag, props, children) {
    const e = document.createElement(tag);
    if (props) {
      for (const k in props) {
        if (k === 'text') e.textContent = props[k];
        else if (k === 'class') e.className = props[k];
        else e.setAttribute(k, props[k]);
      }
    }
    (children || []).forEach((c) => c && e.appendChild(c));
    return e;
  }

  // ---- Confirm dialog (themed replacement for window.confirm) ----
  function confirmDialog(message) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('nt-confirm-overlay');
      const modal = document.getElementById('nt-confirm-modal');
      const msgEl = document.getElementById('nt-confirm-message');
      const okBtn = document.getElementById('nt-confirm-ok');
      const cancelBtn = document.getElementById('nt-confirm-cancel');
      if (!overlay || !modal || !msgEl || !okBtn || !cancelBtn) { resolve(true); return; }

      msgEl.textContent = message;
      overlay.hidden = false;
      modal.hidden = false;

      function cleanup(result) {
        overlay.hidden = true;
        modal.hidden = true;
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        overlay.removeEventListener('click', onCancel);
        resolve(result);
      }
      function onOk() { cleanup(true); }
      function onCancel() { cleanup(false); }

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      overlay.addEventListener('click', onCancel);
    });
  }

  function timeAgo(ts) {
    if (!ts) return '';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.round(h / 24);
    return `${d}d ago`;
  }

  // ---- Clock ----
  function tickClock() {
    const now = new Date();
    document.getElementById('nt-clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    document.getElementById('nt-date').textContent = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

  // ---- CGPA card ----
  function drawSparkline(canvas, timeline, potentialTimeline) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    const h = canvas.clientHeight || 90;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const points = (timeline || []).filter((t) => t.cgpa !== null && t.cgpa !== undefined);
    if (points.length < 2) {
      ctx.fillStyle = '#8c8072';
      ctx.font = '12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Not enough semesters yet', w / 2, h / 2);
      return;
    }

    const potentialPoints = (potentialTimeline || []).filter((t) => t.cgpa !== null && t.cgpa !== undefined);
    const hasPotential = potentialPoints.length === points.length &&
      potentialPoints.some((p, i) => p.cgpa > points[i].cgpa + 0.005);

    const pad = 10;
    const allValues = points.map((p) => p.cgpa).concat(hasPotential ? potentialPoints.map((p) => p.cgpa) : []);
    const minV = Math.min(...allValues) - 0.15;
    const maxV = Math.max(...allValues) + 0.15;
    const range = Math.max(0.3, maxV - minV);
    const stepX = (w - pad * 2) / (points.length - 1);
    const xAt = (i) => pad + i * stepX;
    const yAt = (v) => h - pad - ((v - minV) / range) * (h - pad * 2);

    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--gpap-accent').trim() || '#c1774c';
    const sage = style.getPropertyValue('--gpap-sage').trim() || '#74915f';

    function strokeLine(series, color, dashed) {
      ctx.beginPath();
      series.forEach((p, i) => {
        const x = xAt(i), y = yAt(p.cgpa);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.setLineDash(dashed ? [5, 4] : []);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (hasPotential) strokeLine(potentialPoints, sage, true);
    strokeLine(points, accent, false);
  }

  async function renderGrades() {
    const body = document.getElementById('nt-grades-body');
    const updatedEl = document.getElementById('nt-grades-updated');
    const result = await chrome.storage.local.get(GRADES_KEY);
    const data = result[GRADES_KEY];

    if (!data) {
      body.replaceChildren(el('div', { class: 'nt-empty', text: 'Visit your grade history page on RDS3 to sync your CGPA here.' }));
      updatedEl.textContent = '';
      return;
    }

    updatedEl.textContent = timeAgo(data.updatedAt);

    const top = el('div', { class: 'nt-cgpa-top' }, [
      el('div', { class: 'nt-stat' }, [
        el('span', { class: 'nt-stat-label', text: 'Credits Completed' }),
        el('span', { class: 'nt-stat-value', text: data.credits !== null && data.credits !== undefined ? data.credits.toFixed(1) : '—' })
      ]),
      data.honor ? el('span', { class: 'nt-honor-badge', text: data.honor }) : null
    ]);

    const canvas = el('canvas', { class: 'nt-sparkline' });
    const hasPotential = (data.potentialTimeline || []).some((p, i) => {
      const actual = data.timeline[i];
      return actual && p.cgpa !== null && actual.cgpa !== null && p.cgpa > actual.cgpa + 0.005;
    });
    const legend = hasPotential ? el('div', { class: 'nt-chart-legend' }, [
      el('span', { class: 'nt-legend-item' }, [el('i', { class: 'nt-legend-dot nt-legend-actual' }), document.createTextNode('You are here')]),
      el('span', { class: 'nt-legend-item' }, [el('i', { class: 'nt-legend-dot nt-legend-potential' }), document.createTextNode('You can reach here')])
    ]) : null;

    body.replaceChildren(top, canvas, ...(legend ? [legend] : []));
    requestAnimationFrame(() => drawSparkline(canvas, data.timeline, data.potentialTimeline));
  }

  // ---- Attendance card ----
  function todaysClasses(courses) {
    const code = DAY_CODES[new Date().getDay()];
    return (courses || []).filter((c) => c.day && c.day.includes(code));
  }

  function attendanceTier(pct) {
    if (pct >= 85) return 'nt-att-good';
    if (pct >= 75) return 'nt-att-warn';
    return 'nt-att-risk';
  }

  function classRow(c, opts) {
    const showAttendance = !opts || opts.attendance !== false;
    const last = c.attendance && c.attendance.last;
    const status = last ? last.status : null;
    const cls = status === 'YES' ? 'nt-badge-yes' : status === 'NO' ? 'nt-badge-no' : 'nt-badge-unknown';

    const right = [];
    if (showAttendance) {
      right.push(el('div', { class: 'nt-class-right' }, [
        el('span', { class: `nt-badge ${cls}`, text: status || 'N/A' }),
        el('span', { class: 'nt-class-lastnote', text: last && last.date ? `last class · ${last.date}` : 'no record yet' })
      ]));
    }

    return el('li', { class: 'nt-class-row' }, [
      el('div', { class: 'nt-class-main' }, [
        el('div', { class: 'nt-class-code', text: c.code || '' }),
        el('div', { class: 'nt-class-time', text: c.start && c.end ? `${c.start} – ${c.end}` : 'TBA' })
      ]),
      ...right
    ]);
  }

  async function getMrdsData() {
    const result = await chrome.storage.local.get(MRDS_KEY);
    return result[MRDS_KEY];
  }

  async function renderTodayClasses() {
    const body = document.getElementById('nt-today-body');
    const updatedEl = document.getElementById('nt-today-updated');
    const data = await getMrdsData();

    if (!data || !data.courses || !data.courses.length) {
      body.replaceChildren(el('div', { class: 'nt-empty', text: 'Visit your RDS3 landing page to sync today’s classes here.' }));
      updatedEl.textContent = '';
      return;
    }

    updatedEl.textContent = timeAgo(data.fetchedAt);
    const today = todaysClasses(data.courses);
    if (!today.length) {
      body.replaceChildren(el('div', { class: 'nt-empty', text: 'No classes today.' }));
      return;
    }

    const list = el('ul', { class: 'nt-today-list' });
    today.forEach((c) => list.appendChild(classRow(c)));
    body.replaceChildren(list);
  }

  async function renderAttendance() {
    const body = document.getElementById('nt-att-body');
    const updatedEl = document.getElementById('nt-att-updated');
    const data = await getMrdsData();

    if (!data || !data.courses || !data.courses.length) {
      body.replaceChildren(el('div', { class: 'nt-empty', text: 'Visit your RDS3 landing page to sync attendance here.' }));
      updatedEl.textContent = '';
      return;
    }

    updatedEl.textContent = timeAgo(data.fetchedAt);

    const withPct = data.courses.filter((c) => c.attendance && c.attendance.total);
    if (!withPct.length) {
      body.replaceChildren(el('div', { class: 'nt-empty', text: 'No attendance records yet.' }));
      return;
    }

    const attList = el('ul', { class: 'nt-att-list' });
    withPct.forEach((c) => {
      const pct = Math.round((c.attendance.attended / c.attendance.total) * 100);
      const tier = attendanceTier(pct);
      attList.appendChild(el('li', {}, [
        el('div', { class: 'nt-att-row-top' }, [
          el('span', { class: 'nt-att-code', text: c.code || '' }),
          el('span', { class: 'nt-att-pct', text: `${pct}%` })
        ]),
        el('div', { class: 'nt-att-track' }, [
          el('div', { class: `nt-att-fill ${tier}`, style: `width:${Math.max(0, Math.min(100, pct))}%` })
        ])
      ]));
    });
    body.replaceChildren(attList);
  }

  function timeToMinutes(t) {
    const m = (t || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + parseInt(m[2], 10);
  }

  async function renderRoutine() {
    const body = document.getElementById('nt-routine-body');
    const updatedEl = document.getElementById('nt-routine-updated');
    const data = await getMrdsData();

    if (!data || !data.courses || !data.courses.length) {
      body.replaceChildren(el('div', { class: 'nt-empty', text: 'Visit your RDS3 landing page to sync your weekly routine here.' }));
      updatedEl.textContent = '';
      return;
    }

    updatedEl.textContent = timeAgo(data.fetchedAt);

    const todayCode = DAY_CODES[new Date().getDay()];
    const nodes = [];
    DAY_NAMES.forEach((name, idx) => {
      const code = DAY_CODES[idx];
      const dayCourses = data.courses
        .filter((c) => c.day && c.day.includes(code))
        .sort((a, b) => {
          const ta = timeToMinutes(a.start);
          const tb = timeToMinutes(b.start);
          if (ta === null) return tb === null ? 0 : 1;
          if (tb === null) return -1;
          return ta - tb;
        });
      if (!dayCourses.length) return;
      nodes.push(el('div', { class: `nt-routine-day${code === todayCode ? ' nt-routine-today' : ''}`, text: name }));
      const list = el('ul', { class: 'nt-today-list' });
      dayCourses.forEach((c) => list.appendChild(classRow(c, { attendance: false })));
      nodes.push(list);
    });

    if (!nodes.length) {
      body.replaceChildren(el('div', { class: 'nt-empty', text: 'No weekly courses found.' }));
      return;
    }
    body.replaceChildren(...nodes);
  }

  // ---- To-do card ----
  async function loadTodos() {
    const r = await chrome.storage.local.get(TODO_KEY);
    return r[TODO_KEY] || [];
  }
  async function saveTodos(todos) {
    await chrome.storage.local.set({ [TODO_KEY]: todos });
  }

  async function renderTodos() {
    const list = document.getElementById('nt-todo-list');
    const empty = document.getElementById('nt-todo-empty');
    const todos = await loadTodos();

    empty.hidden = todos.length > 0;
    list.replaceChildren(...todos.map((t) => {
      const checkbox = el('input', { type: 'checkbox' });
      checkbox.checked = !!t.done;
      checkbox.addEventListener('change', async () => {
        const current = await loadTodos();
        const item = current.find((x) => x.id === t.id);
        if (item) item.done = checkbox.checked;
        await saveTodos(current);
        track('newtab_todo_toggle', { done: checkbox.checked });
        renderTodos();
      });

      const del = el('button', { class: 'nt-todo-del', type: 'button', text: '×', title: 'Delete' });
      del.addEventListener('click', async () => {
        const current = await loadTodos();
        await saveTodos(current.filter((x) => x.id !== t.id));
        track('newtab_todo_delete');
        renderTodos();
      });

      return el('li', { class: `nt-todo-item${t.done ? ' nt-todo-done' : ''}` }, [
        checkbox,
        el('span', { class: 'nt-todo-text', text: t.text }),
        del
      ]);
    }));
  }

  function initTodoForm() {
    const form = document.getElementById('nt-todo-form');
    const input = document.getElementById('nt-todo-input');
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const todos = await loadTodos();
      todos.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false });
      await saveTodos(todos);
      track('newtab_todo_add');
      input.value = '';
      renderTodos();
    });
  }

  // ---- Weekly To-do card ----
  function defaultWeeklyTodos() {
    const obj = {};
    DAY_NAMES.forEach((d) => { obj[d] = []; });
    return obj;
  }
  async function loadWeeklyTodos() {
    const r = await chrome.storage.local.get(WEEKLY_TODO_KEY);
    return Object.assign(defaultWeeklyTodos(), r[WEEKLY_TODO_KEY] || {});
  }
  async function saveWeeklyTodos(data) {
    await chrome.storage.local.set({ [WEEKLY_TODO_KEY]: data });
  }

  function weeklyDayColumn(day, items, isToday) {
    const list = el('ul', { class: 'nt-todo-list nt-weekly-list' });
    items.forEach((t) => {
      const checkbox = el('input', { type: 'checkbox' });
      checkbox.checked = !!t.done;
      checkbox.addEventListener('change', async () => {
        const data = await loadWeeklyTodos();
        const item = (data[day] || []).find((x) => x.id === t.id);
        if (item) item.done = checkbox.checked;
        await saveWeeklyTodos(data);
        track('newtab_weekly_todo_toggle', { day, done: checkbox.checked });
        renderWeeklyTodos();
      });

      const del = el('button', { class: 'nt-todo-del', type: 'button', text: '×', title: 'Delete' });
      del.addEventListener('click', async () => {
        const data = await loadWeeklyTodos();
        data[day] = (data[day] || []).filter((x) => x.id !== t.id);
        await saveWeeklyTodos(data);
        track('newtab_weekly_todo_delete', { day });
        renderWeeklyTodos();
      });

      list.appendChild(el('li', { class: `nt-todo-item${t.done ? ' nt-todo-done' : ''}` }, [
        checkbox,
        el('span', { class: 'nt-todo-text', text: t.text }),
        del
      ]));
    });

    const input = el('input', { type: 'text', class: 'nt-weekly-input', placeholder: 'Add…', autocomplete: 'off', maxlength: '140' });
    const form = el('form', { class: 'nt-weekly-form' }, [
      input,
      el('button', { type: 'submit', class: 'nt-btn nt-btn-small', text: '+' })
    ]);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const data = await loadWeeklyTodos();
      (data[day] = data[day] || []).push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false });
      await saveWeeklyTodos(data);
      track('newtab_weekly_todo_add', { day });
      input.value = '';
      renderWeeklyTodos();
    });

    return el('div', { class: `nt-weekly-day${isToday ? ' nt-weekly-today' : ''}` }, [
      el('div', { class: 'nt-weekly-day-name', text: day }),
      list,
      items.length ? null : el('p', { class: 'nt-weekly-empty', text: 'Nothing yet' }),
      form
    ]);
  }

  async function renderWeeklyTodos() {
    const grid = document.getElementById('nt-weekly-grid');
    if (!grid) return;
    const data = await loadWeeklyTodos();
    const todayName = DAY_NAMES[new Date().getDay()];
    grid.replaceChildren(...DAY_NAMES.map((day) => weeklyDayColumn(day, data[day] || [], day === todayName)));
  }

  // ---- Pomodoro card ----
  function defaultPomoState() {
    return { mode: 'work', running: false, remainingMs: WORK_MIN * 60 * 1000, endsAt: null };
  }
  async function loadPomo() {
    const r = await chrome.storage.local.get(POMO_KEY);
    return r[POMO_KEY] || defaultPomoState();
  }
  async function savePomo(state) {
    await chrome.storage.local.set({ [POMO_KEY]: state });
  }
  function currentRemainingMs(state) {
    if (!state.running || !state.endsAt) return state.remainingMs;
    return Math.max(0, state.endsAt - Date.now());
  }
  function formatMs(ms) {
    const totalSec = Math.ceil(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function initPomodoro() {
    const modeEl = document.getElementById('nt-pomo-mode');
    const timeEl = document.getElementById('nt-pomo-time');
    const toggleBtn = document.getElementById('nt-pomo-toggle');
    const skipBtn = document.getElementById('nt-pomo-skip');
    const resetBtn = document.getElementById('nt-pomo-reset');

    function paint(state) {
      modeEl.textContent = state.mode === 'work' ? 'Focus' : 'Break';
      timeEl.textContent = formatMs(currentRemainingMs(state));
      toggleBtn.textContent = state.running ? 'Pause' : 'Start';
    }

    async function switchMode(state) {
      const nextMode = state.mode === 'work' ? 'break' : 'work';
      const duration = (nextMode === 'work' ? WORK_MIN : BREAK_MIN) * 60 * 1000;
      const next = { mode: nextMode, running: state.running, remainingMs: duration, endsAt: state.running ? Date.now() + duration : null };
      await savePomo(next);
      return next;
    }

    let state = null;

    async function tick() {
      if (!state) return;
      if (state.running && currentRemainingMs(state) <= 0) {
        track('newtab_pomodoro_complete', { mode: state.mode });
        state = await switchMode(state);
      }
      paint(state);
    }

    toggleBtn.addEventListener('click', async () => {
      state = await loadPomo();
      if (state.running) {
        state.remainingMs = currentRemainingMs(state);
        state.running = false;
        state.endsAt = null;
        track('newtab_pomodoro_pause', { mode: state.mode });
      } else {
        state.running = true;
        state.endsAt = Date.now() + state.remainingMs;
        track('newtab_pomodoro_start', { mode: state.mode });
      }
      await savePomo(state);
      paint(state);
    });

    skipBtn.addEventListener('click', async () => {
      state = await loadPomo();
      track('newtab_pomodoro_skip', { mode: state.mode });
      state = await switchMode(state);
      paint(state);
    });

    resetBtn.addEventListener('click', async () => {
      state = defaultPomoState();
      await savePomo(state);
      track('newtab_pomodoro_reset');
      paint(state);
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[POMO_KEY]) {
        state = changes[POMO_KEY].newValue || defaultPomoState();
        paint(state);
      }
    });

    loadPomo().then((s) => { state = s; paint(state); });
    setInterval(tick, 1000);
  }

  // ---- Background image ----
  const BG_KEY = 'gpap_newtab_background_v1';

  // Fixed wallpaper themes. Each photo's own palette (sampled and tuned for
  // legibility against the frosted card blur) drives a coordinated ink/accent/
  // surface set, so picking one re-themes the whole page to match the photo —
  // not just the picture behind it.
  const BG_PRESETS = [
    {
      id: 'tidal',
      name: 'Tidal',
      url: 'https://images.unsplash.com/photo-1751220170218-e57d53bd4aa8?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1751220170218-e57d53bd4aa8?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f2ede3', accent: '#cc8752', accentDark: '#945a34', accentInk: '#241407',
        surface: '#102024', surface2: '#1b2c30', border: 'rgba(255,255,255,0.16)'
      }
    },
    {
      id: 'highland',
      name: 'Highland',
      url: 'https://images.unsplash.com/photo-1787238347813-480a7ae6e71b?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1787238347813-480a7ae6e71b?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f4ede1', accent: '#c2935d', accentDark: '#8c6238', accentInk: '#1d130a',
        surface: '#211a13', surface2: '#2e251e', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'canopy',
      name: 'Canopy',
      url: 'https://images.unsplash.com/photo-1493673272479-a20888bcee10?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1493673272479-a20888bcee10?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#eef2ec', accent: '#5c9e7d', accentDark: '#2e664c', accentInk: '#0d1f17',
        surface: '#0f1714', surface2: '#17211d', border: 'rgba(255,255,255,0.14)'
      }
    },
    {
      id: 'basalt',
      name: 'Basalt',
      url: 'https://images.unsplash.com/photo-1786708740641-ac9d56d008f9?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1786708740641-ac9d56d008f9?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#eef0f0', accent: '#79ad6c', accentDark: '#48753d', accentInk: '#12210e',
        surface: '#1f2224', surface2: '#2c2e30', border: 'rgba(255,255,255,0.16)'
      }
    },
    {
      id: 'meadow',
      name: 'Meadow',
      url: 'https://images.unsplash.com/photo-1784231882494-5450ad619de9?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1784231882494-5450ad619de9?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#33281c', accent: '#8c753f', accentDark: '#614c22', accentInk: '#fbf5e9',
        surface: '#f5e7d3', surface2: '#e6d7c1', border: 'rgba(0,0,0,0.12)', overlay: 'rgba(0,0,0,0.10)'
      }
    },
    {
      id: 'reverie',
      name: 'Reverie',
      url: 'https://images.unsplash.com/photo-1758513207242-98d050b7eae4?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1758513207242-98d050b7eae4?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f1eef0', accent: '#cc858b', accentDark: '#8c4d58', accentInk: '#2a1013',
        surface: '#1a1415', surface2: '#251f20', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      // Busy, high-frequency mural pattern — leans on a darker overlay
      // than usual to keep the card blur legible over it.
      id: 'carnival',
      name: 'Carnival',
      url: 'https://images.unsplash.com/photo-1786723221986-f8ae8410f6a1?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1786723221986-f8ae8410f6a1?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#faf6f2', accent: '#d96845', accentDark: '#8c3827', accentInk: '#2a0d05',
        surface: '#1a1411', surface2: '#251e1b', border: 'rgba(255,255,255,0.15)', overlay: 'rgba(0,0,0,0.40)'
      }
    },
    {
      // Pale, low-saturation render — another "dark ink on light glass"
      // preset, with a lighter overlay so it stays airy rather than muddy.
      id: 'prism',
      name: 'Prism',
      url: 'https://images.unsplash.com/photo-1746796451267-4f83956bf84d?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1746796451267-4f83956bf84d?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#1f242b', accent: '#51748c', accentDark: '#29475c', accentInk: '#f0f5f8',
        surface: '#e1e9f0', surface2: '#ced7e0', border: 'rgba(0,0,0,0.12)', overlay: 'rgba(0,0,0,0.14)'
      }
    },
    {
      id: 'monochrome',
      name: 'Monochrome',
      url: 'https://images.unsplash.com/photo-1786200319214-24cf1172bb4b?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1786200319214-24cf1172bb4b?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f2f0ec', accent: '#b29568', accentDark: '#755b35', accentInk: '#241a0d',
        surface: '#1c1c1c', surface2: '#292929', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'ember',
      name: 'Ember',
      url: 'https://images.unsplash.com/photo-1786543691566-a69b03a4f06c?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1786543691566-a69b03a4f06c?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f4ecdd', accent: '#c7945a', accentDark: '#855a2e', accentInk: '#241505',
        surface: '#1c1712', surface2: '#28221c', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'moorland',
      name: 'Moorland',
      url: 'https://images.unsplash.com/photo-1786464765447-d177ccf45ea6?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1786464765447-d177ccf45ea6?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f2ede0', accent: '#b8a15c', accentDark: '#7a6631', accentInk: '#211a08',
        surface: '#211f1b', surface2: '#2e2c27', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'nocturne',
      name: 'Nocturne',
      url: 'https://images.unsplash.com/photo-1785963671545-73bcd2ea8664?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1785963671545-73bcd2ea8664?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f3ece5', accent: '#b86353', accentDark: '#7a352b', accentInk: '#230d08',
        surface: '#1a1312', surface2: '#251e1c', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'nightflora',
      name: 'Nightflora',
      url: 'https://images.unsplash.com/photo-1786130987650-534fea40faf8?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1786130987650-534fea40faf8?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#eef0e6', accent: '#888c54', accentDark: '#585c2e', accentInk: '#1c1f0a',
        surface: '#191a14', surface2: '#24251e', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      // Bright near-white photo — dark ink on light glass, minimal overlay.
      id: 'orchid',
      name: 'Orchid',
      url: 'https://images.unsplash.com/photo-1745570647583-08120794d68d?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1745570647583-08120794d68d?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#33212a', accent: '#994c6c', accentDark: '#6b2b48', accentInk: '#fdf3f6',
        surface: '#f2e4ea', surface2: '#e3d1d8', border: 'rgba(0,0,0,0.12)', overlay: 'rgba(0,0,0,0.10)'
      }
    },
    {
      id: 'raven',
      name: 'Raven',
      url: 'https://images.unsplash.com/photo-1780787175530-3cefaac55826?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1780787175530-3cefaac55826?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#eef0f4', accent: '#546599', accentDark: '#2e3c66', accentInk: '#10141f',
        surface: '#15171c', surface2: '#202228', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'summit',
      name: 'Summit',
      url: 'https://images.unsplash.com/photo-1780498178879-4064b19e6517?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1780498178879-4064b19e6517?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f6ece2', accent: '#c7825a', accentDark: '#85482e', accentInk: '#230f04',
        surface: '#1f1815', surface2: '#2a2320', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'verdant',
      name: 'Verdant',
      url: 'https://images.unsplash.com/photo-1780736941954-8d7b29ce3c10?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1780736941954-8d7b29ce3c10?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#eef2ec', accent: '#53a656', accentDark: '#2b6b2f', accentInk: '#0f2010',
        surface: '#121a12', surface2: '#1c251c', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'glimmer',
      name: 'Glimmer',
      url: 'https://images.unsplash.com/photo-1780583287735-8e4d680dd0ca?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1780583287735-8e4d680dd0ca?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f0ece2', accent: '#cca752', accentDark: '#8a672c', accentInk: '#241804',
        surface: '#141a1c', surface2: '#1e2528', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'chamomile',
      name: 'Chamomile',
      url: 'https://images.unsplash.com/photo-1779781238799-7194caec2b28?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1779781238799-7194caec2b28?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f1f2e8', accent: '#c7b750', accentDark: '#857228', accentInk: '#221c04',
        surface: '#181a12', surface2: '#24251d', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'companion',
      name: 'Companion',
      url: 'https://images.unsplash.com/photo-1611250282006-4484dd3fba6b?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/photo-1611250282006-4484dd3fba6b?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f5ece0', accent: '#c7975a', accentDark: '#855a2e', accentInk: '#241606',
        surface: '#1c1814', surface2: '#28231e', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'cheers',
      name: 'Cheers',
      url: 'https://images.unsplash.com/vector-1787880218469-d3ab1581c0e2?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1787880218469-d3ab1581c0e2?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f5f2e6', accent: '#bf56a0', accentDark: '#802d69', accentInk: '#29081f',
        surface: '#1b1f15', surface2: '#262a20', border: 'rgba(255,255,255,0.15)', overlay: 'rgba(0,0,0,0.36)'
      }
    },
    {
      id: 'wildleaf',
      name: 'Wildleaf',
      url: 'https://images.unsplash.com/vector-1776323044727-0ac0e24f52e1?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1776323044727-0ac0e24f52e1?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#f2f0e2', accent: '#b8535b', accentDark: '#7a2b35', accentInk: '#290a0d',
        surface: '#141c15', surface2: '#1e2820', border: 'rgba(255,255,255,0.15)', overlay: 'rgba(0,0,0,0.36)'
      }
    },
    {
      id: 'blush',
      name: 'Blush',
      url: 'https://images.unsplash.com/vector-1738239254988-8cbcffd01abb?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1738239254988-8cbcffd01abb?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#331f1c', accent: '#9e5b47', accentDark: '#6b3325', accentInk: '#fdf3ef',
        surface: '#f2d0d6', surface2: '#e3bfc5', border: 'rgba(0,0,0,0.12)', overlay: 'rgba(0,0,0,0.12)'
      }
    },
    {
      id: 'bluebell',
      name: 'Bluebell',
      url: 'https://images.unsplash.com/vector-1786138175242-db3bd9cf6c73?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1786138175242-db3bd9cf6c73?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#1f2938', accent: '#436694', accentDark: '#244066', accentInk: '#f4f8fc',
        surface: '#e6edf5', surface2: '#d3dce6', border: 'rgba(0,0,0,0.10)', overlay: 'rgba(0,0,0,0.10)'
      }
    },
    {
      id: 'sherbet',
      name: 'Sherbet',
      url: 'https://images.unsplash.com/vector-1783428892437-0c7af1f43132?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1783428892437-0c7af1f43132?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#38271f', accent: '#9e5c3f', accentDark: '#6b3422', accentInk: '#fef8f0',
        surface: '#f5e1ce', surface2: '#e6cfb8', border: 'rgba(0,0,0,0.10)', overlay: 'rgba(0,0,0,0.10)'
      }
    },
    {
      id: 'sunflower',
      name: 'Sunflower',
      url: 'https://images.unsplash.com/vector-1785676067269-9e97fe38357a?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1785676067269-9e97fe38357a?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#382e1c', accent: '#997836', accentDark: '#6b4e1b', accentInk: '#fdf7e8',
        surface: '#f5ecd3', surface2: '#e6dabc', border: 'rgba(0,0,0,0.10)', overlay: 'rgba(0,0,0,0.12)'
      }
    },
    {
      id: 'posy',
      name: 'Posy',
      url: 'https://images.unsplash.com/vector-1752297634103-efe9f8356bc2?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1752297634103-efe9f8356bc2?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#33212d', accent: '#8c4d87', accentDark: '#612c5c', accentInk: '#faf3f8',
        surface: '#f5e4d7', surface2: '#e6d0c1', border: 'rgba(0,0,0,0.10)', overlay: 'rgba(0,0,0,0.12)'
      }
    },
    {
      id: 'cherrypop',
      name: 'Cherrypop',
      url: 'https://images.unsplash.com/vector-1776547292902-bb38eaa3ebcd?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1776547292902-bb38eaa3ebcd?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#291f33', accent: '#a63a3e', accentDark: '#731d22', accentInk: '#fdf1f1',
        surface: '#d2c7ed', surface2: '#beb1de', border: 'rgba(0,0,0,0.12)', overlay: 'rgba(0,0,0,0.16)'
      }
    },
    {
      id: 'cabana',
      name: 'Cabana',
      url: 'https://images.unsplash.com/vector-1776882156106-3c402a478504?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1776882156106-3c402a478504?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#eef2f8', accent: '#5986b2', accentDark: '#2f5075', accentInk: '#0c1822',
        surface: '#141a24', surface2: '#1d242f', border: 'rgba(255,255,255,0.15)'
      }
    },
    {
      id: 'savanna',
      name: 'Savanna',
      url: 'https://images.unsplash.com/vector-1783428602319-8e6b589eefbe?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1783428602319-8e6b589eefbe?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#332a1a', accent: '#9e7f37', accentDark: '#6b501b', accentInk: '#fdf6e4',
        surface: '#f2e7c7', surface2: '#e3d6b1', border: 'rgba(0,0,0,0.10)', overlay: 'rgba(0,0,0,0.12)'
      }
    },
    {
      id: 'monarch',
      name: 'Monarch',
      url: 'https://images.unsplash.com/vector-1776441066617-28e6a5fecc8c?q=80&w=1600&auto=format&fit=crop',
      thumb: 'https://images.unsplash.com/vector-1776441066617-28e6a5fecc8c?q=70&w=160&h=160&auto=format&fit=crop',
      theme: {
        ink: '#33281a', accent: '#8c6b3f', accentDark: '#5c4020', accentInk: '#fdf6ec',
        surface: '#f5e0c4', surface2: '#e6cfae', border: 'rgba(0,0,0,0.10)', overlay: 'rgba(0,0,0,0.12)'
      }
    }
  ];
  const NT_BG_OVERRIDE_VARS = {
    ink: '--gpap-ink', accent: '--gpap-accent', accentDark: '--gpap-accent-dark', accentInk: '--gpap-accent-ink',
    surface: '--gpap-surface', surface2: '--gpap-surface-2', border: '--gpap-border'
  };

  function findPreset(id) { return BG_PRESETS.find((p) => p.id === id) || null; }

  // 'hourly'/'daily' are pure functions of the clock, so every call this
  // session naturally agrees — no caching needed, and it self-updates once
  // the hour/day rolls over. 'newtab' is genuinely random, so it's resolved
  // once per page load and cached, or the image and its theme colors (each
  // resolved from a separate call) would disagree with each other.
  let newtabShuffleChoiceIdx = null;
  function resolveShufflePreset(interval) {
    if (!BG_PRESETS.length) return null;
    if (interval === 'hourly') return BG_PRESETS[Math.floor(Date.now() / 3600000) % BG_PRESETS.length];
    if (interval === 'newtab') {
      if (newtabShuffleChoiceIdx === null) newtabShuffleChoiceIdx = Math.floor(Math.random() * BG_PRESETS.length);
      return BG_PRESETS[newtabShuffleChoiceIdx];
    }
    return BG_PRESETS[Math.floor(Date.now() / 86400000) % BG_PRESETS.length];
  }

  function effectivePreset(state) {
    if (state.mode === 'preset') return findPreset(state.presetId);
    if (state.mode === 'shuffle') return resolveShufflePreset(state.shuffleInterval || 'daily');
    return null;
  }

  function backgroundHasImage(state) {
    return !!effectivePreset(state) || (state.mode === 'url' && !!state.url);
  }

  function defaultBackground() {
    // Fresh installs land on shuffle + a new wallpaper every new tab; the
    // user can switch to None/Themes/Link/a different interval any time —
    // this only applies until they save any background choice of their own.
    return { mode: 'shuffle', url: '', presetId: '', shuffleInterval: 'newtab', textColor: '' };
  }
  async function loadBackground() {
    const r = await chrome.storage.local.get(BG_KEY);
    return Object.assign(defaultBackground(), r[BG_KEY] || {});
  }
  async function saveBackground(state) {
    await chrome.storage.local.set({ [BG_KEY]: state });
  }

  // Re-derives every theme-driven CSS var for the current background state:
  // start from the user's chosen app theme, layer a preset's coordinated
  // palette on top when one is active, then let a manual font-color pick
  // (works on presets and plain photo links, but not shuffle — a fixed
  // color would fight a different photo every rotation) win over ink/soft.
  async function applyBackgroundTheme(state, hasImage, resolvedPreset) {
    const themeRes = await chrome.storage.local.get(THEME_KEY);
    applyTheme(themeRes[THEME_KEY] || 'cream');

    const root = document.documentElement;
    const preset = resolvedPreset !== undefined ? resolvedPreset : effectivePreset(state);
    root.style.setProperty('--gpap-bg-overlay', (preset && preset.theme.overlay) || 'rgba(0, 0, 0, 0.32)');
    if (preset) {
      Object.keys(NT_BG_OVERRIDE_VARS).forEach((key) => {
        root.style.setProperty(NT_BG_OVERRIDE_VARS[key], preset.theme[key]);
      });
      root.style.setProperty('--gpap-ink-soft', `color-mix(in srgb, ${preset.theme.ink} 68%, transparent)`);
    }

    if (hasImage && state.textColor && state.mode !== 'shuffle') {
      root.style.setProperty('--gpap-ink', state.textColor);
      root.style.setProperty('--gpap-ink-soft', `color-mix(in srgb, ${state.textColor} 72%, transparent)`);
    }
  }

  function applyBackground(state) {
    const body = document.body;
    const preset = effectivePreset(state);
    const imgUrl = preset ? preset.url : (state.mode === 'url' ? state.url : null);

    if (imgUrl) {
      body.style.setProperty('background-image', `url(${JSON.stringify(imgUrl)})`);
      body.classList.add('nt-has-bg-image');
    } else {
      body.style.removeProperty('background-image');
      body.classList.remove('nt-has-bg-image');
    }

    applyBackgroundTheme(state, !!imgUrl, preset);
  }

  async function initBackground() {
    applyBackground(await loadBackground());
  }

  // Hourly/daily shuffle can roll over while the new tab stays open; recheck
  // periodically and reapply (cheap — just CSS var writes) so it doesn't
  // wait for the next tab to pick up the rotation. "newtab" never re-rolls
  // mid-session by design, so it's skipped here.
  function tickBackgroundShuffle() {
    loadBackground().then((state) => {
      if (state.mode === 'shuffle' && state.shuffleInterval !== 'newtab') applyBackground(state);
    });
  }

  function updateBgModeButtons(mode) {
    document.querySelectorAll('.nt-bg-mode-btn').forEach((btn) => {
      btn.classList.toggle('nt-bg-mode-active', btn.dataset.mode === mode);
    });
    const presetSub = document.getElementById('nt-bg-sub-preset');
    const shuffleSub = document.getElementById('nt-bg-sub-shuffle');
    const urlSub = document.getElementById('nt-bg-sub-url');
    const colorSub = document.getElementById('nt-bg-sub-color');
    if (presetSub) presetSub.hidden = mode !== 'preset';
    if (shuffleSub) shuffleSub.hidden = mode !== 'shuffle';
    if (urlSub) urlSub.hidden = mode !== 'url';
    if (colorSub) colorSub.hidden = mode === 'none' || mode === 'shuffle';
  }

  const BG_PRESETS_COLLAPSED_COUNT = 4;
  let bgPresetsExpanded = false;

  function renderBgPresets(activePresetId) {
    const wrap = document.getElementById('nt-bg-presets');
    const moreBtn = document.getElementById('nt-bg-presets-more');
    if (!wrap) return;

    const expanded = bgPresetsExpanded;
    const visible = expanded ? BG_PRESETS : BG_PRESETS.slice(0, BG_PRESETS_COLLAPSED_COUNT);

    wrap.replaceChildren(...visible.map((preset) => el('button', {
      type: 'button',
      class: `nt-bg-preset${preset.id === activePresetId ? ' nt-bg-preset-active' : ''}`,
      style: `background-image: url(${JSON.stringify(preset.thumb)})`,
      'data-preset': preset.id
    }, [el('span', { class: 'nt-bg-preset-name', text: preset.name })])));

    if (moreBtn) {
      moreBtn.hidden = BG_PRESETS.length <= BG_PRESETS_COLLAPSED_COUNT;
      moreBtn.textContent = expanded ? 'Show less' : `See more (${BG_PRESETS.length - BG_PRESETS_COLLAPSED_COUNT})`;
    }
  }

  async function renderShuffleStatus() {
    const statusEl = document.getElementById('nt-bg-shuffle-status');
    if (!statusEl) return;
    const state = await loadBackground();
    if (state.mode !== 'shuffle') { statusEl.textContent = ''; return; }
    const preset = resolveShufflePreset(state.shuffleInterval || 'daily');
    statusEl.textContent = preset ? `Showing: ${preset.name}` : '';
  }

  function updateShuffleButtons(interval) {
    document.querySelectorAll('.nt-bg-shuffle-btn').forEach((btn) => {
      btn.classList.toggle('nt-bg-shuffle-btn-active', btn.dataset.shuffle === interval);
    });
  }

  async function initBackgroundPanel() {
    const modeButtons = document.querySelectorAll('.nt-bg-mode-btn');
    const shuffleButtons = document.querySelectorAll('.nt-bg-shuffle-btn');
    const urlForm = document.getElementById('nt-bg-url-form');
    const urlInput = document.getElementById('nt-bg-url-input');
    const presetWrap = document.getElementById('nt-bg-presets');
    const presetsMoreBtn = document.getElementById('nt-bg-presets-more');
    const statusEl = document.getElementById('nt-bg-status');
    const colorInput = document.getElementById('nt-bg-color-input');
    const colorResetBtn = document.getElementById('nt-bg-color-reset');
    if (!modeButtons.length) return;

    const state = await loadBackground();
    updateBgModeButtons(state.mode);
    updateShuffleButtons(state.shuffleInterval || 'daily');
    renderShuffleStatus();
    if (urlInput) urlInput.value = state.url;
    // Auto-expand once on load if the already-saved theme would otherwise
    // be hidden behind "See more" — a one-time default, not a standing
    // override, so the toggle itself keeps working afterward.
    const activeIdx = BG_PRESETS.findIndex((p) => p.id === state.presetId);
    if (activeIdx >= BG_PRESETS_COLLAPSED_COUNT) bgPresetsExpanded = true;
    renderBgPresets(state.presetId);
    if (colorInput) {
      const preset = effectivePreset(state);
      colorInput.value = state.textColor || (preset ? preset.theme.ink : '#ffffff');
    }

    modeButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        const current = await loadBackground();
        current.mode = mode;
        await saveBackground(current);
        updateBgModeButtons(mode);
        if (statusEl) statusEl.textContent = '';
        applyBackground(current);
        renderShuffleStatus();
        track('newtab_bg_mode_change', { mode });
      });
    });

    shuffleButtons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const interval = btn.dataset.shuffle;
        const current = await loadBackground();
        current.shuffleInterval = interval;
        await saveBackground(current);
        updateShuffleButtons(interval);
        applyBackground(current);
        renderShuffleStatus();
        track('newtab_bg_shuffle_interval_change', { interval });
      });
    });

    if (presetsMoreBtn) {
      presetsMoreBtn.addEventListener('click', async () => {
        bgPresetsExpanded = !bgPresetsExpanded;
        const current = await loadBackground();
        renderBgPresets(current.presetId);
      });
    }

    if (presetWrap) {
      presetWrap.addEventListener('click', async (ev) => {
        const btn = ev.target.closest('.nt-bg-preset');
        if (!btn) return;
        const current = await loadBackground();
        current.mode = 'preset';
        current.presetId = btn.dataset.preset;
        current.textColor = '';
        await saveBackground(current);
        renderBgPresets(current.presetId);
        applyBackground(current);
        if (colorInput) colorInput.value = findPreset(current.presetId).theme.ink;
        track('newtab_bg_preset_change', { preset: current.presetId });
      });
    }

    if (colorInput) {
      colorInput.addEventListener('input', async () => {
        const current = await loadBackground();
        current.textColor = colorInput.value;
        await saveBackground(current);
        applyBackground(current);
        track('newtab_bg_textcolor_change');
      });
    }

    if (colorResetBtn) {
      colorResetBtn.addEventListener('click', async () => {
        const current = await loadBackground();
        current.textColor = '';
        await saveBackground(current);
        const preset = current.mode === 'preset' ? findPreset(current.presetId) : null;
        if (colorInput) colorInput.value = preset ? preset.theme.ink : '#ffffff';
        applyBackground(current);
        track('newtab_bg_textcolor_reset');
      });
    }

    if (urlForm) {
      urlForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        let href = urlInput.value.trim();
        if (!href) return;
        try { new URL(href); } catch (e) { if (statusEl) statusEl.textContent = 'Invalid URL'; return; }
        const current = await loadBackground();
        current.url = href;
        current.mode = 'url';
        await saveBackground(current);
        updateBgModeButtons('url');
        applyBackground(current);
        if (statusEl) statusEl.textContent = '';
        track('newtab_bg_url_set');
      });
    }
  }

  // ---- Section visibility ----
  // Every section defaults to visible (only an explicit `false` hides it),
  // except the ones listed here, which default to hidden until the user
  // opts in (only an explicit `true` shows them).
  const SECTIONS_DEFAULT_OFF = ['search'];
  function isSectionEnabled(key, state) {
    return SECTIONS_DEFAULT_OFF.includes(key) ? state[key] === true : state[key] !== false;
  }
  function applySectionVisibility(state) {
    Object.keys(SECTION_IDS).forEach((section) => {
      const node = document.getElementById(SECTION_IDS[section]);
      if (node) node.hidden = !isSectionEnabled(section, state);
    });
  }

  async function initSectionVisibility() {
    const result = await chrome.storage.local.get(SECTIONS_KEY);
    applySectionVisibility(result[SECTIONS_KEY] || {});
  }

  // ---- New Tab Dashboard master toggle ----
  // "full" (default) is today's whole dashboard. "minimal" strips it down to
  // just the clock, date, search bar, and Favorite Links (plus the footer's
  // version tag / review link, always pinned to the bottom) — Mini RDS3 and
  // What if (the popup + content scripts on the RDS3 portal) are untouched
  // either way, since they don't depend on this new-tab page at all.
  const MASTER_MODE_KEY = 'gpap_newtab_master_mode_v1';
  const MASTER_MODE_MINIMAL_HIDE = ['nt-section-cgpa', 'nt-section-weekly', 'nt-section-links'];
  const MASTER_MODE_MINIMAL_SHOW = ['nt-section-search', 'nt-section-favorites'];
  let currentMasterMode = 'full';

  function applyMasterMode(mode) {
    currentMasterMode = mode === 'minimal' ? 'minimal' : 'full';
    const minimal = currentMasterMode === 'minimal';
    document.body.classList.toggle('nt-minimal-mode', minimal);

    const mainGrid = document.getElementById('nt-main-grid');
    if (mainGrid) mainGrid.hidden = minimal;

    if (minimal) {
      const loginPrompt = document.getElementById('nt-login-prompt');
      if (loginPrompt) loginPrompt.hidden = true;
      MASTER_MODE_MINIMAL_HIDE.forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.hidden = true;
      });
      MASTER_MODE_MINIMAL_SHOW.forEach((id) => {
        const node = document.getElementById(id);
        if (node) node.hidden = false;
      });
    } else {
      // Leaving minimal mode — hand visibility back to the normal rules.
      applyPortalDataState();
      chrome.storage.local.get(SECTIONS_KEY).then((r) => applySectionVisibility(r[SECTIONS_KEY] || {}));
    }
  }

  async function initMasterMode() {
    const result = await chrome.storage.local.get(MASTER_MODE_KEY);
    applyMasterMode(result[MASTER_MODE_KEY] || 'full');
  }

  async function syncMasterModeToggle() {
    const checkbox = document.getElementById('nt-master-mode-toggle');
    if (!checkbox) return;
    const result = await chrome.storage.local.get(MASTER_MODE_KEY);
    checkbox.checked = (result[MASTER_MODE_KEY] || 'full') !== 'minimal';
  }

  function initMasterModeToggle() {
    const checkbox = document.getElementById('nt-master-mode-toggle');
    if (!checkbox) return;
    checkbox.addEventListener('change', async () => {
      const mode = checkbox.checked ? 'full' : 'minimal';
      await chrome.storage.local.set({ [MASTER_MODE_KEY]: mode });
      applyMasterMode(mode);
      track('newtab_fab_master_mode_change', { mode });
    });
  }

  // ---- Card order (grid cards only — the CGPA and Weekly To-do hero
  // banners stay fixed at the top/bottom of the page) ----
  function normalizeCardOrder(saved) {
    const order = (saved || []).filter((key) => GRID_CARD_KEYS.includes(key));
    GRID_CARD_KEYS.forEach((key) => { if (!order.includes(key)) order.push(key); });
    return order;
  }
  async function loadCardOrder() {
    const r = await chrome.storage.local.get(CARD_ORDER_KEY);
    return normalizeCardOrder(r[CARD_ORDER_KEY]);
  }
  async function saveCardOrder(order) {
    await chrome.storage.local.set({ [CARD_ORDER_KEY]: order });
  }
  function applyCardOrder(order) {
    normalizeCardOrder(order).forEach((key, index) => {
      const node = document.getElementById(SECTION_IDS[key]);
      if (node) node.style.order = index;
    });
  }
  async function initCardOrder() {
    applyCardOrder(await loadCardOrder());
  }

  // ---- Portal login-state gate ----
  // Until either grades or attendance/routine data has been synced from
  // RDS3, hide the four data-dependent cards and show one combined prompt
  // instead of four separate "visit this page to sync" empty states.
  const PORTAL_SECTION_KEYS = ['cgpa', 'today', 'attendance', 'routine'];

  async function applyPortalDataState() {
    if (currentMasterMode === 'minimal') return;
    const promptEl = document.getElementById('nt-login-prompt');
    const [gradesRes, mrdsRes] = await Promise.all([
      chrome.storage.local.get(GRADES_KEY),
      chrome.storage.local.get(MRDS_KEY)
    ]);
    const hasData = !!gradesRes[GRADES_KEY] || !!mrdsRes[MRDS_KEY];

    if (promptEl) promptEl.hidden = hasData;

    if (!hasData) {
      PORTAL_SECTION_KEYS.forEach((key) => {
        const node = document.getElementById(SECTION_IDS[key]);
        if (node) node.hidden = true;
      });
    } else {
      const result = await chrome.storage.local.get(SECTIONS_KEY);
      applySectionVisibility(result[SECTIONS_KEY] || {});
    }
  }

  // ---- Google Search bar (hidden by default, opt-in via Customize) ----
  function initSearchForm() {
    const form = document.getElementById('nt-search-form');
    const input = document.getElementById('nt-search-input');
    if (!form || !input) return;
    form.addEventListener('submit', (ev) => {
      if (!input.value.trim()) { ev.preventDefault(); return; }
      track('newtab_search_submit');
    });
  }

  // ---- Quick Links card (static) ----
  const QUICK_LINKS = [
    { label: 'RDS3', href: 'https://rds3.northsouth.edu/' },
    { label: 'Canvas', href: 'https://northsouth.instructure.com/' },
    { label: 'NSU Announcements', href: 'https://www.northsouth.edu/nsu-announcements/' },
    { label: 'NSU Notice Board', href: 'https://www.northsouth.edu/dept-notices/fao-noticebaord/' },
    { label: 'RDS2, from the future', href: 'https://rds2-bff.vercel.app/' },
    { label: 'Join Community', href: 'https://t.me/nsu_advising_helper_bot_channel' }
  ];

  function renderQuickLinks() {
    const body = document.getElementById('nt-links-body');
    if (!body) return;
    const wrap = el('div', { class: 'nt-links-wrap' });
    QUICK_LINKS.forEach((link) => {
      const anchor = el('a', {
        class: 'nt-link-pill',
        href: link.href,
        target: '_blank',
        rel: 'noopener noreferrer',
        text: link.label
      });
      anchor.addEventListener('click', () => track('newtab_click_quick_link', { label: link.label }));
      wrap.appendChild(anchor);
    });
    body.replaceChildren(wrap);
  }

  // ---- Favorite Links card (user-editable, pinned like a browser new tab) ----
  const FAV_KEY = 'gpap_newtab_favorites_v1';
  const DEFAULT_FAVORITES = [
    { id: 'demo-gcal', title: 'Google Calendar', href: 'https://calendar.google.com/' },
    { id: 'demo-gmail', title: 'Gmail', href: 'https://mail.google.com/' },
    { id: 'demo-youtube', title: 'YouTube', href: 'https://www.youtube.com/' }
  ];
  const FALLBACK_FAV_ICON = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238c8072' stroke-width='2'><circle cx='12' cy='12' r='9'/><path d='M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18z'/></svg>";

  async function loadFavorites() {
    const r = await chrome.storage.local.get(FAV_KEY);
    if (FAV_KEY in r) return r[FAV_KEY];
    await chrome.storage.local.set({ [FAV_KEY]: DEFAULT_FAVORITES });
    return DEFAULT_FAVORITES;
  }
  async function saveFavorites(favs) {
    await chrome.storage.local.set({ [FAV_KEY]: favs });
  }

  function faviconFor(href) {
    try {
      const hostname = new URL(href).hostname;
      return `https://www.google.com/s2/favicons?sz=32&domain=${hostname}`;
    } catch (e) {
      return FALLBACK_FAV_ICON;
    }
  }

  function toggleFavForm(show) {
    const form = document.getElementById('nt-fav-form');
    if (!form) return;
    form.hidden = show === undefined ? !form.hidden : !show;
    if (!form.hidden) document.getElementById('nt-fav-title').focus();
  }

  async function renderFavorites() {
    const body = document.getElementById('nt-favs-body');
    if (!body) return;
    const favs = await loadFavorites();

    const nodes = favs.map((fav) => {
      const icon = el('img', { class: 'nt-fav-icon', src: faviconFor(fav.href), alt: '' });
      icon.addEventListener('error', () => { icon.src = FALLBACK_FAV_ICON; });

      const anchor = el('a', {
        class: 'nt-fav-link',
        href: fav.href,
        target: '_blank',
        rel: 'noopener noreferrer'
      }, [icon, el('span', { text: fav.title })]);
      anchor.addEventListener('click', () => track('newtab_click_favorite', { label: fav.title }));

      const del = el('button', { class: 'nt-fav-del', type: 'button', text: '×', title: 'Remove' });
      del.addEventListener('click', async () => {
        const ok = await confirmDialog(`Remove "${fav.title}" from your favorites?`);
        if (!ok) return;
        const current = await loadFavorites();
        await saveFavorites(current.filter((x) => x.id !== fav.id));
        track('newtab_fav_delete');
        renderFavorites();
      });

      return el('span', { class: 'nt-fav-pill' }, [anchor, del]);
    });

    const add = el('button', { class: 'nt-fav-add', type: 'button', title: 'Add favorite', text: '+' });
    add.addEventListener('click', () => toggleFavForm());
    nodes.push(add);

    body.replaceChildren(...nodes);
  }

  function initFavoritesForm() {
    const form = document.getElementById('nt-fav-form');
    const titleInput = document.getElementById('nt-fav-title');
    const urlInput = document.getElementById('nt-fav-url');
    const cancel = document.getElementById('nt-fav-cancel');
    if (!form) return;

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const title = titleInput.value.trim();
      let href = urlInput.value.trim();
      if (!title || !href) return;
      if (!/^https?:\/\//i.test(href)) href = `https://${href}`;
      try { new URL(href); } catch (e) { return; }

      const favs = await loadFavorites();
      favs.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, title, href });
      await saveFavorites(favs);
      track('newtab_fav_add');

      titleInput.value = '';
      urlInput.value = '';
      toggleFavForm(false);
      renderFavorites();
    });

    cancel.addEventListener('click', () => {
      titleInput.value = '';
      urlInput.value = '';
      toggleFavForm(false);
    });
  }

  // ---- Floating customize button (mirrors the popup's theme + section controls) ----
  const SECTION_LABELS = {
    cgpa: 'CGPA', today: "Today's Classes", attendance: 'Attendance', routine: 'Routine',
    todo: 'To-do', pomodoro: 'Focus Timer', search: 'Google Search', links: 'Quick Links', favorites: 'Favorite Links', weekly: 'Weekly To-do'
  };

  function renderSettingsSwatches(activeTheme) {
    const wrap = document.getElementById('nt-settings-swatches');
    if (!wrap) return;
    wrap.replaceChildren(...Object.keys(GPAP_THEMES).map((id) => {
      const theme = GPAP_THEMES[id];
      const btn = el('button', {
        class: `nt-set-swatch${id === activeTheme ? ' nt-set-swatch-active' : ''}`,
        type: 'button',
        title: id.charAt(0).toUpperCase() + id.slice(1),
        style: `--sw-a:${theme.bg};--sw-b:${theme.accent}`
      });
      btn.addEventListener('click', async () => {
        await chrome.storage.local.set({ [THEME_KEY]: id });
        track('newtab_fab_theme_change', { theme: id });
        renderSettingsSwatches(id);
      });
      return btn;
    }));
  }

  function renderSettingsFonts(activeFont) {
    const wrap = document.getElementById('nt-settings-fonts');
    if (!wrap) return;
    wrap.replaceChildren(...Object.keys(CLOCK_FONTS).map((id) => {
      const font = CLOCK_FONTS[id];
      const btn = el('button', {
        class: `nt-set-font${id === activeFont ? ' nt-set-font-active' : ''}`,
        type: 'button',
        title: font.label
      }, [
        el('span', { class: 'nt-set-font-preview', text: 'Aa', style: `font-family:${font.family}` }),
        el('span', { class: 'nt-set-font-name', text: font.label })
      ]);
      btn.addEventListener('click', async () => {
        await chrome.storage.local.set({ [CLOCK_FONT_KEY]: id });
        track('newtab_fab_clock_font_change', { font: id });
        renderSettingsFonts(id);
      });
      return btn;
    }));
  }

  function renderSettingsSizes(activeSize) {
    const wrap = document.getElementById('nt-settings-sizes');
    if (!wrap) return;
    wrap.replaceChildren(...Object.keys(CLOCK_SIZES).map((id) => {
      const size = CLOCK_SIZES[id];
      const btn = el('button', {
        class: `nt-set-size${id === activeSize ? ' nt-set-size-active' : ''}`,
        type: 'button',
        text: size.label
      });
      btn.addEventListener('click', async () => {
        await chrome.storage.local.set({ [CLOCK_SIZE_KEY]: id });
        track('newtab_fab_clock_size_change', { size: id });
        renderSettingsSizes(id);
      });
      return btn;
    }));
  }

  function renderSettingsSearchStyles(activeStyle) {
    const wrap = document.getElementById('nt-settings-searchstyles');
    if (!wrap) return;
    wrap.replaceChildren(...Object.keys(SEARCH_STYLES).map((id) => {
      const style = SEARCH_STYLES[id];
      const btn = el('button', {
        class: `nt-set-searchstyle${id === activeStyle ? ' nt-set-searchstyle-active' : ''}`,
        type: 'button',
        text: style.label
      });
      btn.addEventListener('click', async () => {
        await chrome.storage.local.set({ [SEARCH_STYLE_KEY]: id });
        applySearchStyle(id);
        track('newtab_fab_search_style_change', { style: id });
        renderSettingsSearchStyles(id);
      });
      return btn;
    }));
  }

  function renderSettingsSearchWidths(activeWidth) {
    const wrap = document.getElementById('nt-settings-searchwidths');
    if (!wrap) return;
    wrap.replaceChildren(...Object.keys(SEARCH_WIDTHS).map((id) => {
      const width = SEARCH_WIDTHS[id];
      const btn = el('button', {
        class: `nt-set-searchstyle${id === activeWidth ? ' nt-set-searchstyle-active' : ''}`,
        type: 'button',
        text: width.label
      });
      btn.addEventListener('click', async () => {
        await chrome.storage.local.set({ [SEARCH_WIDTH_KEY]: id });
        applySearchWidth(id);
        track('newtab_fab_search_width_change', { width: id });
        renderSettingsSearchWidths(id);
      });
      return btn;
    }));
  }

  async function renderSettingsSections() {
    const wrap = document.getElementById('nt-settings-sections');
    if (!wrap) return;
    const result = await chrome.storage.local.get(SECTIONS_KEY);
    const state = result[SECTIONS_KEY] || {};
    wrap.replaceChildren(...Object.keys(SECTION_IDS).map((key) => {
      const checkbox = el('input', { type: 'checkbox' });
      checkbox.checked = isSectionEnabled(key, state);
      checkbox.addEventListener('change', async () => {
        const current = await chrome.storage.local.get(SECTIONS_KEY);
        const next = Object.assign({}, current[SECTIONS_KEY] || {}, { [key]: checkbox.checked });
        await chrome.storage.local.set({ [SECTIONS_KEY]: next });
        track('newtab_fab_section_toggle', { section: key, enabled: checkbox.checked });
      });
      const label = el('label', { class: 'nt-switch' }, [checkbox, el('span', { class: 'nt-switch-track' })]);
      return el('div', { class: 'nt-settings-row' }, [
        el('span', { class: 'nt-settings-row-label', text: SECTION_LABELS[key] || key }),
        label
      ]);
    }));
  }

  async function renderSettingsOrder() {
    const wrap = document.getElementById('nt-settings-order');
    if (!wrap) return;
    const order = await loadCardOrder();

    async function move(key, dir) {
      const current = await loadCardOrder();
      const i = current.indexOf(key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= current.length) return;
      [current[i], current[j]] = [current[j], current[i]];
      await saveCardOrder(current);
      applyCardOrder(current);
      track('newtab_fab_card_reorder', { section: key, direction: dir > 0 ? 'down' : 'up' });
      renderSettingsOrder();
    }

    wrap.replaceChildren(...order.map((key, index) => {
      const up = el('button', { class: 'nt-order-btn', type: 'button', title: 'Move up', text: '↑' });
      up.disabled = index === 0;
      up.addEventListener('click', () => move(key, -1));

      const down = el('button', { class: 'nt-order-btn', type: 'button', title: 'Move down', text: '↓' });
      down.disabled = index === order.length - 1;
      down.addEventListener('click', () => move(key, 1));

      return el('div', { class: 'nt-settings-row' }, [
        el('span', { class: 'nt-settings-row-label', text: SECTION_LABELS[key] || key }),
        el('div', { class: 'nt-order-btns' }, [up, down])
      ]);
    }));
  }

  function initSettingsPanel() {
    const fab = document.getElementById('nt-fab-settings');
    const panel = document.getElementById('nt-settings-panel');
    const overlay = document.getElementById('nt-settings-overlay');
    const closeBtn = document.getElementById('nt-settings-close');
    if (!fab || !panel) return;

    async function open() {
      const themeRes = await chrome.storage.local.get(THEME_KEY);
      renderSettingsSwatches(themeRes[THEME_KEY] || 'cream');
      const fontRes = await chrome.storage.local.get(CLOCK_FONT_KEY);
      renderSettingsFonts(fontRes[CLOCK_FONT_KEY] || 'default');
      const sizeRes = await chrome.storage.local.get(CLOCK_SIZE_KEY);
      renderSettingsSizes(sizeRes[CLOCK_SIZE_KEY] || 'small');
      const searchStyleRes = await chrome.storage.local.get(SEARCH_STYLE_KEY);
      renderSettingsSearchStyles(searchStyleRes[SEARCH_STYLE_KEY] || 'pill');
      const searchWidthRes = await chrome.storage.local.get(SEARCH_WIDTH_KEY);
      renderSettingsSearchWidths(searchWidthRes[SEARCH_WIDTH_KEY] || 'default');
      await syncMasterModeToggle();
      await renderSettingsSections();
      await renderSettingsOrder();
      panel.hidden = false;
      overlay.hidden = false;
      track('newtab_fab_open');
    }
    function close() {
      panel.hidden = true;
      overlay.hidden = true;
    }

    fab.addEventListener('click', () => { if (panel.hidden) open(); else close(); });
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', close);
  }

  function initReviewLink() {
    const link = document.getElementById('nt-review-link');
    if (link) link.addEventListener('click', () => track('newtab_click_review_link'));
  }

  function initVersionTag() {
    const tag = document.getElementById('nt-beta-tag');
    if (!tag) return;
    const version = chrome.runtime.getManifest().version;
    tag.textContent = `v${version}`;
  }

  function initLoginPromptLink() {
    const link = document.getElementById('nt-login-prompt-link');
    if (link) link.addEventListener('click', () => track('newtab_click_login_prompt'));
  }

  // ---- Boot ----
  track('newtab_page_view');
  initTheme();
  initClockFont();
  initClockSize();
  initSearchStyle();
  initSearchWidth();
  initBackground();
  setInterval(tickBackgroundShuffle, 60000);
  tickClock();
  setInterval(tickClock, 15000);
  renderGrades();
  renderTodayClasses();
  renderAttendance();
  renderRoutine();
  renderTodos();
  renderWeeklyTodos();
  renderQuickLinks();
  renderFavorites();
  initSearchForm();
  initReviewLink();
  initVersionTag();
  initLoginPromptLink();
  initTodoForm();
  initFavoritesForm();
  initPomodoro();
  initCardOrder();
  initSettingsPanel();
  initMasterModeToggle();
  initBackgroundPanel();

  // These three all set .hidden on overlapping sections (cgpa/weekly/links/
  // favorites/login-prompt), so they must resolve in this order — master
  // mode last — instead of racing as independent unawaited calls.
  (async () => {
    await initSectionVisibility();
    await applyPortalDataState();
    await initMasterMode();
  })();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[GRADES_KEY]) { renderGrades(); applyPortalDataState(); }
    if (changes[MRDS_KEY]) { renderTodayClasses(); renderAttendance(); renderRoutine(); applyPortalDataState(); }
    if (changes[TODO_KEY]) renderTodos();
    if (changes[WEEKLY_TODO_KEY]) renderWeeklyTodos();
    if (changes[FAV_KEY]) renderFavorites();
    if (changes[SECTIONS_KEY] && currentMasterMode !== 'minimal') { applySectionVisibility(changes[SECTIONS_KEY].newValue || {}); applyPortalDataState(); }
    if (changes[MASTER_MODE_KEY]) applyMasterMode(changes[MASTER_MODE_KEY].newValue || 'full');
    if (changes[CARD_ORDER_KEY]) applyCardOrder(changes[CARD_ORDER_KEY].newValue || []);
    if (changes[THEME_KEY]) {
      renderGrades();
      loadBackground().then((s) => applyBackgroundTheme(s, backgroundHasImage(s)));
    }
    if (changes[CLOCK_FONT_KEY]) applyClockFont(changes[CLOCK_FONT_KEY].newValue || 'default');
    if (changes[CLOCK_SIZE_KEY]) applyClockSize(changes[CLOCK_SIZE_KEY].newValue || 'small');
    if (changes[SEARCH_STYLE_KEY]) applySearchStyle(changes[SEARCH_STYLE_KEY].newValue || 'pill');
    if (changes[SEARCH_WIDTH_KEY]) applySearchWidth(changes[SEARCH_WIDTH_KEY].newValue || 'default');
    if (changes[BG_KEY]) {
      const state = Object.assign(defaultBackground(), changes[BG_KEY].newValue || {});
      applyBackground(state);
      updateBgModeButtons(state.mode);
      updateShuffleButtons(state.shuffleInterval || 'daily');
      renderShuffleStatus();
    }
  });
})();
