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
  const DARK_THEMES = new Set(['midnight', 'dark']);

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
    caveat: { label: 'Script', family: "'Caveat', cursive", tracking: 'normal' }
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

  // ---- Section visibility ----
  function applySectionVisibility(state) {
    Object.keys(SECTION_IDS).forEach((section) => {
      const node = document.getElementById(SECTION_IDS[section]);
      if (node) node.hidden = state[section] === false;
    });
  }

  async function initSectionVisibility() {
    const result = await chrome.storage.local.get(SECTIONS_KEY);
    applySectionVisibility(result[SECTIONS_KEY] || {});
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
    todo: 'To-do', pomodoro: 'Focus Timer', links: 'Quick Links', favorites: 'Favorite Links', weekly: 'Weekly To-do'
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

  async function renderSettingsSections() {
    const wrap = document.getElementById('nt-settings-sections');
    if (!wrap) return;
    const result = await chrome.storage.local.get(SECTIONS_KEY);
    const state = result[SECTIONS_KEY] || {};
    wrap.replaceChildren(...Object.keys(SECTION_IDS).map((key) => {
      const checkbox = el('input', { type: 'checkbox' });
      checkbox.checked = state[key] !== false;
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

  function initLoginPromptLink() {
    const link = document.getElementById('nt-login-prompt-link');
    if (link) link.addEventListener('click', () => track('newtab_click_login_prompt'));
  }

  // ---- Boot ----
  track('newtab_page_view');
  initTheme();
  initClockFont();
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
  initReviewLink();
  initLoginPromptLink();
  initTodoForm();
  initFavoritesForm();
  initPomodoro();
  initSectionVisibility();
  initCardOrder();
  initSettingsPanel();
  applyPortalDataState();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[GRADES_KEY]) { renderGrades(); applyPortalDataState(); }
    if (changes[MRDS_KEY]) { renderTodayClasses(); renderAttendance(); renderRoutine(); applyPortalDataState(); }
    if (changes[TODO_KEY]) renderTodos();
    if (changes[WEEKLY_TODO_KEY]) renderWeeklyTodos();
    if (changes[FAV_KEY]) renderFavorites();
    if (changes[SECTIONS_KEY]) { applySectionVisibility(changes[SECTIONS_KEY].newValue || {}); applyPortalDataState(); }
    if (changes[CARD_ORDER_KEY]) applyCardOrder(changes[CARD_ORDER_KEY].newValue || []);
    if (changes[THEME_KEY]) { applyTheme(changes[THEME_KEY].newValue || 'cream'); renderGrades(); }
    if (changes[CLOCK_FONT_KEY]) applyClockFont(changes[CLOCK_FONT_KEY].newValue || 'default');
  });
})();
