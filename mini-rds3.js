(function () {
  'use strict';

  function track(name, params) {
    try {
      chrome.runtime.sendMessage({ type: 'gpap_analytics_event', name, params: params || {} });
    } catch (e) { /* analytics must never break the extension */ }
  }

  const ORIGIN = 'https://rds3.northsouth.edu';
  const LANDING_URL = `${ORIGIN}/attendance/attendance/studentAttendanceLanding`;
  const EVAL_URL = `${ORIGIN}/students/FacultyEvaluation`;
  const CACHE_KEY = 'mrds_cache_v1';
  const CACHE_TTL_MS = 3 * 60 * 1000;
  const SEMESTER_PROBE_LIMIT = 6;

  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAY_CODES = ['S', 'M', 'T', 'W', 'R', 'F', 'A']; // NSU convention: Sun..Thu, Fri, Sat(A)

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

  function svgIcon(pathD) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', pathD);
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '2.2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);
    return svg;
  }

  async function fetchDoc(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    const html = await res.text();
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function parseCourseTable(doc) {
    const table = doc.getElementById('simple-table');
    if (!table || !table.tBodies.length || !table.tBodies[0].rows.length) return null;
    const headerCells = Array.from(table.tHead.rows[0].cells).map((c) => c.textContent.trim());
    const rows = Array.from(table.tBodies[0].rows);
    const courses = [];
    rows.forEach((row) => {
      const cells = Array.from(row.cells);
      if (!cells.length) return;
      const course = {};
      let colPtr = 0;
      let attendanceUrl = null;
      cells.forEach((cell) => {
        const span = cell.colSpan || 1;
        const headerName = headerCells[colPtr] || '';
        const text = cell.textContent.replace(/\s+/g, ' ').trim();
        const link = cell.querySelector('a');
        if (link) attendanceUrl = link.href;
        if (headerName) course[headerName] = text;
        colPtr += span;
      });
      courses.push({
        code: course['Course Code'] || '',
        section: course['Section'] || '',
        title: course['Course Title'] || '',
        day: (course['Day'] || '').toUpperCase(),
        start: course['Start Time'] || '',
        end: course['End Time'] || '',
        room: course['Room'] || '',
        faculty: course['Faculty'] || '',
        attendanceUrl
      });
    });
    return courses.filter((c) => c.code);
  }

  function parseAttendanceDetail(doc) {
    const table = doc.getElementById('simple-table');
    const bodyText = doc.body ? doc.body.innerText : '';
    const totalMatch = bodyText.match(/Total Lecture Number:\s*(\d+)/);
    const attendedMatch = bodyText.match(/Lecture Attended:\s*(\d+)/);
    const result = {
      total: totalMatch ? parseInt(totalMatch[1], 10) : null,
      attended: attendedMatch ? parseInt(attendedMatch[1], 10) : null,
      last: null
    };
    if (table && table.tBodies.length && table.tBodies[0].rows.length) {
      const rows = table.tBodies[0].rows;
      const lastRow = rows[rows.length - 1];
      const cells = Array.from(lastRow.cells).map((c) => c.textContent.trim());
      result.last = { date: cells[1] || '', status: (cells[2] || '').toUpperCase() };
    }
    return result;
  }

  function parseEvalSemesterLabel(doc) {
    const h1s = Array.from(doc.querySelectorAll('h1'));
    for (const h of h1s) {
      const m = h.textContent.trim().match(/^Evaluation\s*-\s*(.+)$/i);
      if (m) return m[1].trim();
    }
    return null;
  }

  // NSU's Faculty Evaluation page is scoped server-side to the true current
  // semester and states its name in the heading (e.g. "Evaluation - Summer 2026"),
  // but the evaluation window only opens late in the term, so this alone
  // misses most of the semester.
  async function findCurrentSemesterByEval(options) {
    try {
      const evalDoc = await fetchDoc(EVAL_URL);
      const label = parseEvalSemesterLabel(evalDoc);
      return label ? resolveSemesterByLabel(options, label) : null;
    } catch (e) {
      return null;
    }
  }

  // The Home page's "Activity Status" panel lists a "Payment" row tagged
  // with the semester it belongs to. Registration/payment records exist
  // from the start of the term (unlike Faculty Evaluation, which only opens
  // near the end), so this is reliable across the whole semester. It's
  // present in the raw server-rendered HTML, just CSS-collapsed, so a plain
  // fetch (no JS execution) still sees it.
  function parseActivityStatusSemesterLabel(doc) {
    const table = Array.from(doc.querySelectorAll('table')).find((t) => {
      const headCells = t.rows.length ? Array.from(t.rows[0].cells).map((c) => c.textContent.trim().toLowerCase()) : [];
      return headCells.includes('activity') && headCells.includes('semester');
    });
    if (!table) return null;
    for (const row of Array.from(table.rows)) {
      const cells = Array.from(row.cells).map((c) => c.textContent.trim());
      if (cells.length >= 2 && cells[0].toLowerCase() === 'payment') return cells[1];
    }
    return null;
  }

  async function findCurrentSemesterByActivityStatus(options) {
    try {
      const homeDoc = await fetchDoc(`${ORIGIN}/students/landing`);
      const label = parseActivityStatusSemesterLabel(homeDoc);
      return label ? resolveSemesterByLabel(options, label) : null;
    } catch (e) {
      return null;
    }
  }

  async function resolveSemesterByLabel(options, label) {
    const match = options.find((o) => o.textContent.trim().toLowerCase() === label.toLowerCase());
    if (!match) return null;
    const doc = await fetchDoc(`${LANDING_URL}/${match.value}`);
    const courses = parseCourseTable(doc);
    return courses && courses.length ? { label: match.textContent.trim(), courses } : null;
  }

  async function findCurrentSemesterCourses() {
    const landingDoc = await fetchDoc(LANDING_URL);
    const select = landingDoc.querySelector('select#semester') || landingDoc.querySelector('select');
    if (!select) {
      const err = new Error('not_logged_in');
      throw err;
    }
    const options = Array.from(select.querySelectorAll('option')).filter((o) => o.value && o.value !== '0');

    const viaActivityStatus = await findCurrentSemesterByActivityStatus(options);
    if (viaActivityStatus) return viaActivityStatus;

    const viaEval = await findCurrentSemesterByEval(options);
    if (viaEval) return viaEval;

    // Last-resort fallback if both server-side "current semester" signals are
    // unavailable: probe newest-first and take the first semester with a
    // non-empty course table.
    const candidates = options.slice(0, SEMESTER_PROBE_LIMIT);
    const results = await Promise.all(candidates.map(async (opt) => {
      try {
        const doc = await fetchDoc(`${LANDING_URL}/${opt.value}`);
        const courses = parseCourseTable(doc);
        return courses && courses.length ? { label: opt.textContent.trim(), courses } : null;
      } catch (e) {
        return null;
      }
    }));

    return results.find((r) => r) || null;
  }

  async function enrichWithAttendance(courses) {
    return Promise.all(courses.map(async (c) => {
      if (!c.attendanceUrl) return { ...c, attendance: null };
      try {
        const doc = await fetchDoc(c.attendanceUrl);
        return { ...c, attendance: parseAttendanceDetail(doc) };
      } catch (e) {
        return { ...c, attendance: null };
      }
    }));
  }

  async function loadData() {
    const found = await findCurrentSemesterCourses();
    if (!found) return { semester: null, courses: [], fetchedAt: Date.now() };
    const courses = await enrichWithAttendance(found.courses);
    return { semester: found.label, courses, fetchedAt: Date.now() };
  }

  async function getCached() {
    try {
      const stored = await chrome.storage.local.get([CACHE_KEY]);
      return stored[CACHE_KEY] || null;
    } catch (e) { return null; }
  }

  async function setCached(data) {
    try { await chrome.storage.local.set({ [CACHE_KEY]: data }); } catch (e) { /* ignore */ }
  }

  function timeAgo(ts) {
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 60) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.round(m / 60);
    return `${h}h ago`;
  }

  function todaysClasses(courses) {
    const code = DAY_CODES[new Date().getDay()];
    return courses.filter((c) => c.day && c.day.includes(code));
  }

  function timeToMinutes(t) {
    const m = (t || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1], 10) % 12;
    if (/pm/i.test(m[3])) h += 12;
    return h * 60 + parseInt(m[2], 10);
  }

  function attendanceBadge(course) {
    if (!course.attendanceUrl) return el('span', { class: 'mrds-att-badge mrds-unknown', text: '—' });
    if (!course.attendance || !course.attendance.last) {
      return el('span', { class: 'mrds-att-badge mrds-unknown', text: 'N/A' });
    }
    const status = course.attendance.last.status;
    const cls = status === 'YES' ? 'mrds-yes' : status === 'NO' ? 'mrds-no' : 'mrds-unknown';
    return el('span', { class: `mrds-att-badge ${cls}`, text: status || '—' });
  }

  function classCard(c) {
    return el('div', { class: 'mrds-class-row' }, [
      el('div', { class: 'mrds-class-top' }, [
        el('span', {}, [
          el('span', { class: 'mrds-class-code', text: c.code }),
          el('span', { class: 'mrds-class-sec', text: `Sec ${c.section}` })
        ]),
        el('span', { class: 'mrds-class-time', text: c.start && c.end ? `${c.start} – ${c.end}` : 'TBA' })
      ]),
      el('div', { class: 'mrds-class-title', text: c.title }),
      el('div', { class: 'mrds-class-meta', text: c.room ? `Room ${c.room}` : 'Room TBA' })
    ]);
  }

  function main() {
    const fab = el('div', { id: 'mrds-fab', title: 'Mini-RDS3 — today\'s routine & attendance' }, [
      svgIcon('M8 2v4M16 2v4M3.5 9h17M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z'),
      el('span', { class: 'mrds-fab-label', text: 'Mini-RDS3' })
    ]);

    function adjustFabPosition() {
      const other = document.getElementById('gpap-fab');
      const bottom = other ? '88px' : '24px';
      fab.style.bottom = bottom;
      panel.style.bottom = other ? '152px' : '88px';
    }

    const headerTitle = el('div', { class: 'mrds-header-title' }, [
      el('h1', { text: 'Mini-RDS3' }),
      el('span', { class: 'mrds-header-sub', text: 'Loading…' })
    ]);
    const refreshBtn = el('button', { class: 'mrds-icon-btn', title: 'Refresh' }, [
      svgIcon('M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5')
    ]);
    const closeBtn = el('button', { class: 'mrds-icon-btn', title: 'Close' }, [
      svgIcon('M6 6l12 12M18 6L6 18')
    ]);
    const header = el('div', { class: 'mrds-header' }, [
      headerTitle,
      el('div', { class: 'mrds-header-actions' }, [refreshBtn, closeBtn])
    ]);

    const tabToday = el('div', { class: 'mrds-tab mrds-active', text: 'Today' });
    const tabRoutine = el('div', { class: 'mrds-tab', text: 'Full Routine' });
    const tabsNav = el('div', { class: 'mrds-tabs' }, [tabToday, tabRoutine]);

    const viewToday = el('div', { class: 'mrds-view mrds-active' });
    const viewRoutine = el('div', { class: 'mrds-view' });
    const body = el('div', { class: 'mrds-body' }, [viewToday, viewRoutine]);

    const footer = el('div', { class: 'mrds-footer' }, [
      el('a', { href: `${ORIGIN}/attendance/attendance/studentAttendanceLanding`, target: '_blank', rel: 'noopener noreferrer', text: 'Open full Attendance page on RDS3 →' })
    ]);

    const creditLink = el('a', { href: 'https://www.facebook.com/tahshanjamil.shadhin', target: '_blank', rel: 'noopener noreferrer', text: 'Tahshan Jamil Shadhin' });
    const credit = el('div', { class: 'mrds-credit' }, [
      document.createTextNode('Made for NSUers by '),
      creditLink
    ]);

    const panel = el('div', { id: 'mrds-panel' }, [header, tabsNav, body, footer, credit]);

    closeBtn.addEventListener('click', () => panel.classList.remove('mrds-open'));

    function switchTab(tab) {
      [tabToday, tabRoutine].forEach((t) => t.classList.remove('mrds-active'));
      [viewToday, viewRoutine].forEach((v) => v.classList.remove('mrds-active'));
      tab.classList.add('mrds-active');
      tab.view.classList.add('mrds-active');
    }
    tabToday.view = viewToday; tabRoutine.view = viewRoutine;
    tabToday.addEventListener('click', () => { switchTab(tabToday); track('mrds_view_tab', { tab_name: 'today' }); });
    tabRoutine.addEventListener('click', () => { switchTab(tabRoutine); track('mrds_view_tab', { tab_name: 'routine' }); });

    function setStatus(message, isError) {
      [viewToday, viewRoutine].forEach((v) => {
        v.innerHTML = '';
        v.appendChild(el('div', { class: `mrds-status-msg${isError ? ' mrds-error' : ''}`, text: message }));
      });
    }

    function renderLoading() {
      setStatus('Fetching your routine & attendance from RDS3…', false);
    }

    function renderError(message) {
      setStatus(message, true);
    }

    function renderToday(data) {
      viewToday.innerHTML = '';
      viewToday.appendChild(el('div', { class: 'mrds-section-title', text: `Today's Classes — ${DAY_NAMES[new Date().getDay()]}` }));
      const today = todaysClasses(data.courses);
      if (!today.length) {
        viewToday.appendChild(el('div', { class: 'mrds-status-msg', text: 'No classes scheduled today.' }));
      } else {
        today.forEach((c) => viewToday.appendChild(classCard(c)));
      }

      viewToday.appendChild(el('div', { class: 'mrds-section-title', text: 'Attendance — Last Class' }));
      data.courses.forEach((c) => {
        const att = c.attendance;
        const countText = att && att.total !== null && att.attended !== null
          ? `${att.attended}/${att.total} attended${att.last ? ' • ' + att.last.date : ''}`
          : 'No records yet';
        viewToday.appendChild(el('div', { class: 'mrds-att-row' }, [
          el('div', { class: 'mrds-att-info' }, [
            el('div', { class: 'mrds-att-code' }, [
              document.createTextNode(c.code),
              el('span', { class: 'mrds-class-sec', text: ` Sec ${c.section}` })
            ]),
            el('div', { class: 'mrds-att-title', text: c.title })
          ]),
          el('div', { class: 'mrds-att-right' }, [
            attendanceBadge(c),
            el('span', { class: 'mrds-att-count', text: countText })
          ])
        ]));
      });
    }

    function renderRoutine(data) {
      viewRoutine.innerHTML = '';
      const todayCode = DAY_CODES[new Date().getDay()];
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
        viewRoutine.appendChild(el('div', { class: `mrds-section-title${code === todayCode ? ' mrds-day-today' : ''}`, text: name }));
        if (!dayCourses.length) {
          viewRoutine.appendChild(el('div', { class: 'mrds-status-msg', text: 'No classes.' }));
        } else {
          dayCourses.forEach((c) => viewRoutine.appendChild(classCard(c)));
        }
      });
    }

    function render(data) {
      headerTitle.querySelector('.mrds-header-sub').textContent = data.semester
        ? `${data.semester} • updated ${timeAgo(data.fetchedAt)}`
        : 'No active semester found';

      if (!data.semester || !data.courses.length) {
        setStatus('No registered courses found for any recent semester.', false);
        return;
      }

      renderToday(data);
      renderRoutine(data);
    }

    let loading = false;
    async function refresh(force) {
      if (loading) return;
      loading = true;
      refreshBtn.classList.add('mrds-spinning');
      try {
        if (!force) {
          const cached = await getCached();
          if (cached) render(cached);
          else renderLoading();
        } else {
          renderLoading();
        }

        const isStale = !force ? await getCached().then((c) => !c || Date.now() - c.fetchedAt > CACHE_TTL_MS) : true;
        if (force || isStale) {
          const fresh = await loadData();
          await setCached(fresh);
          render(fresh);
        }
      } catch (e) {
        if (e && e.message === 'not_logged_in') {
          renderError('Could not read your session. Please make sure you are logged into RDS3, then hit refresh.');
        } else {
          renderError('Something went wrong fetching your routine & attendance. Try refreshing.');
        }
        track('mrds_fetch_error', { message: String(e).slice(0, 100) });
      } finally {
        loading = false;
        refreshBtn.classList.remove('mrds-spinning');
      }
    }

    refreshBtn.addEventListener('click', () => { refresh(true); track('mrds_refresh'); });

    fab.addEventListener('click', () => {
      const opening = !panel.classList.contains('mrds-open');
      panel.classList.toggle('mrds-open');
      if (opening) {
        adjustFabPosition();
        refresh(false);
        track('mrds_open_panel');
      }
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);
    adjustFabPosition();

    const mo = new MutationObserver(adjustFabPosition);
    mo.observe(document.body, { childList: true });
  }

  if (document.body) main();
  else document.addEventListener('DOMContentLoaded', main, { once: true });
})();
