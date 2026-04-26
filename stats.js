'use strict';

/* ═══════════════════════════════════════════════════════
   KEETA STATS PAGE — stats.js
   Consumes: GET https://express-extension-manager.premiumasp.net/api/keeta-stats/{orgId}/{date}
   ═══════════════════════════════════════════════════════ */

const STATS_API_BASE = 'https://express-extension-manager.premiumasp.net/api/keeta-stats';

// ── STATUS CODE MAP ────────────────────────────────────
const STATUS_INFO = {
  20: { label: 'بدون طلب',  color: '#22c55e', cls: 'badge-going' },
  30: { label: 'يوصل',      color: '#f97316', cls: 'badge-delivering' },
  40: { label: 'غير متصل',  color: '#6b7280', cls: 'badge-offline' },
  10: { label: 'غير متصل',  color: '#6b7280', cls: 'badge-offline' },
};
function statusInfo(code) {
  return STATUS_INFO[code] || { label: `كود ${code}`, color: '#6b7280', cls: 'badge-offline' };
}

// ── AVATAR HELPERS ─────────────────────────────────────
const AV_CLS = ['av-0', 'av-1', 'av-2', 'av-3', 'av-4'];
function avClass(name) { return AV_CLS[(name.charCodeAt(0) || 0) % 5]; }
function avInit(name)  { return (name || '?').charAt(0).toUpperCase(); }

// ── STATE ──────────────────────────────────────────────
let currentTheme   = localStorage.getItem('keeta_theme') || 'dark';
let rawCouriers    = [];     // full list from API
let filteredList   = [];     // after search
let sortCol        = 'finished';
let sortDir        = 'desc'; // 'asc' | 'desc'
let searchQuery    = '';

// ── THEME ──────────────────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = currentTheme === 'dark' ? '☀️ فاتح' : '🌙 داكن';
}

// ── TOAST ──────────────────────────────────────────────
function toast(msg, type = 'info', ms = 3500) {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .3s';
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// ── FETCH ──────────────────────────────────────────────
async function fetchStats(orgId, date) {
  // date is YYYY-MM-DD string; API expects DateOnly → same format
  const url = `${STATS_API_BASE}/${encodeURIComponent(orgId)}/${encodeURIComponent(date)}`;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (resp.status === 404) return null;
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.warn(`Failed to fetch stats for ${orgId}:`, e);
    return null;
  }
}

// ── RENDER SUMMARY CARDS ───────────────────────────────
function renderSummary(data) {
  setText('sc-total',    data.totalCouriers ?? '—');
  setText('sc-finished', data.totalFinished ?? '—');
  setText('sc-active',   data.totalDelivering ?? '—');
  setText('sc-canceled', data.totalCanceled ?? '—');
  setText('sc-hours',    `${(data.totalOnlineHours ?? 0).toFixed(1)} س`);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

// ── RENDER TABLE ───────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('couriersTableBody');
  const noRes = document.getElementById('noResults');

  // Apply search filter
  const q = searchQuery.toLowerCase();
  filteredList = q
    ? rawCouriers.filter(c =>
        (c.courierName || '').toLowerCase().includes(q) ||
        String(c.courierId).includes(q)
      )
    : [...rawCouriers];

  // Sort
  filteredList.sort((a, b) => {
    let va, vb;
    switch (sortCol) {
      case 'name':       va = (a.courierName || '').toLowerCase(); vb = (b.courierName || '').toLowerCase(); break;
      case 'finished':   va = a.finishedTasks   || 0; vb = b.finishedTasks   || 0; break;
      case 'delivering': va = a.deliveringTasks || 0; vb = b.deliveringTasks || 0; break;
      case 'canceled':   va = a.canceledTasks   || 0; vb = b.canceledTasks   || 0; break;
      case 'hours':      va = a.onlineHours     || 0; vb = b.onlineHours     || 0; break;
      case 'status':     va = a.statusCode      || 0; vb = b.statusCode      || 0; break;
      default: va = 0; vb = 0;
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  setText('tableCount', filteredList.length);

  if (!filteredList.length) {
    tbody.innerHTML = '';
    noRes.style.display = 'flex';
    return;
  }
  noRes.style.display = 'none';

  // Find max values for bar scaling
  const maxFinished   = Math.max(...filteredList.map(c => c.finishedTasks   || 0), 1);
  const maxDelivering = Math.max(...filteredList.map(c => c.deliveringTasks || 0), 1);
  const maxCanceled   = Math.max(...filteredList.map(c => c.canceledTasks   || 0), 1);
  const maxHours      = Math.max(...filteredList.map(c => c.onlineHours     || 0), 1);

  tbody.innerHTML = filteredList.map((c, i) => {
    const si   = statusInfo(c.statusCode);
    const name = c.courierName || `#${c.courierId}`;
    const av   = avClass(name);
    const init = avInit(name);

    const finPct = ((c.finishedTasks   || 0) / maxFinished)   * 100;
    const delPct = ((c.deliveringTasks || 0) / maxDelivering) * 100;
    const canPct = ((c.canceledTasks   || 0) / maxCanceled)   * 100;
    const hrPct  = ((c.onlineHours     || 0) / maxHours)      * 100;

    const finColor = '#22c55e';
    const delColor = '#f97316';
    const canColor = '#ef4444';
    const hrColor  = '#3b82f6';

    return `<tr style="animation:fadeInUp .2s ease ${Math.min(i * 12, 300)}ms both">
      <td>
        <div class="courier-name-cell">
          <div class="mini-avatar ${av}">${init}</div>
          <div>
            <div class="name-text">${escHtml(name)}</div>
            <div style="font-size:10px;color:var(--text-muted);font-family:var(--font-mono)">#${c.courierId}</div>
          </div>
        </div>
      </td>
      <td class="bar-cell">
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill" style="width:${finPct.toFixed(1)}%;background:${finColor}"></div></div>
          <span class="bar-val" style="color:${finColor}">${c.finishedTasks || 0}</span>
        </div>
      </td>
      <td class="bar-cell">
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill" style="width:${delPct.toFixed(1)}%;background:${delColor}"></div></div>
          <span class="bar-val" style="color:${delColor}">${c.deliveringTasks || 0}</span>
        </div>
      </td>
      <td class="bar-cell">
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill" style="width:${canPct.toFixed(1)}%;background:${canColor}"></div></div>
          <span class="bar-val" style="color:${canColor}">${c.canceledTasks || 0}</span>
        </div>
      </td>
      <td class="bar-cell">
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill" style="width:${hrPct.toFixed(1)}%;background:${hrColor}"></div></div>
          <span class="bar-val" style="color:${hrColor}">${(c.onlineHours || 0).toFixed(2)}</span>
        </div>
      </td>
      <td>
        <span class="badge ${si.cls}">${si.label}</span>
      </td>
    </tr>`;
  }).join('');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── SORT HEADER INDICATORS ──────────────────────────────
function updateSortHeaders() {
  document.querySelectorAll('.couriers-table th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

// ── CSV EXPORT ─────────────────────────────────────────
function exportCSV(dateStr) {
  const rows = [
    ['المعرّف', 'الاسم', 'الفرع', 'التاريخ', 'مكتملة', 'نشطة', 'ملغاة', 'ساعات الاتصال', 'كود الحالة'],
    ...filteredList.map(c => [
      c.courierId, c.courierName, c.orgId, c.date,
      c.finishedTasks, c.deliveringTasks, c.canceledTasks,
      (c.onlineHours || 0).toFixed(4), c.statusCode,
    ]),
  ];
  const csv = '\uFEFF' + rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `keeta-stats-AllBranches-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── LOAD FLOW ──────────────────────────────────────────
async function loadStats() {
  const date  = document.getElementById('dateInput').value.trim();

  if (!date) {
    toast('يرجى تحديد التاريخ', 'error');
    return;
  }

  // Show loading
  document.getElementById('pagePlaceholder').style.display = 'none';
  document.getElementById('pageLoading').style.display     = 'flex';
  document.getElementById('dataArea').style.display        = 'none';
  document.getElementById('btnExport').style.display       = 'none';

  const btn = document.getElementById('btnLoad');
  btn.disabled = true;

  try {
    const orgIds = [2960];
    const results = await Promise.all(orgIds.map(id => fetchStats(id, date)));
    const validResults = results.filter(d => d);

    if (!validResults.length) {
      document.getElementById('pageLoading').style.display = 'none';
      document.getElementById('pagePlaceholder').style.display = 'flex';
      document.getElementById('pagePlaceholder').querySelector('.page-empty-title').textContent = 'لا توجد بيانات';
      document.getElementById('pagePlaceholder').querySelector('.page-empty-sub').textContent =
        `لم يتم العثور على سجلات لتاريخ ${date}.`;
      document.getElementById('pagePlaceholder').querySelector('.page-empty-icon').textContent = '🔍';
      toast('لا توجد بيانات لهذا التاريخ', 'error');
      return;
    }

    rawCouriers = [];
    const aggData = {
      totalCouriers: 0, totalFinished: 0, totalDelivering: 0, totalCanceled: 0, totalOnlineHours: 0
    };

    for (const data of validResults) {
      aggData.totalCouriers += data.totalCouriers || 0;
      aggData.totalFinished += data.totalFinished || 0;
      aggData.totalDelivering += data.totalDelivering || 0;
      aggData.totalCanceled += data.totalCanceled || 0;
      aggData.totalOnlineHours += data.totalOnlineHours || 0;

      const branchCouriers = Array.isArray(data.couriers) ? data.couriers : [];
      rawCouriers.push(...branchCouriers);
    }

    renderSummary(aggData);
    renderTable();
    updateSortHeaders();

    document.getElementById('pageLoading').style.display = 'none';
    const da = document.getElementById('dataArea');
    da.style.display = 'flex';
    document.getElementById('btnExport').style.display = '';

    // Store data ref for CSV export
    document.getElementById('btnExport').onclick = () => exportCSV(date);

    toast(`تم تحميل ${rawCouriers.length} سائق بنجاح`, 'success');

  } catch (err) {
    console.error('[Keeta Stats]', err);
    document.getElementById('pageLoading').style.display = 'none';
    document.getElementById('pagePlaceholder').style.display = 'flex';
    document.getElementById('pagePlaceholder').querySelector('.page-empty-icon').textContent = '⚠️';
    document.getElementById('pagePlaceholder').querySelector('.page-empty-title').textContent = 'فشل التحميل';
    document.getElementById('pagePlaceholder').querySelector('.page-empty-sub').textContent = err.message;
    toast(`خطأ: ${err.message}`, 'error', 7000);
  } finally {
    btn.disabled = false;
  }
}

// ── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today in local time
  const today = new Date();
  const yyyy  = today.getFullYear();
  const mm    = String(today.getMonth() + 1).padStart(2, '0');
  const dd    = String(today.getDate()).padStart(2, '0');
  document.getElementById('dateInput').value = `${yyyy}-${mm}-${dd}`;

  applyTheme();

  // Theme toggle
  document.getElementById('btnTheme').addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('keeta_theme', currentTheme);
    applyTheme();
  });

  // Load button
  document.getElementById('btnLoad').addEventListener('click', loadStats);

  // Also load on Enter in date field
  document.getElementById('dateInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') loadStats();
  });

  // Table search
  document.getElementById('tblSearch').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    renderTable();
  });

  // Sortable column headers
  document.querySelectorAll('.couriers-table th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = col === 'name' ? 'asc' : 'desc';
      }
      updateSortHeaders();
      renderTable();
    });
  });

  // Load stats initially
  loadStats();
});
