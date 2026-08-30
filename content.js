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
  function computeProjection(semesters, overrides, planned) {
    const flat = [];
    semesters.forEach((sem, si) => {
      sem.courses.forEach((c, ci) => {
        const key = `r:${si}:${ci}`;
        const grade = Object.prototype.hasOwnProperty.call(overrides, key) ? overrides[key] : c.grade;
        flat.push({ key, code: normCode(c.code), credit: c.crCount || c.credit, grade });
      });
    });
    planned.forEach((psem, pi) => {
      (psem.courses || []).forEach((pc, ci) => {
        const key = `p:${pi}:${ci}`;
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

  const COLOR_ACTUAL = '#1b3a63';
  const COLOR_WHATIF = '#c98a12';

  const GRADE_COLORS = {
    'A': '#1a8a4a', 'A-': '#3aa563',
    'B+': '#2f6fb8', 'B': '#4a86c9', 'B-': '#7aa8d8',
    'C+': '#c98a12', 'C': '#d9a53f', 'C-': '#e6c179',
    'D+': '#d9773f', 'D': '#e0955f',
    'F': '#c0392b', 'W': '#8894a8', 'I': '#a8b0bd'
  };

  const GPA_TIERS = [
    { min: 3.5, color: '#1a8a4a', label: 'Great (3.5+)' },
    { min: 3.0, color: '#2f6fb8', label: 'Good (3.0–3.49)' },
    { min: 2.5, color: '#c98a12', label: 'Fair (2.5–2.99)' },
    { min: -Infinity, color: '#c0392b', label: 'Needs work (<2.5)' }
  ];
  function tierFor(gpa) { return GPA_TIERS.find((t) => gpa >= t.min); }

  function drawTrendChart(canvas, actualTimeline, editedTimeline, showEdited) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 360;
    const h = canvas.clientHeight || 150;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const actualPoints = actualTimeline.filter((t) => t.cgpa !== null);
    const editedPoints = showEdited ? editedTimeline.filter((t) => t.cgpa !== null) : [];
    const totalCount = Math.max(actualPoints.length, editedPoints.length);
    if (totalCount < 1) {
      ctx.fillStyle = '#8894a8';
      ctx.font = '12px sans-serif';
      ctx.fillText('No graded semesters yet', 10, h / 2);
      return;
    }

    const padL = 30, padR = 10, padT = 10, padB = 20;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const minY = 2.0, maxY = 4.0;
    const yFor = (v) => padT + plotH * (1 - (Math.max(minY, Math.min(maxY, v)) - minY) / (maxY - minY));
    const xFor = (i) => padL + (totalCount === 1 ? plotW / 2 : (plotW * i) / (totalCount - 1));

    ctx.strokeStyle = '#e1e7f0';
    ctx.fillStyle = '#8894a8';
    ctx.font = '9px sans-serif';
    ctx.lineWidth = 1;
    for (let g = 2.0; g <= 4.0; g += 0.5) {
      const y = yFor(g);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(g.toFixed(1), 2, y + 3);
    }

    function drawSeries(points, color) {
      ctx.lineWidth = 2.2;
      for (let i = 1; i < points.length; i++) {
        ctx.beginPath();
        ctx.strokeStyle = color;
        if (points[i].projected) ctx.setLineDash([4, 3]); else ctx.setLineDash([]);
        ctx.moveTo(xFor(i - 1), yFor(points[i - 1].cgpa));
        ctx.lineTo(xFor(i), yFor(points[i].cgpa));
        ctx.stroke();
      }
      ctx.setLineDash([]);
      points.forEach((p, i) => {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(xFor(i), yFor(p.cgpa), 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Actual line is drawn from the untouched real grades and never moves.
    drawSeries(actualPoints, COLOR_ACTUAL);
    // What-if line reflects current overrides + planned semesters, only shown once something is edited.
    if (showEdited && editedPoints.length) drawSeries(editedPoints, COLOR_WHATIF);
  }

  function setupCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 360;
    const h = canvas.clientHeight || 150;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function drawEmptyMessage(ctx, h, text) {
    ctx.fillStyle = '#8894a8';
    ctx.font = '12px sans-serif';
    ctx.fillText(text, 10, h / 2);
  }

  function drawPieChart(canvas, dist) {
    const { ctx, w, h } = setupCanvas(canvas);
    const total = dist.reduce((s, d) => s + d.count, 0);
    if (!total) { drawEmptyMessage(ctx, h, 'No graded courses yet'); return; }

    const cx = w / 2, cy = h / 2 + 4, r = Math.min(cx, h / 2) - 12;
    let start = -Math.PI / 2;
    dist.forEach((d) => {
      const angle = (d.count / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      start += angle;
    });
  }

  function drawSemesterBarChart(canvas, bars) {
    const { ctx, w, h } = setupCanvas(canvas);
    const points = bars.filter((b) => b.value !== null);
    if (!points.length) { drawEmptyMessage(ctx, h, 'No graded semesters yet'); return; }

    const padL = 30, padR = 10, padT = 10, padB = 20;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const minY = 0, maxY = 4.0;
    const yFor = (v) => padT + plotH * (1 - (Math.max(minY, Math.min(maxY, v)) - minY) / (maxY - minY));

    ctx.strokeStyle = '#e1e7f0';
    ctx.fillStyle = '#8894a8';
    ctx.font = '9px sans-serif';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4.0; g += 1.0) {
      const y = yFor(g);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(g.toFixed(1), 2, y + 3);
    }

    const gap = 6;
    const barW = Math.max(4, (plotW - gap * (points.length - 1)) / points.length);
    points.forEach((p, i) => {
      const x = padL + i * (barW + gap);
      const y = yFor(p.value);
      ctx.globalAlpha = p.projected ? 0.55 : 1;
      ctx.fillStyle = tierFor(p.value).color;
      ctx.fillRect(x, y, barW, (padT + plotH) - y);
      ctx.globalAlpha = 1;
    });
  }

  function drawCreditBarChart(canvas, bars) {
    const { ctx, w, h } = setupCanvas(canvas);
    if (!bars.length) { drawEmptyMessage(ctx, h, 'No semesters yet'); return; }

    const padL = 24, padR = 10, padT = 10, padB = 20;
    const plotW = w - padL - padR, plotH = h - padT - padB;
    const maxCredit = Math.max(4, ...bars.map((b) => b.value));
    const yFor = (v) => padT + plotH * (1 - v / maxCredit);

    ctx.strokeStyle = '#e1e7f0';
    ctx.fillStyle = '#8894a8';
    ctx.font = '9px sans-serif';
    ctx.lineWidth = 1;
    for (let g = 0; g <= maxCredit; g += Math.ceil(maxCredit / 4)) {
      const y = yFor(g);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(String(g), 2, y + 3);
    }

    const gap = 6;
    const barW = Math.max(4, (plotW - gap * (bars.length - 1)) / bars.length);
    bars.forEach((p, i) => {
      const x = padL + i * (barW + gap);
      const y = yFor(p.value);
      ctx.fillStyle = p.projected ? COLOR_WHATIF : COLOR_ACTUAL;
      ctx.fillRect(x, y, barW, (padT + plotH) - y);
    });
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
        .map((g) => ({ grade: g, count: counts[g], color: GRADE_COLORS[g] || '#8894a8' }))
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

    let state = { overrides: {}, planned: [] };
    try {
      const stored = await chrome.storage.local.get([storageKey]);
      if (stored[storageKey]) state = Object.assign(state, stored[storageKey]);
    } catch (e) { /* storage unavailable, continue with defaults */ }

    let saveTimer = null;
    function persist() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        chrome.storage.local.set({ [storageKey]: state }).catch(() => {});
      }, 250);
    }

    const actualProjection = computeProjection(semesters, {}, []);
    const actualCGPA = actualProjection.finalCGPA;

    const fab = el('div', { id: 'gpap-fab', title: 'What if CGPA Planner' }, [
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
      el('h1', { text: 'What if CGPA Planner' }),
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
    chartBox.appendChild(el('div', { class: 'gpap-hero-chart-title' }, [chartTitleLabel]));

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
        renderStatsAndChart();
      });
      chartTypeButtons[ct.id] = btn;
      chartSwitcher.appendChild(btn);
    });
    chartBox.appendChild(chartSwitcher);

    const canvas = document.createElement('canvas');
    canvas.id = 'gpap-chart';
    chartBox.appendChild(canvas);
    chartBox.appendChild(legendBox);
    hero.appendChild(heroStats);
    hero.appendChild(chartBox);

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
    const resetBtn = el('button', { class: 'gpap-btn gpap-btn-secondary', text: 'Reset all what-ifs' });
    resetBtn.addEventListener('click', () => {
      state.overrides = {};
      state.planned = [];
      persist();
      renderAll();
      track('reset_whatifs');
    });
    footer.appendChild(resetBtn);

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
    panel.appendChild(credit);

    fab.addEventListener('click', () => {
      panel.classList.add('gpap-open');
      renderStatsAndChart();
      track('open_panel');
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    let lastProj = null;
    let targetValue = null;
    const openSemesters = new Set([semesters.length - 1]);

    function rerenderKeepingScroll(renderFn) {
      const pos = body.scrollTop;
      renderFn();
      body.scrollTop = pos;
    }

    function renderStats() {
      const proj = computeProjection(semesters, state.overrides, state.planned);
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

      return proj;
    }

    const CHART_TITLES = {
      trend: 'CGPA trend', pie: 'Grade distribution', semester: 'Semester GPA', credits: 'Credits per semester'
    };

    function updateChartLegend(proj) {
      chartTitleLabel.textContent = CHART_TITLES[chartType];
      legendBox.innerHTML = '';
      if (chartType === 'trend') {
        legendBox.appendChild(el('span', {}, [el('i', { style: `background:${COLOR_ACTUAL}` }), document.createTextNode(' Actual')]));
        legendBox.appendChild(el('span', {}, [el('i', { style: `background:${COLOR_WHATIF}` }), document.createTextNode(' What-if')]));
      } else if (chartType === 'pie') {
        computeGradeDistribution(semesters, state.planned, proj, state.overrides).forEach((d) => {
          legendBox.appendChild(el('span', {}, [el('i', { style: `background:${d.color}` }), document.createTextNode(` ${d.grade} (${d.count})`)]));
        });
      } else if (chartType === 'semester') {
        GPA_TIERS.forEach((t) => {
          legendBox.appendChild(el('span', {}, [el('i', { style: `background:${t.color}` }), document.createTextNode(` ${t.label}`)]));
        });
      } else if (chartType === 'credits') {
        legendBox.appendChild(el('span', {}, [el('i', { style: `background:${COLOR_ACTUAL}` }), document.createTextNode(' Completed')]));
        legendBox.appendChild(el('span', {}, [el('i', { style: `background:${COLOR_WHATIF}` }), document.createTextNode(' Planned')]));
      }
    }

    function renderChart(proj) {
      const showEdited = Object.keys(state.overrides).length > 0 || state.planned.length > 0;
      updateChartLegend(proj);
      requestAnimationFrame(() => {
        if (chartType === 'trend') {
          drawTrendChart(canvas, actualProjection.timeline, proj.timeline, showEdited);
        } else if (chartType === 'pie') {
          drawPieChart(canvas, computeGradeDistribution(semesters, state.planned, proj, state.overrides));
        } else if (chartType === 'semester') {
          const bars = proj.timeline.map((t) => ({ value: t.tgpa, projected: t.projected }));
          drawSemesterBarChart(canvas, bars);
        } else if (chartType === 'credits') {
          const bars = semesters.map((sem, si) => ({ value: semesterCredit(sem, si, proj, state.overrides), projected: false }))
            .concat(state.planned.map((psem, pi) => ({ value: plannedCredit(psem, pi, proj), projected: true })));
          drawCreditBarChart(canvas, bars);
        }
      });
    }

    function renderSemesters(proj) {
      viewSem.innerHTML = '';
      const table = el('table', { class: 'gpap-sem-table' });
      const thead = el('thead', {}, [el('tr', {}, [
        el('th', { text: 'Semester' }),
        el('th', { class: 'gpap-num', text: 'Credits' }),
        el('th', { class: 'gpap-num', text: 'TGPA' }),
        el('th', { class: 'gpap-num', text: 'CGPA' })
      ])]);
      table.appendChild(thead);
      const tbody = el('tbody');

      proj.timeline.forEach((t) => {
        const tr = el('tr', { class: t.projected ? 'gpap-row-projected' : '' }, [
          el('td', { text: t.label }),
          el('td', { class: 'gpap-num' }),
          el('td', { class: 'gpap-num', text: t.tgpa !== null ? t.tgpa.toFixed(2) : '—' }),
          el('td', { class: 'gpap-num gpap-cgpa', text: t.cgpa !== null ? t.cgpa.toFixed(2) : '—' })
        ]);
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      viewSem.appendChild(table);

      // fill in per-semester credit column using actual computed course credits (primary-only)
      const rows = tbody.querySelectorAll('tr');
      semesters.forEach((sem, si) => {
        rows[si].children[1].textContent = semesterCredit(sem, si, proj, state.overrides).toFixed(1);
      });
      state.planned.forEach((psem, pi) => {
        rows[semesters.length + pi].children[1].textContent = plannedCredit(psem, pi, proj).toFixed(1);
      });
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
            path.setAttribute('stroke', '#1b3a63');
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

          const infoBlock = el('div', { class: 'gpap-course-info' }, [
            el('div', {}, [
              el('span', { class: 'gpap-course-code', text: c.code }),
              retakeBadge(info)
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

          const row = el('div', { class: 'gpap-course-row' }, [infoBlock, currentField, whatIfField]);
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
          const row = el('div', { class: 'gpap-planned-course-row' });
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

    function renderStatsAndChart() {
      const proj = renderStats();
      renderChart(proj);
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
