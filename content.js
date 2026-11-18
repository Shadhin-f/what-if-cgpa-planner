(function () {
  'use strict';

  function track(name, params) {
    try {
      chrome.runtime.sendMessage({ type: 'gpap_analytics_event', name, params: params || {} });
    } catch (e) { /* analytics must never break the extension */ }
  }

  const GRADE_POINTS = {
    'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'F': 0.0
  };
  const GRADE_OPTIONS = Object.keys(GRADE_POINTS).concat(['W', 'I']);

  const HONOR_TIERS = [
    { min: 3.80, name: 'Summa Cum Laude', cls: 'gpap-honor-summa' },
    { min: 3.65, name: 'Magna Cum Laude', cls: 'gpap-honor-magna' },
    { min: 3.50, name: 'Cum Laude', cls: 'gpap-honor-cum' }
  ];

  function honorFor(cgpa) {
    if (cgpa === null || cgpa === undefined) return null;
    return HONOR_TIERS.find((t) => cgpa >= t.min) || null;
  }

  function pointsFor(grade) {
    const g = (grade || '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(GRADE_POINTS, g) ? GRADE_POINTS[g] : null;
  }

  function normCode(code) {
    return (code || '').trim().toUpperCase();
  }

  function findTableByHeaders(required, doc) {
    const tables = (doc || document).querySelectorAll('table');
    for (const t of tables) {
      if (!t.rows.length) continue;
      const headers = [...t.rows[0].cells].map((c) => c.innerText.trim());
      if (required.every((h) => headers.includes(h))) return t;
    }
    return null;
  }

  const GRADE_HISTORY_PATH = '/students/grade_history';

  const NEWTAB_GRADES_KEY = 'gpap_newtab_grades_v1';
  function cacheGradesForNewTab(summary) {
    try { chrome.storage.local.set({ [NEWTAB_GRADES_KEY]: summary }); } catch (e) { /* ignore */ }
  }

  // Shared, five-way palette — kept in sync with the identical table in
  // mini-rds3.js and newtab.js, all keyed by the same 'gpap_theme_v1' value
  // so picking a theme in the popup re-themes every surface at once.
  const GPAP_THEMES = {
    cream: {
      bg: '#faf5ee', bgAlt: '#f1e6d6', surface: '#fffbf6', surface2: '#f6efe4', border: '#e7dbc7',
      ink: '#3d362f', inkSoft: '#8c8072', accent: '#c1774c', accentDark: '#a6613b', accentSoft: '#f3e2d0', accentInk: '#fffbf6',
      indigo: '#5f6c85', indigoSoft: '#e6e9f0', sage: '#74915f', sageSoft: '#e6ebdc',
      rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    midnight: {
      bg: '#1e1b18', bgAlt: '#26221d', surface: '#2a2521', surface2: '#322c26', border: '#453e35',
      ink: '#f3ece1', inkSoft: '#a89c8c', accent: '#e2905f', accentDark: '#f0a878', accentSoft: '#3d2a20', accentInk: '#fffbf6',
      indigo: '#8b97b3', indigoSoft: '#2b3040', sage: '#8fae78', sageSoft: '#263323',
      rust: '#d97b6c', rustSoft: '#3a2320', gold: '#d9ae5e', goldSoft: '#3a2f1c'
    },
    ocean: {
      bg: '#f2f7f8', bgAlt: '#e3eef0', surface: '#ffffff', surface2: '#eaf2f3', border: '#cfe1e3',
      ink: '#223338', inkSoft: '#6f8489', accent: '#2f7f8c', accentDark: '#23636e', accentSoft: '#dcedef', accentInk: '#fffbf6',
      indigo: '#5f6c85', indigoSoft: '#e6e9f0', sage: '#5f9e7a', sageSoft: '#e1f0e6',
      rust: '#c2604f', rustSoft: '#f6ded9', gold: '#c99a3f', goldSoft: '#f6ebd3'
    },
    forest: {
      bg: '#f5f7ee', bgAlt: '#e9edda', surface: '#ffffff', surface2: '#eef1e2', border: '#d8ddc3',
      ink: '#2f3626', inkSoft: '#7c8468', accent: '#6b8f3f', accentDark: '#556f30', accentSoft: '#e4ecd4', accentInk: '#fffbf6',
      indigo: '#5f6c85', indigoSoft: '#e6e9f0', sage: '#4f8f5e', sageSoft: '#dcefe0',
      rust: '#b6604a', rustSoft: '#f2ded6', gold: '#bd9a3c', goldSoft: '#f2ead0'
    },
    plum: {
      bg: '#f8f3f6', bgAlt: '#efe1e9', surface: '#fffbfd', surface2: '#f4e9ef', border: '#e3cdd9',
      ink: '#372733', inkSoft: '#8c7686', accent: '#9a5b84', accentDark: '#7c4568', accentSoft: '#f0dce9', accentInk: '#fffbf6',
      indigo: '#5f6c85', indigoSoft: '#e6e9f0', sage: '#6f9a6e', sageSoft: '#e2eee0',
      rust: '#b95a5f', rustSoft: '#f4dcdd', gold: '#bb8f45', goldSoft: '#f2e6cf'
    },
    white: {
      bg: '#ffffff', bgAlt: '#f4f4f4', surface: '#ffffff', surface2: '#f0f0f0', border: '#d4d4d4',
      ink: '#111111', inkSoft: '#666666', accent: '#111111', accentDark: '#000000', accentSoft: '#e2e2e2', accentInk: '#fffbf6',
      indigo: '#5f6c85', indigoSoft: '#e6e9f0', sage: '#3f7d4f', sageSoft: '#e3efe4',
      rust: '#b23b3b', rustSoft: '#f4dede', gold: '#a3821f', goldSoft: '#f2e9d0'
    },
    dark: {
      bg: '#000000', bgAlt: '#0a0a0a', surface: '#121212', surface2: '#1c1c1c', border: '#333333',
      ink: '#f5f5f5', inkSoft: '#999999', accent: '#d8d8d8', accentDark: '#efefef', accentSoft: '#262626', accentInk: '#141414',
      indigo: '#8b97b3', indigoSoft: '#2b3040', sage: '#6fae7a', sageSoft: '#16241a',
      rust: '#d97a7a', rustSoft: '#2a1616', gold: '#d8b962', goldSoft: '#2a2213'
    },
    rose: {
      bg: '#fbf3f2', bgAlt: '#f5e3e1', surface: '#fffbfa', surface2: '#f9ebe9', border: '#edd6d3',
      ink: '#3d2a28', inkSoft: '#8c7370', accent: '#c76b6f', accentDark: '#a8494e', accentSoft: '#f3dcda', accentInk: '#fffbf6',
      indigo: '#6d5f85', indigoSoft: '#eee7f0', sage: '#74915f', sageSoft: '#e6ebdc',
      rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    slate: {
      bg: '#f3f5f7', bgAlt: '#e5e9ed', surface: '#ffffff', surface2: '#eef1f4', border: '#d6dde3',
      ink: '#2b333b', inkSoft: '#707c87', accent: '#52708c', accentDark: '#3d5670', accentSoft: '#dee7ee', accentInk: '#fffbf6',
      indigo: '#4a5a8c', indigoSoft: '#e2e6f0', sage: '#5f9e7a', sageSoft: '#e1f0e6',
      rust: '#c2604f', rustSoft: '#f6ded9', gold: '#c99a3f', goldSoft: '#f6ebd3'
    },
    sand: {
      bg: '#faf1e6', bgAlt: '#f0decb', surface: '#fffaf2', surface2: '#f6ead9', border: '#e6d2b8',
      ink: '#3f2f21', inkSoft: '#8f7a63', accent: '#c17840', accentDark: '#9c5b2b', accentSoft: '#f0dcc4', accentInk: '#fffbf6',
      indigo: '#5f6c85', indigoSoft: '#e6e9f0', sage: '#74915f', sageSoft: '#e6ebdc',
      rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    sage: {
      bg: '#f4f6f0', bgAlt: '#e6ebdd', surface: '#fdfdf9', surface2: '#eef1e6', border: '#dde3d0',
      ink: '#313a2b', inkSoft: '#7c8874', accent: '#7a9169', accentDark: '#5c7350', accentSoft: '#e3ead9', accentInk: '#fffbf6',
      indigo: '#5f6c85', indigoSoft: '#e6e9f0', sage: '#74915f', sageSoft: '#e6ebdc',
      rust: '#b0574b', rustSoft: '#f3ddd8', gold: '#c1953f', goldSoft: '#f5ead2'
    },
    neon: {
      bg: '#0a0a0c', bgAlt: '#121215', surface: '#17171a', surface2: '#1e1e22', border: '#2c2c31',
      ink: '#f3f6f2', inkSoft: '#9aa39a', accent: '#39e07a', accentDark: '#1fb85f', accentSoft: '#14301f', accentInk: '#06170d',
      indigo: '#7c8cff', indigoSoft: '#1c1f3a', sage: '#39e07a', sageSoft: '#14301f',
      rust: '#ff5c5c', rustSoft: '#3a1414', gold: '#f5d442', goldSoft: '#332a0a'
    },
    crimson: {
      bg: '#0c0808', bgAlt: '#150f0f', surface: '#1a1313', surface2: '#221818', border: '#3a2626',
      ink: '#f7ecec', inkSoft: '#b08e8e', accent: '#e0333f', accentDark: '#b31f29', accentSoft: '#3a1418', accentInk: '#fdf4f4',
      indigo: '#7c8cff', indigoSoft: '#1c1f3a', sage: '#4fae6f', sageSoft: '#142a1c',
      rust: '#e0333f', rustSoft: '#3a1418', gold: '#f0b23e', goldSoft: '#332510'
    },
    signal: {
      bg: '#ffffff', bgAlt: '#f2f2f2', surface: '#ffffff', surface2: '#ececec', border: '#cfcfcf',
      ink: '#050505', inkSoft: '#4d4d4d', accent: '#e8590c', accentDark: '#b8430a', accentSoft: '#fde3d1', accentInk: '#fffbf6',
      indigo: '#364fc7', indigoSoft: '#dbe4fd', sage: '#2f9e44', sageSoft: '#d3f9d8',
      rust: '#e03131', rustSoft: '#ffe3e3', gold: '#f08c00', goldSoft: '#fff3bf'
    }
  };
  const GPAP_THEME_KEY = 'gpap_theme_v1';
  const GPAP_THEME_VARS = {
    bg: '--gpap-bg', bgAlt: '--gpap-bg-alt', surface: '--gpap-surface', surface2: '--gpap-surface-2',
    border: '--gpap-border', ink: '--gpap-ink', inkSoft: '--gpap-ink-soft', accent: '--gpap-accent',
    accentDark: '--gpap-accent-dark', accentSoft: '--gpap-accent-soft', accentInk: '--gpap-accent-ink', indigo: '--gpap-indigo',
    indigoSoft: '--gpap-indigo-soft', sage: '--gpap-sage', sageSoft: '--gpap-sage-soft',
    rust: '--gpap-rust', rustSoft: '--gpap-rust-soft', gold: '--gpap-gold', goldSoft: '--gpap-gold-soft'
  };
  function applyGpapTheme(themeId, targets) {
    const theme = GPAP_THEMES[themeId] || GPAP_THEMES.cream;
    targets.forEach((node) => {
      if (!node) return;
      Object.keys(GPAP_THEME_VARS).forEach((key) => node.style.setProperty(GPAP_THEME_VARS[key], theme[key]));
    });
  }
  function initGpapTheme(targets) {
    chrome.storage.local.get(GPAP_THEME_KEY).then((r) => applyGpapTheme(r[GPAP_THEME_KEY] || 'cream', targets));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[GPAP_THEME_KEY]) applyGpapTheme(changes[GPAP_THEME_KEY].newValue || 'cream', targets);
    });
  }

  // Lets the fab work on any rds3.northsouth.edu page: on the grade history
  // page itself, parse the live DOM directly (no extra request); elsewhere,
  // fetch that page's HTML in the background and parse it the same way.
  async function getGradeHistoryDoc() {
    if (location.pathname.startsWith(GRADE_HISTORY_PATH)) return document;
    try {
      const res = await fetch(`${location.origin}${GRADE_HISTORY_PATH}`, { credentials: 'same-origin' });
      const html = await res.text();
      return new DOMParser().parseFromString(html, 'text/html');
    } catch (e) {
      return null;
    }
  }

  function parseGradeTable(table) {
    const headers = [...table.rows[0].cells].map((c) => c.innerText.trim());
    const idx = (name) => headers.indexOf(name);
    const iName = idx('Semester Name'), iYear = idx('Semester Year'), iCode = idx('Course Code'),
      iCredit = idx('Course Credit'), iTitle = idx('Course Title'), iGrade = idx('Course Grade'),
      iCrCount = idx('Cr.Count');

    const semesters = [];
    let current = null;

    for (let r = 1; r < table.rows.length; r++) {
      const row = table.rows[r];
      if (row.className && row.className.includes('summary-row')) {
        if (current) {
          const text = row.innerText;
          const tgpaMatch = text.match(/TGPA\s*:\s*([\d.]+)/);
          const cgpaMatch = text.match(/CGPA\s*:\s*([\d.]+)/);
          current.officialTGPA = tgpaMatch ? parseFloat(tgpaMatch[1]) : null;
          current.officialCGPA = cgpaMatch ? parseFloat(cgpaMatch[1]) : null;
          current = null;
        }
        continue;
      }
      const cells = [...row.cells];
      const semName = iName >= 0 && cells[iName] ? cells[iName].innerText.trim() : '';
      const semYear = iYear >= 0 && cells[iYear] ? cells[iYear].innerText.trim() : '';
      if (semName || semYear) {
        current = { name: semName, year: semYear, label: `${semName} ${semYear}`.trim(), courses: [] };
        semesters.push(current);
      }
      if (!current) continue;
      current.courses.push({
        code: cells[iCode] ? cells[iCode].innerText.trim() : '',
        title: cells[iTitle] ? cells[iTitle].innerText.trim() : '',
        credit: parseFloat(cells[iCredit] ? cells[iCredit].innerText : '') || 0,
        grade: cells[iGrade] ? cells[iGrade].innerText.trim() : '',
        crCount: parseFloat(cells[iCrCount] ? cells[iCrCount].innerText : '') || 0
      });
    }
    return semesters;
  }

  // Groups every real+planned course attempt by course code and picks the
  // highest-grade-point attempt as the one that counts toward CGPA (retake handling).
  // Exclusions are keyed by course code, so excluding a course drops every
  // attempt of it (original + retakes, real + planned). Code-less rows fall
  // back to their own row key.
  function exclusionId(code, key) {
    return normCode(code) || key;
  }

  // Excluded courses are left out entirely: no credits, no grade points, and
  // no part in retake (best-attempt) selection.
  function computeProjection(semesters, overrides, planned, excluded) {
    excluded = excluded || {};
    const flat = [];
    semesters.forEach((sem, si) => {
      sem.courses.forEach((c, ci) => {
        const key = `r:${si}:${ci}`;
        if (excluded[exclusionId(c.code, key)]) return;
        const grade = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : c.grade;
        flat.push({ key, code: normCode(c.code), credit: c.crCount || c.credit, grade });
      });
    });
    planned.forEach((psem, pi) => {
      (psem.courses || []).forEach((pc, ci) => {
        const key = `p:${pi}:${ci}`;
        if (excluded[exclusionId(pc.code, key)]) return;
        flat.push({ key, code: normCode(pc.code), credit: parseFloat(pc.credit) || 0, grade: pc.grade });
      });
    });

    const groups = {};
    flat.forEach((e) => {
      if (!e.code) return;
      (groups[e.code] = groups[e.code] || []).push(e);
    });

    const primaryKeys = new Set();
    flat.forEach((e) => { if (!e.code) primaryKeys.add(e.key); });
    Object.values(groups).forEach((group) => {
      if (group.length === 1) { primaryKeys.add(group[0].key); return; }
      let best = null, bestPts = -Infinity;
      group.forEach((e) => {
        const pts = pointsFor(e.grade);
        if (pts !== null && pts > bestPts) { bestPts = pts; best = e; }
      });
      if (best) primaryKeys.add(best.key);
    });

    let runCredit = 0, runQP = 0;
    const timeline = [];
    const retakeInfo = {};

    semesters.forEach((sem, si) => {
      let semCredit = 0, semQP = 0;
      sem.courses.forEach((c, ci) => {
        const key = `r:${si}:${ci}`;
        const grade = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : c.grade;
        const code = normCode(c.code);
        const grp = groups[code];
        if (excluded[exclusionId(c.code, key)]) { retakeInfo[key] = { isRetake: false, isPrimary: false, excluded: true }; return; }
        const isPrimary = primaryKeys.has(key);
        retakeInfo[key] = { isRetake: !!(grp && grp.length > 1), isPrimary };
        const pts = pointsFor(grade);
        if (pts !== null && isPrimary) {
          const credit = c.crCount || c.credit;
          semCredit += credit;
          semQP += credit * pts;
        }
      });
      runCredit += semCredit;
      runQP += semQP;
      timeline.push({
        label: sem.label,
        tgpa: semCredit ? semQP / semCredit : null,
        cgpa: runCredit ? runQP / runCredit : null,
        projected: false
      });
    });

    planned.forEach((psem, pi) => {
      let semCredit = 0, semQP = 0;
      (psem.courses || []).forEach((pc, ci) => {
        const key = `p:${pi}:${ci}`;
        if (excluded[exclusionId(pc.code, key)]) { retakeInfo[key] = { isRetake: false, isPrimary: false, excluded: true }; return; }
        const code = normCode(pc.code);
        const grp = groups[code];
        const isPrimary = primaryKeys.has(key);
        retakeInfo[key] = { isRetake: !!(grp && grp.length > 1), isPrimary };
        const pts = pointsFor(pc.grade);
        const credit = parseFloat(pc.credit) || 0;
        if (pts !== null && isPrimary && credit > 0) {
          semCredit += credit;
          semQP += credit * pts;
        }
      });
      runCredit += semCredit;
      runQP += semQP;
      timeline.push({
        label: psem.label || 'Planned semester',
        tgpa: semCredit ? semQP / semCredit : null,
        cgpa: runCredit ? runQP / runCredit : null,
        projected: true
      });
    });

    return { timeline, finalCGPA: runCredit ? runQP / runCredit : null, finalCredit: runCredit, finalQP: runQP, retakeInfo };
  }

  const RETAKE_ELIGIBLE_MAX_POINTS = 3.3; // B+ and above cannot be retaken

  const COLOR_ACTUAL = '#5f6c85';
  const COLOR_WHATIF = '#c1953f';

  const GRADE_COLORS = {
    'A': '#74915f', 'A-': '#8fa87c',
    'B+': '#5f6c85', 'B': '#7c88a0', 'B-': '#a3aec2',
    'C+': '#c1953f', 'C': '#d0ab61', 'C-': '#dfc38c',
    'D+': '#c1774c', 'D': '#d0946f',
    'F': '#b0574b', 'W': '#8c8072', 'I': '#ab9f8f'
  };

  // `key` points into the theme-aware chart palette so bars follow the theme.
  const GPA_TIERS = [
    { min: 3.5, key: 'sage', fallback: '#74915f', label: 'Great (3.5+)', mood: 'Great' },
    { min: 3.0, key: 'actual', fallback: '#5f6c85', label: 'Good (3.0–3.49)', mood: 'Good' },
    { min: 2.5, key: 'whatif', fallback: '#c1953f', label: 'Fair (2.5–2.99)', mood: 'Fair' },
    { min: -Infinity, key: 'rust', fallback: '#b0574b', label: 'Needs work (<2.5)', mood: 'Needs work' }
  ];
  function tierFor(gpa) { return GPA_TIERS.find((t) => gpa >= t.min); }
  function tierColor(tier, pal) { return (pal && pal[tier.key]) || tier.fallback; }

  // Charts read colors from the panel's theme variables so they look right on
  // dark themes too, instead of hard-coded light-theme greys.
  function chartPalette(node) {
    const cs = getComputedStyle(node);
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    return {
      grid: v('--gpap-border', '#e7dbc7'),
      label: v('--gpap-ink-soft', '#8c8072'),
      ink: v('--gpap-ink', '#3d362f'),
      surface: v('--gpap-surface', '#fffbf6'),
      honor: v('--gpap-gold-soft', '#f5ead2'),
      actual: v('--gpap-indigo', COLOR_ACTUAL),
      whatif: v('--gpap-gold', COLOR_WHATIF),
      sage: v('--gpap-sage', '#74915f'),
      rust: v('--gpap-rust', '#b0574b')
    };
  }

  const CHART_FONT = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';
  function chartFont(size, weight) { return `${weight || 500} ${size}px ${CHART_FONT}`; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function prefersReducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // "Spring 2024" -> "Sp'24"; anything else (planned names) is trimmed.
  function shortSemLabel(label, i) {
    const m = /^\s*([A-Za-z]+)\s+(\d{4})\s*$/.exec(label || '');
    if (m) return `${m[1].slice(0, 2)}'${m[2].slice(2)}`;
    const s = (label || '').trim();
    return s ? s.slice(0, 5) : `P${i + 1}`;
  }

  function setupCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 360;
    const h = canvas.clientHeight || 160;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawEmptyMessage(ctx, w, h, text, pal) {
    ctx.fillStyle = pal.label;
    ctx.font = chartFont(12, 600);
    ctx.textAlign = 'center';
    ctx.fillText(text, w / 2, h / 2);
    ctx.textAlign = 'left';
  }

  function drawYGrid(ctx, pal, ticks, yFor, x0, x1, fmt) {
    ctx.strokeStyle = pal.grid;
    ctx.fillStyle = pal.label;
    ctx.font = chartFont(9);
    ctx.lineWidth = 1;
    ctx.textAlign = 'left';
    ticks.forEach((g) => {
      const y = Math.round(yFor(g)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.stroke();
      ctx.fillText(fmt(g), 2, y + 3);
    });
  }

  // Thins labels out when they would collide; always keeps the latest one.
  function drawXLabels(ctx, pal, labels, xFor, y, plotW, hover) {
    const n = labels.length;
    const step = Math.max(1, Math.ceil((n * 30) / Math.max(plotW, 1)));
    ctx.textAlign = 'center';
    labels.forEach((l, i) => {
      const isHover = hover === i;
      if (!isHover && (n - 1 - i) % step !== 0) return;
      ctx.font = chartFont(8.5, isHover ? 800 : 600);
      ctx.fillStyle = isHover ? pal.ink : pal.label;
      ctx.fillText(l, xFor(i), y);
    });
    ctx.textAlign = 'left';
  }

  function roundedTopRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h));
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function drawValuePill(ctx, pal, text, x, y, color) {
    ctx.font = chartFont(9.5, 800);
    const tw = ctx.measureText(text).width;
    const pw = tw + 10, ph = 15;
    const px = Math.max(2, x - pw / 2), py = y - ph - 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 7); else ctx.rect(px, py, pw, ph);
    ctx.fill();
    ctx.fillStyle = pal.surface;
    ctx.textAlign = 'center';
    ctx.fillText(text, px + pw / 2, py + 11);
    ctx.textAlign = 'left';
  }

  // Every draw function takes a progress `t` (0..1, for the draw-in animation)
  // and the hovered index, and returns hit regions used for tooltips.
  // Hit kinds: 'col' (vertical band around x) and 'arc' (donut slice).

  function drawTrendChart(canvas, d, t, hover) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pal = d.pal;
    const actual = d.actual;
    const edited = d.showEdited ? d.edited : [];
    const n = Math.max(actual.length, edited.length);
    const values = actual.concat(edited).filter((p) => p && p.cgpa !== null).map((p) => p.cgpa);
    if (!values.length) { drawEmptyMessage(ctx, w, h, 'No graded semesters yet', pal); return []; }

    const padL = 28, padR = 14, padT = 22, padB = 20;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const minY = Math.max(0, Math.min(2.0, Math.floor(Math.min(...values) * 2) / 2)), maxY = 4.0;
    const yFor = (v) => padT + plotH * (1 - (Math.max(minY, Math.min(maxY, v)) - minY) / (maxY - minY));
    const xFor = (i) => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));

    // Honors zone (3.50+) as a soft band behind everything.
    const bandTop = yFor(maxY), bandBot = yFor(3.5);
    ctx.fillStyle = pal.honor;
    ctx.fillRect(padL, bandTop, plotW, bandBot - bandTop);

    const ticks = [];
    for (let g = minY; g <= maxY + 1e-9; g += 0.5) ticks.push(g);
    drawYGrid(ctx, pal, ticks, yFor, padL, w - padR, (g) => g.toFixed(1));

    if (hover !== null && hover !== undefined) {
      ctx.strokeStyle = pal.label;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(xFor(hover) + 0.5, padT);
      ctx.lineTo(xFor(hover) + 0.5, padT + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Reveal left-to-right while animating.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, padL + (plotW + padR) * t, h);
    ctx.clip();

    function series(points, color, fill) {
      const pts = points.map((p, i) => (p && p.cgpa !== null ? { x: xFor(i), y: yFor(p.cgpa), p, i } : null));
      const real = pts.filter(Boolean);
      if (fill && real.length > 1) {
        ctx.beginPath();
        ctx.moveTo(real[0].x, padT + plotH);
        real.forEach((q) => ctx.lineTo(q.x, q.y));
        ctx.lineTo(real[real.length - 1].x, padT + plotH);
        ctx.closePath();
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.strokeStyle = color;
      for (let i = 1; i < pts.length; i++) {
        if (!pts[i] || !pts[i - 1]) continue;
        ctx.setLineDash(pts[i].p.projected ? [5, 4] : []);
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      real.forEach((q, k) => {
        const isLast = k === real.length - 1;
        const r = q.i === hover ? 5 : isLast ? 4.5 : 3;
        ctx.beginPath();
        ctx.arc(q.x, q.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isLast || q.i === hover ? color : pal.surface;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.stroke();
      });
      return real;
    }

    const actualPts = series(actual, pal.actual, true);
    const editedPts = edited.length ? series(edited, pal.whatif, false) : [];
    ctx.restore();

    // Value pill on the latest point of each line, once the line has arrived.
    if (t >= 1) {
      const lastA = actualPts[actualPts.length - 1];
      const lastE = editedPts[editedPts.length - 1];
      if (lastE && (!lastA || Math.abs(lastE.p.cgpa - lastA.p.cgpa) > 0.004 || lastE.i !== lastA.i)) {
        drawValuePill(ctx, pal, lastE.p.cgpa.toFixed(2), lastE.x, lastE.y, pal.whatif);
        if (lastA && Math.abs(lastE.y - lastA.y) > 20) drawValuePill(ctx, pal, lastA.p.cgpa.toFixed(2), lastA.x, lastA.y, pal.actual);
      } else if (lastA) {
        drawValuePill(ctx, pal, lastA.p.cgpa.toFixed(2), lastA.x, lastA.y, pal.actual);
      }
    }

    const labels = [];
    for (let i = 0; i < n; i++) labels.push(shortSemLabel((actual[i] || edited[i] || {}).label, i - actual.length));
    drawXLabels(ctx, pal, labels, xFor, h - 5, plotW, hover);

    const hits = [];
    const half = n === 1 ? plotW / 2 : plotW / (n - 1) / 2;
    let prevA = null;
    for (let i = 0; i < n; i++) {
      const a = actual[i], e = edited[i];
      const lines = [];
      const label = (a || e || {}).label || `Planned ${i - actual.length + 1}`;
      let anchorY = padT + plotH;
      if (a && a.cgpa !== null) {
        let delta = '';
        if (prevA !== null) {
          const dv = a.cgpa - prevA;
          delta = Math.abs(dv) < 0.005 ? '  · steady' : dv > 0 ? `  ▲ ${dv.toFixed(2)}` : `  ▼ ${Math.abs(dv).toFixed(2)}`;
        }
        lines.push(`CGPA ${a.cgpa.toFixed(2)}${delta}`);
        anchorY = Math.min(anchorY, yFor(a.cgpa));
        prevA = a.cgpa;
      }
      if (e && e.cgpa !== null && (!a || a.cgpa === null || Math.abs(e.cgpa - a.cgpa) > 0.004)) {
        lines.push(`${e.projected ? 'Planned' : 'What-if'} CGPA ${e.cgpa.toFixed(2)}`);
        anchorY = Math.min(anchorY, yFor(e.cgpa));
      }
      const tg = (e && d.showEdited ? e : a) || {};
      if (tg.tgpa !== null && tg.tgpa !== undefined) lines.push(`Semester GPA ${tg.tgpa.toFixed(2)}`);
      hits.push({ kind: 'col', x: xFor(i), half, anchorY, title: label, lines, skip: !lines.length });
    }
    return hits;
  }

  function drawDonutChart(canvas, d, t, hover) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pal = d.pal;
    const dist = d.dist;
    const total = dist.reduce((s, x) => s + x.count, 0);
    if (!total) { drawEmptyMessage(ctx, w, h, 'No graded courses yet', pal); return []; }

    const cx = w / 2, cy = h / 2, rOut = Math.min(w / 2, h / 2) - 8, rIn = rOut * 0.62;
    const sweep = t * Math.PI * 2;
    const hits = [];
    let acc = 0;
    dist.forEach((s, i) => {
      const f0 = acc / total, f1 = (acc + s.count) / total;
      acc += s.count;
      hits.push({ kind: 'arc', cx, cy, r0: rIn, r1: rOut + 6, f0, f1, title: s.grade, lines: [], skip: false });
      const a0 = -Math.PI / 2 + f0 * Math.PI * 2;
      const a1 = -Math.PI / 2 + Math.min(f1 * Math.PI * 2, sweep);
      if (a1 <= a0) return;
      const pop = hover === i ? 5 : 0;
      const mid = (a0 + a1) / 2;
      const ox = Math.cos(mid) * pop, oy = Math.sin(mid) * pop;
      ctx.beginPath();
      ctx.arc(cx + ox, cy + oy, rOut + (hover === i ? 2 : 0), a0, a1);
      ctx.arc(cx + ox, cy + oy, rIn, a1, a0, true);
      ctx.closePath();
      ctx.globalAlpha = hover === null || hover === undefined || hover === i ? 1 : 0.45;
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.surface;
      ctx.stroke();
    });

    // Center label: total courses, or the hovered grade's share.
    ctx.textAlign = 'center';
    if (hover !== null && hover !== undefined && dist[hover]) {
      const s = dist[hover];
      ctx.fillStyle = pal.ink;
      ctx.font = chartFont(20, 800);
      ctx.fillText(s.grade, cx, cy + 2);
      ctx.fillStyle = pal.label;
      ctx.font = chartFont(9.5, 600);
      ctx.fillText(`${s.count} course${s.count === 1 ? '' : 's'} · ${Math.round((s.count / total) * 100)}%`, cx, cy + 16);
    } else {
      ctx.fillStyle = pal.ink;
      ctx.font = chartFont(20, 800);
      ctx.fillText(String(total), cx, cy + 2);
      ctx.fillStyle = pal.label;
      ctx.font = chartFont(9.5, 600);
      ctx.fillText('courses', cx, cy + 16);
    }
    ctx.textAlign = 'left';
    return hits;
  }

  function drawBarChart(canvas, d, t, hover, opts) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pal = d.pal;
    const bars = d.bars;
    if (!bars.length || !bars.some((b) => b.value !== null && b.value > 0)) {
      drawEmptyMessage(ctx, w, h, opts.empty, pal);
      return [];
    }

    const padL = 26, padR = 10, padT = 24, padB = 20;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const maxY = opts.maxY(bars);
    const yFor = (v) => padT + plotH * (1 - Math.max(0, Math.min(maxY, v)) / maxY);
    drawYGrid(ctx, pal, opts.ticks(maxY), yFor, padL, w - padR, opts.tickFmt);

    const n = bars.length;
    const gap = n > 12 ? 3 : 6;
    const barW = Math.max(3, (plotW - gap * (n - 1)) / n);
    const xCenter = (i) => padL + i * (barW + gap) + barW / 2;
    const bottom = padT + plotH;

    // Reference line (e.g. overall CGPA) behind the bars.
    if (opts.refLine !== null && opts.refLine !== undefined) {
      const y = Math.round(yFor(opts.refLine.value)) + 0.5;
      ctx.strokeStyle = opts.refLine.color;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const best = opts.bestIndex ? opts.bestIndex(bars) : -1;
    const showValues = barW >= 16;
    const hits = [];
    bars.forEach((b, i) => {
      const x = xCenter(i) - barW / 2;
      const hit = { kind: 'col', x: xCenter(i), half: (barW + gap) / 2, anchorY: bottom, title: b.label, lines: opts.tip(b, i), skip: b.value === null };
      hits.push(hit);
      if (b.value === null) return;
      // Stagger bars slightly so they pop up one after another.
      const local = Math.max(0, Math.min(1, t * 1.4 - (i / Math.max(n, 1)) * 0.4));
      const top = yFor(b.value);
      const bh = (bottom - top) * easeOutCubic(local);
      hit.anchorY = top;
      ctx.globalAlpha = (b.projected ? 0.55 : 1) * (hover === null || hover === undefined || hover === i ? 1 : 0.45);
      ctx.fillStyle = opts.color(b);
      roundedTopRect(ctx, x, bottom - bh, barW, bh, Math.min(5, barW / 2));
      ctx.fill();
      ctx.globalAlpha = 1;
      if (t >= 1 && (showValues || hover === i)) {
        ctx.font = chartFont(8.5, 800);
        ctx.fillStyle = pal.ink;
        ctx.textAlign = 'center';
        ctx.fillText(opts.valueFmt(b.value), xCenter(i), top - 4);
        ctx.textAlign = 'left';
      }
      if (t >= 1 && i === best) {
        drawStar(ctx, xCenter(i), top - (showValues ? 19 : 8), 5, pal.whatif);
      }
    });

    drawXLabels(ctx, pal, bars.map((b, i) => shortSemLabel(b.label, i)), xCenter, h - 5, plotW, hover);
    return hits;
  }

  function drawSemesterBarChart(canvas, d, t, hover) {
    const pal = d.pal;
    return drawBarChart(canvas, d, t, hover, {
      empty: 'No graded semesters yet',
      maxY: () => 4.0,
      ticks: () => [0, 1, 2, 3, 4],
      tickFmt: (g) => g.toFixed(1),
      color: (b) => tierColor(tierFor(b.value), pal),
      valueFmt: (v) => v.toFixed(2),
      refLine: d.cgpa !== null ? { value: d.cgpa, color: pal.label } : null,
      bestIndex: (bars) => {
        let best = -1;
        bars.forEach((b, i) => { if (!b.projected && b.value !== null && (best < 0 || b.value > bars[best].value)) best = i; });
        return bars.filter((b) => !b.projected && b.value !== null).length > 1 ? best : -1;
      },
      tip: (b) => {
        if (b.value === null) return [];
        const lines = [`Semester GPA ${b.value.toFixed(2)} · ${tierFor(b.value).mood}`, `${b.credit.toFixed(1)} credits`];
        if (b.projected) lines.push('Planned semester');
        return lines;
      }
    });
  }

  function drawCreditBarChart(canvas, d, t, hover) {
    const pal = d.pal;
    let running = 0;
    const totals = d.bars.map((b) => (running += b.value || 0));
    return drawBarChart(canvas, d, t, hover, {
      empty: 'No semesters yet',
      maxY: (bars) => Math.max(4, Math.ceil(Math.max(...bars.map((b) => b.value || 0)) / 3) * 3),
      ticks: (maxY) => {
        const step = Math.max(1, Math.ceil(maxY / 4));
        const out = [];
        for (let g = 0; g <= maxY; g += step) out.push(g);
        return out;
      },
      tickFmt: (g) => String(g),
      color: (b) => (b.projected ? pal.whatif : pal.actual),
      valueFmt: (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
      refLine: null,
      bestIndex: null,
      tip: (b, i) => [`${b.value.toFixed(1)} credits${b.projected ? ' (planned)' : ''}`, `Running total ${totals[i].toFixed(1)}`]
    });
  }

  function chartHitTest(hit, mx, my) {
    if (hit.skip) return false;
    if (hit.kind === 'col') return Math.abs(mx - hit.x) <= hit.half;
    if (hit.kind === 'arc') {
      const dx = mx - hit.cx, dy = my - hit.cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r < hit.r0 || r > hit.r1) return false;
      const f = ((Math.atan2(dy, dx) + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
      return f >= hit.f0 && f < hit.f1;
    }
    return false;
  }

  // Small line-icon set (24x24, stroke-based) used instead of emoji so the
  // UI looks the same on every OS. Strings are <path d>, objects are circles.
  const ICONS = {
    sparkles: ['M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z', 'M19 3v4', 'M17 5h4'],
    equal: ['M5 9h14', 'M5 15h14'],
    alert: ['M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h16.9a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4', 'M12 17h.01'],
    flame: ['M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1.2 1.3 2.3 2.5 2.8z'],
    trendUp: ['M22 7l-8.5 8.5-5-5L2 17', 'M16 7h6v6'],
    trendDown: ['M22 17l-8.5-8.5-5 5L2 7', 'M16 17h6v-6'],
    steady: ['M3 12h18', 'M17 8l4 4-4 4'],
    trophy: ['M6 9H4.5a2.5 2.5 0 0 1 0-5H6', 'M18 9h1.5a2.5 2.5 0 0 0 0-5H18', 'M4 22h16', 'M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22', 'M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8', 'M18 2H6v7a6 6 0 0 0 12 0V2z'],
    target: [{ cx: 12, cy: 12, r: 10 }, { cx: 12, cy: 12, r: 6 }, { cx: 12, cy: 12, r: 2 }],
    star: ['M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1z'],
    sprout: ['M7 20h10', 'M10 20c5.5-2.5.8-6.4 3-10', 'M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z', 'M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z'],
    award: [{ cx: 12, cy: 8, r: 6 }, 'M15.5 12.9L17 22l-5-3-5 3 1.5-9.1'],
    cap: ['M22 10L12 5 2 10l10 5 10-5z', 'M6 12v5c3 3 9 3 12 0v-5', 'M22 10v6'],
    chart: ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
    book: ['M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z', 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'],
    gauge: ['M12 14l4-4', 'M3.3 19a10 10 0 1 1 17.4 0']
  };

  function icon(name, cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', cls || 'gpap-icon');
    (ICONS[name] || []).forEach((part) => {
      const node = document.createElementNS(ns, typeof part === 'string' ? 'path' : 'circle');
      if (typeof part === 'string') node.setAttribute('d', part);
      else Object.keys(part).forEach((k) => node.setAttribute(k, part[k]));
      svg.appendChild(node);
    });
    return svg;
  }

  // Five-point star drawn on a canvas (the "best semester" marker).
  function drawStar(ctx, cx, cy, r, fill) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.48;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
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

  function retakeBadge(info) {
    if (!info || !info.isRetake) return null;
    return info.isPrimary
      ? el('span', { class: 'gpap-retake-badge gpap-retake-counted', text: 'Best attempt' })
      : el('span', { class: 'gpap-retake-badge gpap-retake-excluded', text: 'Excluded (retake)' });
  }

  async function main() {
    function semesterCredit(sem, si, proj, overrides) {
      let credit = 0;
      sem.courses.forEach((c, ci) => {
        const key = `r:${si}:${ci}`;
        const info = proj.retakeInfo[key];
        const grade = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : c.grade;
        if (pointsFor(grade) !== null && info && info.isPrimary) credit += (c.crCount || c.credit);
      });
      return credit;
    }

    function plannedCredit(psem, pi, proj) {
      let credit = 0;
      (psem.courses || []).forEach((pc, ci) => {
        const info = proj.retakeInfo[`p:${pi}:${ci}`];
        if (pointsFor(pc.grade) !== null && info && info.isPrimary) credit += (parseFloat(pc.credit) || 0);
      });
      return credit;
    }

    function computeGradeDistribution(semesters, planned, proj, overrides) {
      const counts = {};
      semesters.forEach((sem, si) => {
        sem.courses.forEach((c, ci) => {
          const key = `r:${si}:${ci}`;
          const info = proj.retakeInfo[key];
          if (!info || !info.isPrimary) return;
          const grade = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : c.grade;
          const g = (grade || '').trim().toUpperCase();
          if (!g) return;
          counts[g] = (counts[g] || 0) + 1;
        });
      });
      planned.forEach((psem, pi) => {
        (psem.courses || []).forEach((pc, ci) => {
          const key = `p:${pi}:${ci}`;
          const info = proj.retakeInfo[key];
          if (!info || !info.isPrimary) return;
          const g = (pc.grade || '').trim().toUpperCase();
          if (!g) return;
          counts[g] = (counts[g] || 0) + 1;
        });
      });
      return Object.keys(counts)
        .map((g) => ({ grade: g, count: counts[g], color: GRADE_COLORS[g] || '#8c8072' }))
        .sort((a, b) => GRADE_OPTIONS.indexOf(a.grade) - GRADE_OPTIONS.indexOf(b.grade));
    }

    const gradeDoc = await getGradeHistoryDoc();
    if (!gradeDoc) return;

    const gradeTable = findTableByHeaders(['Semester Name', 'Course Grade', 'Cr.Count'], gradeDoc);
    if (!gradeTable) return;

    const semesters = parseGradeTable(gradeTable);
    if (!semesters.length) return;

    track('page_view', { semester_count: semesters.length });

    const bodyText = gradeDoc.body.innerText;
    const idMatch = bodyText.match(/Grade History of\s+(\S+)/);
    const studentId = idMatch ? idMatch[1] : 'default';
    const storageKey = `gpap_${studentId}`;

    let state = { overrides: {}, excluded: {}, planned: [], chartCollapsed: false };
    try {
      const stored = await chrome.storage.local.get([storageKey]);
      if (stored[storageKey]) state = Object.assign(state, stored[storageKey]);
    } catch (e) { /* storage unavailable, continue with defaults */ }
    if (!state.excluded || typeof state.excluded !== 'object') state.excluded = {};
    // Older saves keyed exclusions by row; convert those to course codes.
    Object.keys(state.excluded).forEach((k) => {
      const m = /^r:(\d+):(\d+)$/.exec(k);
      if (!m) return;
      const c = semesters[+m[1]] && semesters[+m[1]].courses[+m[2]];
      delete state.excluded[k];
      if (c) state.excluded[exclusionId(c.code, k)] = true;
    });

    let saveTimer = null;
    function persist() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        chrome.storage.local.set({ [storageKey]: state }).catch(() => {});
      }, 250);
    }

    const actualProjection = computeProjection(semesters, {}, []);
    const actualCGPA = actualProjection.finalCGPA;

    // Motivational "potential" curve for the new-tab dashboard: every
    // retake-eligible course (below B+) assumed retaken with an A.
    const potentialOverrides = {};
    semesters.forEach((sem, si) => {
      sem.courses.forEach((c, ci) => {
        const pts = pointsFor(c.grade);
        if (pts !== null && pts < RETAKE_ELIGIBLE_MAX_POINTS) potentialOverrides[`r:${si}:${ci}`] = 'A';
      });
    });
    const potentialProjection = computeProjection(semesters, potentialOverrides, []);

    cacheGradesForNewTab({
      studentId,
      cgpa: actualCGPA,
      credits: actualProjection.finalCredit,
      honor: (honorFor(actualCGPA) || {}).name || null,
      timeline: actualProjection.timeline.map((t) => ({ label: t.label, cgpa: t.cgpa })),
      potentialTimeline: potentialProjection.timeline.map((t) => ({ label: t.label, cgpa: t.cgpa })),
      updatedAt: Date.now()
    });

    const fab = el('div', { id: 'gpap-fab', title: 'What if CGPA for NSUers' }, [
      (() => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M4 19V10M10 19V5M16 19V13M22 19V8');
        path.setAttribute('stroke', '#ffffff');
        path.setAttribute('stroke-width', '2.4');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
        return svg;
      })(),
      el('span', { class: 'gpap-fab-label', text: 'Analyze CGPA' })
    ]);

    const panel = el('div', { id: 'gpap-panel' });
    const header = el('div', { class: 'gpap-header' }, [
      el('h1', { text: 'What if CGPA for NSUers' }),
      el('button', { class: 'gpap-close', text: '×' })
    ]);
    header.querySelector('.gpap-close').addEventListener('click', () => panel.classList.remove('gpap-open'));

    // ---- Hero: always-visible stats + trend chart ----
    const hero = el('div', { class: 'gpap-hero' });
    const heroStats = el('div', { class: 'gpap-hero-stats' });
    const pillCurrent = el('div', { class: 'gpap-stat-pill' }, [
      el('span', { class: 'gpap-stat-label', text: 'Current' }),
      el('span', { class: 'gpap-stat-value' }),
      el('span', { class: 'gpap-stat-honor' })
    ]);
    const pillProjected = el('div', { class: 'gpap-stat-pill' }, [
      el('span', { class: 'gpap-stat-label', text: 'Projected' }),
      el('span', { class: 'gpap-stat-value' }),
      el('span', { class: 'gpap-stat-delta' }),
      el('span', { class: 'gpap-stat-honor' })
    ]);
    const pillCredits = el('div', { class: 'gpap-stat-pill' }, [
      el('span', { class: 'gpap-stat-label', text: 'Credits' }),
      el('span', { class: 'gpap-stat-value' })
    ]);
    heroStats.appendChild(pillCurrent); heroStats.appendChild(pillProjected); heroStats.appendChild(pillCredits);

    const chartBox = el('div', { class: 'gpap-hero-chart-box' });
    const chartTitleLabel = el('span', { text: 'CGPA trend' });
    const legendBox = el('span', { class: 'gpap-legend' });
    const chartToggleChevron = el('span', { class: 'gpap-chevron gpap-chart-toggle-chevron' }, [
      (() => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M6 9l6 6 6-6');
        path.setAttribute('stroke', '#8c8072');
        path.setAttribute('stroke-width', '2.4');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
        return svg;
      })()
    ]);
    const chartTitleRow = el('div', { class: 'gpap-hero-chart-title gpap-chart-toggle-row', title: 'Collapse or expand the chart' }, [chartTitleLabel, chartToggleChevron]);
    chartBox.appendChild(chartTitleRow);

    const chartContent = el('div', { class: 'gpap-chart-content' });

    let chartType = 'trend';
    const CHART_TYPES = [
      { id: 'trend', label: 'Trend' },
      { id: 'pie', label: 'Grades' },
      { id: 'semester', label: 'Sem GPA' },
      { id: 'credits', label: 'Credits' }
    ];
    const chartSwitcher = el('div', { class: 'gpap-chart-switcher' });
    const chartTypeButtons = {};
    CHART_TYPES.forEach((ct) => {
      const btn = el('button', { class: 'gpap-chart-type-btn' + (ct.id === chartType ? ' gpap-active' : ''), text: ct.label });
      btn.addEventListener('click', () => {
        chartType = ct.id;
        Object.values(chartTypeButtons).forEach((b) => b.classList.remove('gpap-active'));
        btn.classList.add('gpap-active');
        track('switch_chart', { chart_type: ct.id });
        renderStatsAndChart(true);
      });
      chartTypeButtons[ct.id] = btn;
      chartSwitcher.appendChild(btn);
    });
    chartContent.appendChild(chartSwitcher);

    const canvas = document.createElement('canvas');
    canvas.id = 'gpap-chart';
    chartContent.appendChild(canvas);
    const chartTip = el('div', { class: 'gpap-chart-tip', role: 'tooltip' });
    chartContent.appendChild(chartTip);
    const insightBox = el('div', { class: 'gpap-chart-insight' });
    chartContent.appendChild(insightBox);
    chartContent.appendChild(legendBox);
    chartBox.appendChild(chartContent);
    hero.appendChild(heroStats);
    hero.appendChild(chartBox);

    function setChartCollapsed(collapsed) {
      state.chartCollapsed = collapsed;
      chartBox.classList.toggle('gpap-chart-collapsed', collapsed);
    }
    chartTitleRow.addEventListener('click', () => {
      const collapsed = !state.chartCollapsed;
      setChartCollapsed(collapsed);
      persist();
      track('toggle_chart', { collapsed });
      if (!collapsed) requestAnimationFrame(() => renderChart(lastProj, true));
    });
    setChartCollapsed(!!state.chartCollapsed);

    const tabs = el('div', { class: 'gpap-tabs' });
    const tabSem = el('div', { class: 'gpap-tab gpap-active', text: 'Semesters' });
    const tabEdit = el('div', { class: 'gpap-tab', text: 'Edit Grades' });
    const tabPlan = el('div', { class: 'gpap-tab', text: 'Plan Ahead' });
    const tabTarget = el('div', { class: 'gpap-tab', text: 'Target CGPA' });
    tabs.appendChild(tabSem); tabs.appendChild(tabEdit); tabs.appendChild(tabPlan); tabs.appendChild(tabTarget);

    const body = el('div', { class: 'gpap-body' });
    const viewSem = el('div', { class: 'gpap-view gpap-active' });
    const viewEdit = el('div', { class: 'gpap-view' });
    const viewPlan = el('div', { class: 'gpap-view' });
    const viewTarget = el('div', { class: 'gpap-view' });
    body.appendChild(viewSem); body.appendChild(viewEdit); body.appendChild(viewPlan); body.appendChild(viewTarget);

    function switchTab(tab) {
      [tabSem, tabEdit, tabPlan, tabTarget].forEach((t) => t.classList.remove('gpap-active'));
      [viewSem, viewEdit, viewPlan, viewTarget].forEach((v) => v.classList.remove('gpap-active'));
      tab.view.classList.add('gpap-active');
      tab.classList.add('gpap-active');
    }
    tabSem.view = viewSem; tabEdit.view = viewEdit; tabPlan.view = viewPlan; tabTarget.view = viewTarget;
    tabSem.addEventListener('click', () => { switchTab(tabSem); track('view_tab', { tab_name: 'semesters' }); });
    tabEdit.addEventListener('click', () => { switchTab(tabEdit); track('view_tab', { tab_name: 'edit_grades' }); });
    tabPlan.addEventListener('click', () => { switchTab(tabPlan); track('view_tab', { tab_name: 'plan_ahead' }); });
    tabTarget.addEventListener('click', () => { switchTab(tabTarget); track('view_tab', { tab_name: 'target_cgpa' }); renderTarget(); });

    const footer = el('div', { class: 'gpap-footer-actions' });
    const resetBtn = el('button', { class: 'gpap-btn gpap-btn-secondary gpap-btn-small', text: 'Reset all what-ifs' });
    resetBtn.addEventListener('click', () => {
      state.overrides = {};
      state.excluded = {};
      state.planned = [];
      persist();
      renderAll();
      track('reset_whatifs');
    });
    footer.appendChild(resetBtn);

    const communityLink = el('a', { href: 'https://t.me/nsu_advising_helper_bot_channel', target: '_blank', rel: 'noopener noreferrer', class: 'gpap-pill-link', text: 'Join Community' });
    communityLink.addEventListener('click', () => track('click_community_link'));
    const nsumateLink = el('a', { href: 'https://nsumate.com/', target: '_blank', rel: 'noopener noreferrer', class: 'gpap-pill-link', text: 'Visit NSUmate' });
    nsumateLink.addEventListener('click', () => track('click_nsumate_link'));
    const linksRow = el('div', { class: 'gpap-links-row' }, [communityLink, nsumateLink]);

    const creditLink = el('a', { href: 'https://www.facebook.com/tahshanjamil.shadhin', target: '_blank', rel: 'noopener noreferrer', text: 'Tahshan Jamil Shadhin' });
    const credit = el('div', { class: 'gpap-credit' }, [
      document.createTextNode('Made for NSUers by '),
      creditLink
    ]);

    panel.appendChild(header);
    panel.appendChild(hero);
    panel.appendChild(tabs);
    panel.appendChild(body);
    panel.appendChild(footer);
    panel.appendChild(linksRow);
    panel.appendChild(credit);

    fab.addEventListener('click', () => {
      panel.classList.add('gpap-open');
      renderStatsAndChart(true);
      track('open_panel');
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    initGpapTheme([fab, panel]);

    let lastProj = null;
    let targetValue = null;
    const openSemesters = new Set([semesters.length - 1]);

    function rerenderKeepingScroll(renderFn) {
      const pos = body.scrollTop;
      renderFn();
      body.scrollTop = pos;
    }

    function renderStats() {
      const proj = computeProjection(semesters, state.overrides, state.planned, state.excluded);
      lastProj = proj;

      pillCurrent.querySelector('.gpap-stat-value').textContent = actualCGPA !== null ? actualCGPA.toFixed(2) : '—';

      const delta = proj.finalCGPA !== null && actualCGPA !== null ? proj.finalCGPA - actualCGPA : 0;
      const deltaClass = delta > 0.001 ? 'gpap-delta-pos' : delta < -0.001 ? 'gpap-delta-neg' : 'gpap-delta-zero';
      pillProjected.querySelector('.gpap-stat-value').textContent = proj.finalCGPA !== null ? proj.finalCGPA.toFixed(2) : '—';
      const deltaEl = pillProjected.querySelector('.gpap-stat-delta');
      deltaEl.textContent = proj.finalCGPA !== null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '';
      deltaEl.className = `gpap-stat-delta ${deltaClass}`;

      pillCredits.querySelector('.gpap-stat-value').textContent = proj.finalCredit.toFixed(1);

      const currentHonorEl = pillCurrent.querySelector('.gpap-stat-honor');
      const currentHonor = honorFor(actualCGPA);
      currentHonorEl.textContent = currentHonor ? currentHonor.name : '';
      currentHonorEl.className = `gpap-stat-honor ${currentHonor ? currentHonor.cls : ''}`;

      const projectedHonorEl = pillProjected.querySelector('.gpap-stat-honor');
      const projectedHonor = honorFor(proj.finalCGPA);
      projectedHonorEl.textContent = projectedHonor ? projectedHonor.name : '';
      projectedHonorEl.className = `gpap-stat-honor ${projectedHonor ? projectedHonor.cls : ''}`;

      // Playful feedback: the projected number bounces when it changes, and
      // reaching a higher honor tier through a what-if earns a confetti pop.
      const projectedText = pillProjected.querySelector('.gpap-stat-value').textContent;
      if (lastProjectedText !== null && projectedText !== lastProjectedText) bump(pillProjected.querySelector('.gpap-stat-value'));
      lastProjectedText = projectedText;
      const rank = projectedHonor ? HONOR_TIERS.length - HONOR_TIERS.indexOf(projectedHonor) : 0;
      if (lastHonorRank !== null && rank > lastHonorRank && panel.classList.contains('gpap-open')) {
        celebrate(pillProjected, `${projectedHonor.name} unlocked!`);
        track('honor_unlocked', { honor: projectedHonor.name });
      }
      lastHonorRank = rank;

      return proj;
    }

    const CHART_TITLES = {
      trend: 'CGPA trend', pie: 'Grade distribution', semester: 'Semester GPA', credits: 'Credits per semester'
    };

    let lastProjectedText = null;
    let lastHonorRank = null;

    function bump(node) {
      if (prefersReducedMotion()) return;
      node.classList.remove('gpap-bump');
      void node.offsetWidth; // restart the animation
      node.classList.add('gpap-bump');
    }

    function celebrate(anchor, message) {
      if (prefersReducedMotion()) return;
      const pr = panel.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      const host = el('div', { class: 'gpap-confetti' });
      host.style.left = `${ar.left - pr.left + ar.width / 2}px`;
      host.style.top = `${ar.top - pr.top + ar.height / 2}px`;
      const colors = ['--gpap-gold', '--gpap-sage', '--gpap-accent', '--gpap-indigo', '--gpap-rust'];
      for (let i = 0; i < 24; i++) {
        const angle = (Math.PI * 2 * i) / 24 + Math.random() * 0.4;
        const dist = 40 + Math.random() * 45;
        const bit = el('i');
        bit.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
        bit.style.setProperty('--dy', `${Math.sin(angle) * dist - 20}px`);
        bit.style.setProperty('--rot', `${Math.round(Math.random() * 540 - 270)}deg`);
        bit.style.setProperty('--d', `${Math.random() * 0.12}s`);
        bit.style.background = `var(${colors[i % colors.length]})`;
        host.appendChild(bit);
      }
      host.appendChild(el('span', {}, [icon('cap', 'gpap-icon gpap-toast-icon'), document.createTextNode(message)]));
      panel.appendChild(host);
      setTimeout(() => host.remove(), 1900);
    }

    function hasEdits() {
      return Object.keys(state.overrides).length > 0 || Object.keys(state.excluded).length > 0 || state.planned.length > 0;
    }

    // Credits of straight-A coursework needed to lift (qp, credit) to `target`.
    function creditsOfAToReach(target, qp, credit) {
      if (credit && qp / credit >= target - 1e-9) return 0;
      return Math.max(0, (target * credit - qp) / (4 - target));
    }

    // One or two short, friendly, data-backed lines under the chart.
    function chartInsights(proj) {
      const lines = [];
      if (chartType === 'trend') {
        if (hasEdits() && proj.finalCGPA !== null && actualCGPA !== null) {
          const dv = proj.finalCGPA - actualCGPA;
          lines.push(Math.abs(dv) < 0.005
            ? { icon: 'equal', text: 'Your what-ifs keep CGPA right where it is' }
            : dv > 0 ? { icon: 'sparkles', tone: 'pos', text: `Your what-ifs lift CGPA to ${proj.finalCGPA.toFixed(2)} (+${dv.toFixed(2)})` }
              : { icon: 'alert', tone: 'neg', text: `Your what-ifs drop CGPA to ${proj.finalCGPA.toFixed(2)} (${dv.toFixed(2)})` });
        } else {
          const pts = actualProjection.timeline.filter((p) => p.cgpa !== null);
          let streak = 0;
          for (let i = pts.length - 1; i > 0 && pts[i].cgpa > pts[i - 1].cgpa + 1e-9; i--) streak++;
          if (streak >= 2) lines.push({ icon: 'flame', tone: 'pos', text: `CGPA has climbed ${streak} semesters in a row!` });
          else if (pts.length >= 2) {
            const dv = pts[pts.length - 1].cgpa - pts[pts.length - 2].cgpa;
            lines.push(dv > 0.005 ? { icon: 'trendUp', tone: 'pos', text: `Up ${dv.toFixed(2)} since last semester, keep it rolling!` }
              : dv < -0.005 ? { icon: 'trendDown', tone: 'neg', text: `Dipped ${Math.abs(dv).toFixed(2)} last semester, one strong term turns it around` }
                : { icon: 'steady', text: 'Holding steady since last semester' });
          }
        }
        if (proj.finalCGPA !== null && proj.finalCredit) {
          const goal = HONOR_TIERS.filter((t) => proj.finalCGPA < t.min).sort((x, y) => x.min - y.min)[0];
          if (!goal) {
            lines.push({ icon: 'trophy', tone: 'goal', text: 'Summa Cum Laude territory. Legendary!' });
          } else {
            let target = goal.min, name = goal.name;
            let need = creditsOfAToReach(target, proj.finalQP, proj.finalCredit);
            if (need > 45) {
              // Honors is far off: show the next quarter-point milestone instead.
              target = (Math.floor(proj.finalCGPA * 4 + 1e-9) + 1) / 4;
              name = null;
              need = creditsOfAToReach(target, proj.finalQP, proj.finalCredit);
            }
            const cr = Math.max(1, Math.ceil(need));
            lines.push({
              icon: 'target',
              tone: 'goal',
              text: name
                ? `About ${cr} credits of A's to reach ${name} (${target.toFixed(2)})`
                : `About ${cr} credits of A's lifts you to ${target.toFixed(2)}`
            });
          }
        }
      } else if (chartType === 'pie') {
        const dist = computeGradeDistribution(semesters, state.planned, proj, state.overrides);
        const total = dist.reduce((s, x) => s + x.count, 0);
        if (total) {
          const aCount = dist.filter((x) => x.grade === 'A' || x.grade === 'A-').reduce((s, x) => s + x.count, 0);
          const pct = Math.round((aCount / total) * 100);
          lines.push(aCount
            ? { icon: 'star', tone: 'goal', text: `${pct}% of your grades are A or A-` }
            : { icon: 'sprout', tone: 'pos', text: 'Your first A is waiting to happen' });
          const top = dist.slice().sort((x, y) => y.count - x.count)[0];
          lines.push({ icon: 'award', text: `Signature grade: ${top.grade} (${top.count} time${top.count === 1 ? '' : 's'})` });
        }
      } else if (chartType === 'semester') {
        const real = proj.timeline.filter((p) => !p.projected && p.tgpa !== null);
        if (real.length) {
          const best = real.reduce((x, y) => (y.tgpa > x.tgpa ? y : x));
          lines.push({ icon: 'trophy', tone: 'goal', text: `Best semester: ${best.label} at ${best.tgpa.toFixed(2)}` });
          const honors = real.filter((p) => p.tgpa >= 3.5).length;
          lines.push(honors
            ? { icon: 'cap', tone: 'pos', text: `${honors} of ${real.length} semester${real.length === 1 ? '' : 's'} at 3.50 or higher` }
            : { icon: 'chart', text: `Average semester GPA: ${(real.reduce((sum, p) => sum + p.tgpa, 0) / real.length).toFixed(2)}` });
        }
      } else if (chartType === 'credits') {
        const done = semesters.map((sem, si) => ({ label: sem.label, c: semesterCredit(sem, si, proj, state.overrides) }));
        const total = done.reduce((s, x) => s + x.c, 0);
        if (total) {
          const active = done.filter((x) => x.c > 0);
          const planned = state.planned.reduce((s, psem, pi) => s + plannedCredit(psem, pi, proj), 0);
          lines.push({ icon: 'book', text: `${total.toFixed(1)} credits counted so far${planned ? `, +${planned.toFixed(1)} planned` : ''}` });
          const heavy = active.reduce((x, y) => (y.c > x.c ? y : x));
          const avg = `Average ${(total / active.length).toFixed(1)} per semester`;
          lines.push({ icon: 'gauge', text: active.filter((x) => x.c === heavy.c).length === 1 ? `${avg} · heaviest: ${heavy.label} (${heavy.c.toFixed(1)})` : avg });
        }
      }
      return lines;
    }

    function updateChartExtras(proj, pal) {
      chartTitleLabel.textContent = CHART_TITLES[chartType];
      insightBox.innerHTML = '';
      chartInsights(proj).forEach((line) => insightBox.appendChild(el('div', { class: `gpap-insight gpap-tone-${line.tone || 'neutral'}` }, [
        icon(line.icon, 'gpap-icon gpap-insight-icon'),
        el('span', { text: line.text })
      ])));
      insightBox.style.display = insightBox.childNodes.length ? '' : 'none';

      legendBox.innerHTML = '';
      const dot = (color, text, cls) => el('span', {}, [el('i', { style: `background:${color}`, class: cls || '' }), document.createTextNode(` ${text}`)]);
      if (chartType === 'trend') {
        legendBox.appendChild(dot(pal.actual, 'Actual'));
        if (hasEdits()) legendBox.appendChild(dot(pal.whatif, 'What-if'));
        legendBox.appendChild(dot(pal.honor, 'Honors zone (3.50+)', 'gpap-legend-square'));
      } else if (chartType === 'pie') {
        computeGradeDistribution(semesters, state.planned, proj, state.overrides).forEach((x) => {
          legendBox.appendChild(dot(x.color, `${x.grade} (${x.count})`));
        });
      } else if (chartType === 'semester') {
        GPA_TIERS.forEach((t) => legendBox.appendChild(dot(tierColor(t, pal), t.label)));
        legendBox.appendChild(el('span', {}, [el('i', { class: 'gpap-legend-dash' }), document.createTextNode(' Overall CGPA')]));
      } else if (chartType === 'credits') {
        legendBox.appendChild(dot(pal.actual, 'Completed'));
        if (state.planned.length) legendBox.appendChild(dot(pal.whatif, 'Planned'));
      }
    }

    // ---- Chart drawing, animation and hover tooltips ----
    let chartPaint = null;   // (t, hover) => hit regions
    let chartHits = [];
    let chartHover = null;
    let chartAnimFrame = 0;
    let chartAnimating = false;

    function paintChart(t) {
      if (!chartPaint) return;
      chartHits = chartPaint(t, chartHover) || [];
    }

    function hideChartTip() {
      chartTip.classList.remove('gpap-show');
    }

    function showChartTip(hit) {
      chartTip.innerHTML = '';
      chartTip.appendChild(el('b', { text: hit.title }));
      hit.lines.forEach((line) => chartTip.appendChild(el('div', { text: line })));
      chartTip.classList.add('gpap-show');
      const cw = chartContent.clientWidth;
      const tw = chartTip.offsetWidth;
      const left = Math.max(tw / 2 + 2, Math.min(cw - tw / 2 - 2, canvas.offsetLeft + hit.x));
      chartTip.style.left = `${left}px`;
      chartTip.style.top = `${canvas.offsetTop + hit.anchorY}px`;
      // Near the top of the chart, show the tip below the point so it doesn't cover the switcher.
      chartTip.classList.toggle('gpap-tip-below', hit.anchorY < chartTip.offsetHeight + 12);
    }

    canvas.addEventListener('mousemove', (e) => {
      if (chartAnimating || !chartHits.length) return;
      const r = canvas.getBoundingClientRect();
      const idx = chartHits.findIndex((hit) => chartHitTest(hit, e.clientX - r.left, e.clientY - r.top));
      const next = idx < 0 ? null : idx;
      if (next !== chartHover) {
        chartHover = next;
        paintChart(1);
      }
      // The donut shows details in its center, so it skips the floating tip.
      if (next === null || chartHits[next].kind === 'arc') hideChartTip(); else showChartTip(chartHits[next]);
    });
    canvas.addEventListener('mouseleave', () => {
      hideChartTip();
      if (chartHover !== null) { chartHover = null; paintChart(1); }
    });

    function renderChart(proj, animate) {
      const pal = chartPalette(canvas);
      updateChartExtras(proj, pal);
      const showEdited = hasEdits();
      if (chartType === 'trend') {
        const data = { pal, actual: actualProjection.timeline, edited: proj.timeline, showEdited };
        chartPaint = (t, hover) => drawTrendChart(canvas, data, t, hover);
      } else if (chartType === 'pie') {
        const data = { pal, dist: computeGradeDistribution(semesters, state.planned, proj, state.overrides) };
        chartPaint = (t, hover) => drawDonutChart(canvas, data, t, hover);
      } else if (chartType === 'semester') {
        const bars = proj.timeline.map((p, i) => ({
          label: p.label,
          value: p.tgpa,
          projected: p.projected,
          credit: i < semesters.length
            ? semesterCredit(semesters[i], i, proj, state.overrides)
            : plannedCredit(state.planned[i - semesters.length], i - semesters.length, proj)
        }));
        const data = { pal, bars, cgpa: proj.finalCGPA };
        chartPaint = (t, hover) => drawSemesterBarChart(canvas, data, t, hover);
      } else if (chartType === 'credits') {
        const bars = semesters.map((sem, si) => ({ label: sem.label, value: semesterCredit(sem, si, proj, state.overrides), projected: false }))
          .concat(state.planned.map((psem, pi) => ({ label: psem.label || `Planned ${pi + 1}`, value: plannedCredit(psem, pi, proj), projected: true })));
        const data = { pal, bars };
        chartPaint = (t, hover) => drawCreditBarChart(canvas, data, t, hover);
      }

      cancelAnimationFrame(chartAnimFrame);
      chartHover = null;
      hideChartTip();
      if (!animate || prefersReducedMotion() || state.chartCollapsed) {
        chartAnimating = false;
        chartAnimFrame = requestAnimationFrame(() => paintChart(1));
        return;
      }
      chartAnimating = true;
      let start = null;
      const step = (now) => {
        if (start === null) start = now;
        const t = Math.min(1, (now - start) / 700);
        paintChart(easeOutCubic(t));
        if (t < 1) chartAnimFrame = requestAnimationFrame(step);
        else chartAnimating = false;
      };
      chartAnimFrame = requestAnimationFrame(step);
    }

    function renderSemesters(proj) {
      viewSem.innerHTML = '';
      const list = el('div', { class: 'gpap-sem-cards' });

      function numBlock(cls, label, value) {
        return el('div', { class: `gpap-sem-card-num ${cls}` }, [
          el('span', { class: 'gpap-num-label', text: label }),
          el('span', { class: 'gpap-num-value', text: value })
        ]);
      }

      proj.timeline.forEach((t, i) => {
        const credit = i < semesters.length
          ? semesterCredit(semesters[i], i, proj, state.overrides)
          : plannedCredit(state.planned[i - semesters.length], i - semesters.length, proj);
        const card = el('div', { class: 'gpap-sem-card' + (t.projected ? ' gpap-row-projected' : '') }, [
          el('div', { class: 'gpap-sem-card-label' }, [
            el('div', { class: 'gpap-sem-card-name', text: t.label }),
            el('div', { class: 'gpap-sem-card-meta', text: `${credit.toFixed(1)} credits` })
          ]),
          el('div', { class: 'gpap-sem-card-nums' }, [
            numBlock('gpap-tgpa', 'TGPA', t.tgpa !== null ? t.tgpa.toFixed(2) : '—'),
            numBlock('gpap-cgpa', 'CGPA', t.cgpa !== null ? t.cgpa.toFixed(2) : '—')
          ])
        ]);
        list.appendChild(card);
      });
      viewSem.appendChild(list);
    }

    function renderEdit() {
      viewEdit.innerHTML = '';
      semesters.forEach((sem, si) => {
        const det = el('details', { class: 'gpap-sem' });
        det.open = openSemesters.has(si);
        det.addEventListener('toggle', () => {
          if (det.open) openSemesters.add(si); else openSemesters.delete(si);
        });
        const officialTgpa = sem.officialTGPA !== null && sem.officialTGPA !== undefined ? sem.officialTGPA : null;
        const updatedTgpa = lastProj && lastProj.timeline[si] ? lastProj.timeline[si].tgpa : null;
        const tgpaChanged = officialTgpa !== null && updatedTgpa !== null && Math.abs(officialTgpa - updatedTgpa) > 0.005;
        const gpaLine = el('span', { class: 'gpap-sem-gpa' });
        if (officialTgpa !== null) gpaLine.appendChild(document.createTextNode(`TGPA ${officialTgpa.toFixed(2)}`));
        if (tgpaChanged) {
          gpaLine.appendChild(document.createTextNode(' → '));
          gpaLine.appendChild(el('span', { class: 'gpap-sem-gpa-updated', text: updatedTgpa.toFixed(2) }));
        }
        const chevron = el('span', { class: 'gpap-chevron' }, [
          (() => {
            const ns = 'http://www.w3.org/2000/svg';
            const svg = document.createElementNS(ns, 'svg');
            svg.setAttribute('viewBox', '0 0 24 24');
            svg.setAttribute('fill', 'none');
            const path = document.createElementNS(ns, 'path');
            path.setAttribute('d', 'M9 6l6 6-6 6');
            path.setAttribute('stroke', '#8c8072');
            path.setAttribute('stroke-width', '2.4');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            svg.appendChild(path);
            return svg;
          })()
        ]);
        const summaryLeft = el('div', { class: 'gpap-sem-summary-left' }, [
          el('span', { text: sem.label }),
          gpaLine
        ]);
        const summary = el('summary', { title: 'Click to collapse or expand this semester' }, [summaryLeft, chevron]);
        det.appendChild(summary);
        sem.courses.forEach((c, ci) => {
          const key = `r:${si}:${ci}`;
          const info = lastProj ? lastProj.retakeInfo[key] : null;
          const exId = exclusionId(c.code, key);
          const isExcluded = !!state.excluded[exId];

          const infoBlock = el('div', { class: 'gpap-course-info' }, [
            el('div', {}, [
              el('span', { class: 'gpap-course-code', text: c.code }),
              isExcluded
                ? el('span', { class: 'gpap-retake-badge gpap-unlisted-badge', text: 'Not counted' })
                : retakeBadge(info)
            ].filter(Boolean)),
            el('div', { class: 'gpap-course-title', text: c.title }),
            el('div', { class: 'gpap-course-credit', text: `${c.credit.toFixed(1)} credit` })
          ]);

          const currentField = el('div', { class: 'gpap-grade-field' }, [
            el('span', { class: 'gpap-grade-field-label', text: 'Current' }),
            el('span', { class: 'gpap-current-grade-pill', text: c.grade || '—' })
          ]);

          const whatIfSelect = el('select', { class: 'gpap-grade-select' });
          const blank = el('option', { value: '', text: 'No change' });
          whatIfSelect.appendChild(blank);
          GRADE_OPTIONS.forEach((g) => whatIfSelect.appendChild(el('option', { value: g, text: g })));
          whatIfSelect.value = state.overrides[key] || '';
          if (state.overrides[key]) whatIfSelect.classList.add('gpap-overridden');
          whatIfSelect.disabled = isExcluded;
          whatIfSelect.addEventListener('change', () => {
            if (whatIfSelect.value) state.overrides[key] = whatIfSelect.value; else delete state.overrides[key];
            persist();
            rerenderKeepingScroll(renderAll);
            track('edit_grade', { grade: whatIfSelect.value || 'cleared' });
          });
          const whatIfField = el('div', { class: 'gpap-grade-field' }, [
            el('span', { class: 'gpap-grade-field-label', text: 'What-if' }),
            whatIfSelect
          ]);

          const toggleBtn = el('button', {
            class: 'gpap-exclude-btn' + (isExcluded ? ' gpap-readd' : ''),
            text: isExcluded ? '+' : '×',
            title: isExcluded ? 'Re-add this course (all attempts) to the CGPA calculation' : 'Exclude this course and all its retakes from the CGPA calculation'
          });
          toggleBtn.setAttribute('aria-label', toggleBtn.title);
          toggleBtn.addEventListener('click', () => {
            if (isExcluded) delete state.excluded[exId]; else state.excluded[exId] = true;
            persist();
            rerenderKeepingScroll(renderAll);
            track(isExcluded ? 'readd_course' : 'exclude_course');
          });

          const row = el('div', { class: 'gpap-course-row' + (isExcluded ? ' gpap-course-excluded' : '') }, [toggleBtn, infoBlock, currentField, whatIfField]);
          det.appendChild(row);
        });
        viewEdit.appendChild(det);
      });
    }

    function renderPlan() {
      viewPlan.innerHTML = '';
      if (!state.planned.length) {
        viewPlan.appendChild(el('div', { class: 'gpap-empty-hint', text: 'No planned semesters yet. Add one to project your future CGPA.' }));
      }
      state.planned.forEach((psem, pi) => {
        const box = el('div', { class: 'gpap-planned-sem' });
        const headerRow = el('div', { class: 'gpap-planned-sem-header' });
        const nameInput = el('input', { type: 'text', value: psem.label || '', placeholder: 'e.g. Summer 2026' });
        nameInput.addEventListener('input', () => { psem.label = nameInput.value; persist(); renderStatsAndChart(); });
        const delSemBtn = el('button', { class: 'gpap-btn gpap-btn-danger', text: '×' });
        delSemBtn.addEventListener('click', () => { state.planned.splice(pi, 1); persist(); renderAll(); track('remove_planned_semester'); });
        headerRow.appendChild(nameInput);
        headerRow.appendChild(delSemBtn);
        box.appendChild(headerRow);

        (psem.courses || []).forEach((pc, ci) => {
          const row = el('div', { class: 'gpap-planned-course-row' + (state.excluded[exclusionId(pc.code, `p:${pi}:${ci}`)] ? ' gpap-course-excluded' : '') });
          const codeInput = el('input', { type: 'text', value: pc.code || '', placeholder: 'Course code e.g. CSE499', title: 'Course code — fill in if retaking a course to apply best-grade handling' });
          codeInput.addEventListener('input', () => { pc.code = codeInput.value; persist(); renderStatsAndChart(); });
          const creditInput = el('input', { type: 'number', value: pc.credit || 3, step: '0.5', min: '0' });
          creditInput.addEventListener('input', () => { pc.credit = parseFloat(creditInput.value) || 0; persist(); renderStatsAndChart(); });
          const gradeSel = el('select', { class: 'gpap-grade-select' });
          GRADE_OPTIONS.forEach((g) => gradeSel.appendChild(el('option', { value: g, text: g })));
          gradeSel.value = pc.grade || 'A';
          gradeSel.addEventListener('change', () => { pc.grade = gradeSel.value; persist(); renderStatsAndChart(); });
          const delBtn = el('button', { class: 'gpap-btn gpap-btn-danger', text: '×' });
          delBtn.addEventListener('click', () => { psem.courses.splice(ci, 1); persist(); renderAll(); track('remove_planned_course'); });
          row.appendChild(codeInput); row.appendChild(creditInput); row.appendChild(gradeSel); row.appendChild(delBtn);
          box.appendChild(row);
        });

        const addCourseBtn = el('button', { class: 'gpap-btn gpap-btn-secondary gpap-btn-small', text: '+ Add course' });
        addCourseBtn.addEventListener('click', () => {
          psem.courses = psem.courses || [];
          psem.courses.push({ code: '', credit: 3, grade: 'A' });
          persist();
          renderPlan();
          track('add_planned_course');
        });
        box.appendChild(el('div', { class: 'gpap-row-actions' }, [addCourseBtn]));
        viewPlan.appendChild(box);
      });

      const addSemBtn = el('button', { class: 'gpap-btn', text: '+ Add planned semester' });
      addSemBtn.addEventListener('click', () => {
        state.planned.push({ label: '', courses: [{ code: '', credit: 3, grade: 'A' }] });
        persist();
        renderPlan();
        track('add_planned_semester');
      });
      viewPlan.appendChild(addSemBtn);
    }

    // Only courses graded below B+ are retakeable; a retake doesn't change the
    // credit count (same course, same slot), so the max achievable CGPA is just
    // (current quality points + best-case gains) / current credits.
    function retakeCandidates() {
      const candidates = [];
      semesters.forEach((sem, si) => {
        sem.courses.forEach((c, ci) => {
          const key = `r:${si}:${ci}`;
          const info = actualProjection.retakeInfo[key];
          const pts = pointsFor(c.grade);
          if (info && info.isPrimary && pts !== null && pts < RETAKE_ELIGIBLE_MAX_POINTS) {
            const credit = c.crCount || c.credit;
            candidates.push({ code: c.code, title: c.title, grade: c.grade, credit, gain: credit * (4.0 - pts) });
          }
        });
      });
      candidates.sort((a, b) => b.gain - a.gain);
      return candidates;
    }

    function evaluateTarget(target) {
      const baseCredit = actualProjection.finalCredit;
      const baseQP = actualProjection.finalQP;
      const baseCGPA = actualProjection.finalCGPA;
      if (!baseCredit) return { status: 'no-data' };
      if (target <= baseCGPA + 1e-9) return { status: 'achieved', baseCGPA };

      const candidates = retakeCandidates();
      const maxQP = baseQP + candidates.reduce((s, c) => s + c.gain, 0);
      const maxCGPA = maxQP / baseCredit;
      if (target > maxCGPA + 1e-9) return { status: 'impossible', baseCGPA, maxCGPA, candidateCount: candidates.length };

      let cumQP = baseQP;
      const chosen = [];
      for (const c of candidates) {
        if (cumQP / baseCredit >= target - 1e-9) break;
        chosen.push(c);
        cumQP += c.gain;
      }
      return { status: 'possible', baseCGPA, chosen, resultCGPA: cumQP / baseCredit, remaining: candidates.length - chosen.length };
    }

    function renderTarget() {
      viewTarget.innerHTML = '';
      viewTarget.appendChild(el('div', { class: 'gpap-empty-hint', text: 'Only courses graded below B+ are eligible for retake — B+ and above already count at full value and can\'t be improved.' }));

      const inputRow = el('div', { class: 'gpap-target-input-row' });
      const input = el('input', { type: 'number', min: '0', max: '4', step: '0.01', placeholder: 'e.g. 3.50' });
      if (targetValue !== null) input.value = targetValue;
      inputRow.appendChild(el('span', { class: 'gpap-grade-field-label', text: 'Target CGPA' }));
      inputRow.appendChild(input);
      viewTarget.appendChild(inputRow);

      const resultBox = el('div', { class: 'gpap-target-result' });
      viewTarget.appendChild(resultBox);

      function renderResult() {
        resultBox.innerHTML = '';
        if (targetValue === null || isNaN(targetValue)) {
          resultBox.appendChild(el('div', { class: 'gpap-empty-hint', text: 'Enter a target CGPA to check feasibility.' }));
          return;
        }
        const target = Math.max(0, Math.min(4, targetValue));
        const res = evaluateTarget(target);

        if (res.status === 'no-data') {
          resultBox.appendChild(el('div', { class: 'gpap-empty-hint', text: 'No graded semesters yet.' }));
          return;
        }
        if (res.status === 'achieved') {
          resultBox.appendChild(el('div', { class: 'gpap-target-badge gpap-target-achieved', text: `Already there — current CGPA ${res.baseCGPA.toFixed(2)}` }));
          return;
        }
        if (res.status === 'impossible') {
          resultBox.appendChild(el('div', { class: 'gpap-target-badge gpap-target-impossible', text: 'Not possible with retakes alone' }));
          resultBox.appendChild(el('div', { class: 'gpap-empty-hint', text: `Even at an A in every eligible retake (${res.candidateCount}), the max reachable CGPA is ${res.maxCGPA.toFixed(2)}.` }));
          return;
        }

        resultBox.appendChild(el('div', { class: 'gpap-target-badge gpap-target-possible', text: `Possible — retake ${res.chosen.length} course${res.chosen.length === 1 ? '' : 's'} at A to reach ${res.resultCGPA.toFixed(2)}` }));
        res.chosen.forEach((c) => {
          resultBox.appendChild(el('div', { class: 'gpap-retake-item' }, [
            el('span', { class: 'gpap-course-code', text: c.code || c.title }),
            el('span', { class: 'gpap-retake-transition' }, [
              el('span', { class: 'gpap-grade-from', text: c.grade }),
              document.createTextNode(' → '),
              el('span', { class: 'gpap-grade-to', text: 'A' })
            ])
          ]));
        });
        if (res.remaining > 0) {
          resultBox.appendChild(el('div', { class: 'gpap-empty-hint', text: `${res.remaining} more eligible course(s) not needed to hit this target.` }));
        }
      }

      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        targetValue = input.value === '' ? null : v;
        renderResult();
        if (targetValue !== null && !isNaN(targetValue)) {
          track('check_target_cgpa', { target: Math.max(0, Math.min(4, targetValue)).toFixed(2) });
        }
      });

      renderResult();
    }

    function renderStatsAndChart(animate) {
      const proj = renderStats();
      renderChart(proj, animate);
      renderSemesters(proj);
    }

    function renderAll() {
      const proj = renderStats();
      renderChart(proj);
      renderSemesters(proj);
      renderEdit();
      renderPlan();
    }

    renderAll();
  }

  main().catch((err) => track('extension_error', { message: String(err).slice(0, 100), source: 'content_script' }));
})();
