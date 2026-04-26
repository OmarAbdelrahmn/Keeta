'use strict';

/* ═══════════════════════════════════════════════════════
   KEETA COURIER DASHBOARD — dashboard.js v1.0
   Endpoint: POST /api/partner/dispatch/admin/queryCourierByCondition
   ═══════════════════════════════════════════════════════ */

const API_ENDPOINT = 'https://courier.mykeeta.com/api/partner/dispatch/admin/queryCourierByCondition?yodaReady=h5&csecplatform=4&csecversion=3.4.0';
const DETAIL_ENDPOINT = 'https://courier.mykeeta.com/api/partner/dispatch/admin/queryTaskOrCourierDetail?yodaReady=h5&csecplatform=4&csecversion=3.4.0';

const REFRESH_MS = 30_000;

let ORG_ID   = 2960;
let ORG_TYPE = 24;
// ── COURIER STATUS CODES ───────────────────────────────
// 10 = Free / Online (hidden from UI — treated as offline)
// 20 = Going / No Order (بدون طلب) — rider is online but has no active order
// 30 = Delivering (يوصل) — rider has an active order
// 40 = Offline / Break (غير متصل)

const STATUS_MAP = {
  10: 'free',
  20: 'going',
  30: 'delivering',
  40: 'offline',
};

const STATUS_BADGE = {
  free: 'badge-offline',       // status 10 hidden; shown as offline
  going: 'badge-going',        // بدون طلب (no order)
  delivering: 'badge-delivering', // يوصل (has order)
  offline: 'badge-offline',
};

// ── STATE ──────────────────────────────────────────────
let allCouriers = [];
let filteredCouriers = [];
let currentFilter = 'all';
let selectedId = null;
let refreshTimer = null;
let prevStatuses = {};
let searchQuery = '';
let sortBy = 'name';
let isLoading = false;
let currentPage = 'dashboard';
let leafletMap = null;
let mapTileLayer = null;
let mapMarkers = [];
let currentBranch = { id: 2960, type: 24 };
let currentLang = localStorage.getItem('keeta_lang') || 'ar';
let currentTheme = localStorage.getItem('keeta_theme') || 'dark';

// ── BRANCH FILTER ──────────────────────────────────────
function switchBranch(orgId, orgType, btn) {
  ORG_ID   = orgId;
  ORG_TYPE = orgType;
  currentBranch = { id: orgId, type: orgType };

  document.querySelectorAll('.branch-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  // Reset courier state
  allCouriers    = [];
  filteredCouriers = [];
  prevStatuses   = {};
  selectedId     = null;
  document.getElementById('courierDetail').style.display = 'none';
  document.getElementById('emptyState').style.display    = 'flex';
  document.querySelectorAll('.courier-card').forEach(c => c.classList.remove('selected'));

  stopKeetaSender();
  loadCouriers().then(() => setTimeout(startKeetaSender, 1000));
}

// ── TRANSLATIONS ───────────────────────────────────────
const STRINGS = {
  ar: {
    brand_title: 'لوحة تحكم كيتا', brand_sub: 'Keeta Courier Live Ops',
    nav_dashboard: '🏠 الرئيسية', nav_map: '🗺 الخريطة',
    // stat_free removed from header
    stat_going: 'بدون طلب', stat_delivering: 'يوصل',
    stat_timeout: '⏰ متأخر', stat_all: 'الكل',
    last_update_label: 'آخر تحديث', live: 'مباشر', auto_refresh: 'تحديث تلقائي',
    filter_all: 'الكل',
    // filter_free removed
    filter_going: 'بدون طلب',
    filter_delivering: 'يوصل', filter_timeout: '⏰ متأخر', filter_offline: 'غير متصل',
    sort_label: 'ترتيب:', sort_name: 'الاسم', sort_status: 'الحالة',
    sort_finished: 'التوصيلات', sort_online: 'وقت الاتصال',
    search_placeholder: 'بحث بالاسم أو الهاتف...',
    cp_title: 'أداء الأسطول الإجمالي', cp_sub: 'Keeta · لوحة التحكم المباشرة',
    cp_timeout_alert: 'تنبيه: سائقون لديهم طلبات متأخرة —',
    cp_status_section: 'حالة السائقين',
    // cp_free_lbl removed
    cp_going_lbl: 'بدون طلب', cp_delivering_lbl: 'يوصل',
    cp_timeout_lbl: 'لديه طلب متأخر', cp_offline_lbl: 'غير متصل',
    cp_deliveries_section: 'إجمالي التوصيلات',
    cp_finished_lbl: 'مكتملة', cp_active_lbl: 'نشطة الآن',
    cp_canceled_lbl: 'ملغاة', cp_online_hrs_lbl: 'إجمالي ساعات الاتصال',
    cp_footer_hint: 'انقر على أي سائق من القائمة لعرض تفاصيله الكاملة',
    tab_overview: 'نظرة عامة', tab_shifts: 'الورديات', tab_location: 'الموقع',
    ds_delivering: 'نشطة', ds_finished: 'مكتملة', ds_canceled: 'ملغاة', ds_online_time: 'وقت الاتصال',
    shift_col_area: 'منطقة العمل', shift_col_start: 'البداية', shift_col_end: 'النهاية',
    shift_col_scheduled: 'مجدولة', shift_col_status: 'الحالة',
    shift_scheduled_yes: '✅ مجدول', shift_scheduled_no: '—',
    shift_active: 'نشطة 🟢', shift_upcoming: 'قادمة', shift_past: 'منتهية',
    map_title: '🗺 خريطة السائقين المباشرة',
    // map_free removed; map_going is now "بدون طلب" in green
    map_going: 'بدون طلب', map_delivering: 'يوصل',
    map_timeout: 'متأخر', map_total: 'الإجمالي:', map_driver: 'سائق',
    map_error: 'تعذر تحميل مكتبة الخرائط',
    map_error_sub: 'ضع ملفات Leaflet في مجلد libs/ داخل الإضافة (leaflet.js و leaflet.css)',
    loading: 'جاري التحميل...', no_data: 'لا يوجد سائقون مطابقون',
    load_fail: '⚠ فشل التحميل', login_hint: 'تأكد من تسجيل الدخول في الموقع',
    toast_loaded: 'تم تحميل', toast_couriers: 'سائق',
    toast_fail: 'فشل تحميل البيانات', toast_auto_on: 'تحديث تلقائي كل 30 ثانية',
    toast_auto_off: 'تم إيقاف التحديث التلقائي',
    hour_lbl: 'س', min_lbl: 'د', less_min: '< دقيقة',
    // status_free removed from display; going = بدون طلب
    status_free: 'غير متصل',
    status_going: 'بدون طلب', status_delivering: 'يوصل',
    status_offline: 'غير متصل', status_timeout: 'متأخر',
    theme_light: '☀️ فاتح', theme_dark: '🌙 داكن', lang_toggle: 'EN',
    card_basic: 'معلومات السائق', card_deliveries: 'التوصيلات', card_location: 'الموقع الحالي',
    lbl_phone: 'الهاتف', lbl_license: 'رقم الرخصة', lbl_vehicle: 'نوع المركبة',
    lbl_online_time: 'وقت الاتصال', lbl_status: 'الحالة الحالية',
    lbl_timeout: 'طلب متأخر', yes: 'نعم ⚠️', no: 'لا',
    lbl_lat: 'خط العرض', lbl_lng: 'خط الطول', lbl_updated: 'آخر تحديث',
    open_map: '🗺 فتح في خرائط جوجل',
    no_shifts: 'لا توجد ورديات',
  },
  en: {
    brand_title: 'Keeta Dashboard', brand_sub: 'Keeta Courier Live Ops',
    nav_dashboard: '🏠 Dashboard', nav_map: '🗺 Map',
    // stat_free removed from header
    stat_going: 'No Order', stat_delivering: 'Delivering',
    stat_timeout: '⏰ Late', stat_all: 'All',
    last_update_label: 'Last Update', live: 'Live', auto_refresh: 'Auto Refresh',
    filter_all: 'All',
    // filter_free removed
    filter_going: 'No Order',
    filter_delivering: 'Delivering', filter_timeout: '⏰ Late', filter_offline: 'Offline',
    sort_label: 'Sort:', sort_name: 'Name', sort_status: 'Status',
    sort_finished: 'Deliveries', sort_online: 'Online Time',
    search_placeholder: 'Search by name or phone...',
    cp_title: 'Fleet Overview', cp_sub: 'Keeta · Live Control Panel',
    cp_timeout_alert: 'Alert: Couriers with timeout orders —',
    cp_status_section: 'Courier Status',
    // cp_free_lbl removed
    cp_going_lbl: 'No Order', cp_delivering_lbl: 'Delivering',
    cp_timeout_lbl: 'Has Timeout Order', cp_offline_lbl: 'Offline',
    cp_deliveries_section: 'Total Deliveries',
    cp_finished_lbl: 'Completed', cp_active_lbl: 'Active Now',
    cp_canceled_lbl: 'Cancelled', cp_online_hrs_lbl: 'Total Online Hours',
    cp_footer_hint: 'Click any courier in the list to view full details',
    tab_overview: 'Overview', tab_shifts: 'Shifts', tab_location: 'Location',
    ds_delivering: 'Active', ds_finished: 'Completed', ds_canceled: 'Cancelled', ds_online_time: 'Online Time',
    shift_col_area: 'Work Area', shift_col_start: 'Start', shift_col_end: 'End',
    shift_col_scheduled: 'Scheduled', shift_col_status: 'Status',
    shift_scheduled_yes: '✅ Scheduled', shift_scheduled_no: '—',
    shift_active: 'Active 🟢', shift_upcoming: 'Upcoming', shift_past: 'Past',
    map_title: '🗺 Live Courier Map',
    // map_free removed; map_going is now "No Order" in green
    map_going: 'No Order', map_delivering: 'Delivering',
    map_timeout: 'Late', map_total: 'Total on map:', map_driver: 'couriers',
    map_error: 'Failed to load map library',
    map_error_sub: 'Place Leaflet files inside libs/ folder of the extension',
    loading: 'Loading...', no_data: 'No matching couriers',
    load_fail: '⚠ Load Failed', login_hint: 'Make sure you are logged in',
    toast_loaded: 'Loaded', toast_couriers: 'couriers',
    toast_fail: 'Failed to load data', toast_auto_on: 'Auto-refresh every 30 seconds',
    toast_auto_off: 'Auto-refresh disabled',
    hour_lbl: 'h', min_lbl: 'm', less_min: '< 1 min',
    // status_free hidden; going = No Order
    status_free: 'Offline',
    status_going: 'No Order', status_delivering: 'Delivering',
    status_offline: 'Offline', status_timeout: 'Late',
    theme_light: '☀️ Light', theme_dark: '🌙 Dark', lang_toggle: 'ع',
    card_basic: 'Courier Info', card_deliveries: 'Deliveries', card_location: 'Current Location',
    lbl_phone: 'Phone', lbl_license: 'License No.', lbl_vehicle: 'Vehicle Type',
    lbl_online_time: 'Online Time', lbl_status: 'Current Status',
    lbl_timeout: 'Timeout Order', yes: 'Yes ⚠️', no: 'No',
    lbl_lat: 'Latitude', lbl_lng: 'Longitude', lbl_updated: 'Last Updated',
    open_map: '🗺 Open in Google Maps',
    no_shifts: 'No shifts available',
  },
};

function t(key) {
  return (STRINGS[currentLang] && STRINGS[currentLang][key]) ||
    (STRINGS['ar'][key]) || key;
}

// ── VEHICLE TYPES ──────────────────────────────────────
const VEHICLE_LABEL = { 1: 'دراجة', 2: 'سيارة', 3: 'دراجة نارية', 4: 'دراجة كهربائية' };
function vehicleLabel(type) {
  return VEHICLE_LABEL[type] || `نوع ${type}`;
}

// ── IRREGULAR STATUS WARNINGS ──────────────────────────
// Known codes in irregularStatusInterveneCount:
//   "50" → rider rejected orders
//   "30" → failed to load location
const IRREGULAR_LABEL = {
  ar: { '50': 'رفض الطلب', '30': 'فشل تحميل الموقع' },
  en: { '50': 'Rejected Orders', '30': 'Location Failure' },
};

function getIrregularWarnings(c) {
  // Returns array of { code, label, count } for any non-zero irregular counts
  const map = c.irregularStatusInterveneCount;
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map)
    .filter(([, count]) => count > 0)
    .map(([code, count]) => ({
      code,
      count,
      label: (IRREGULAR_LABEL[currentLang] || IRREGULAR_LABEL.ar)[code]
        || (currentLang === 'ar' ? `حالة ${code}` : `Code ${code}`),
    }));
}

function hasIrregularWarnings(c) {
  return getIrregularWarnings(c).length > 0;
}

// ── HELPERS ────────────────────────────────────────────
function courierStatus(c) {
  return STATUS_MAP[c.courierStatus] || 'offline';
}

function isTimeout(c) {
  if (courierStatus(c) !== 'offline') return false;
  const now = Date.now();
  const shifts = c.shiftTimeRange || [];
  return shifts.some(s => s.startTime <= now && s.endTime >= now);
}

function courierFullName(c) {
  return `${c.courierFirstName || ''} ${c.courierLastName || ''}`.trim() || `#${c.courierId}`;
}

function avatarClass(name) {
  return `av-${(name.charCodeAt(0) || 0) % 5}`;
}

function avatarInitial(name) {
  return (name || '?').charAt(0).toUpperCase();
}

function formatMs(ms) {
  if (!ms || ms === 0) return `0 ${t('min_lbl')}`;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const parts = [];
  if (h) parts.push(`${h}${t('hour_lbl')}`);
  if (m) parts.push(`${m}${t('min_lbl')}`);
  return parts.join(' ') || t('less_min');
}

function formatTs(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-GB',
    { hour: '2-digit', minute: '2-digit' });
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '—';
}

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

function playNotif() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!window._keetaAudioCtx) window._keetaAudioCtx = new Ctx();
    const ctx = window._keetaAudioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.8, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch (_) { }
}

// ── API ────────────────────────────────────────────────
class AuthError extends Error {
  constructor(msg) { super(msg); this.name = 'AuthError'; }
}

async function apiPost(url, body) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'API_FETCH', url, method: 'POST', body },
      resp => {
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
        if (!resp) { reject(new Error('No response')); return; }
        if (resp.error === 'NO_TAB') {
          reject(new Error('يرجى فتح https://courier.mykeeta.com في أحد التبويبات أولاً'));
          return;
        }
        if (resp.error === 'AUTH_REQUIRED') { reject(new AuthError('جلسة العمل منتهية — يرجى تسجيل الدخول في الموقع')); return; }
        if (resp.error) { reject(new Error(resp.error)); return; }
        resolve(resp.data);
      }
    );
  });
}

async function fetchAllCouriers() {
  let allContent  = [];
  let coordinates = [];
  let pageNum     = 1;
  let totalPages  = 1;

  do {
    const body = {
      sortField:        0,
      pageSize:         30,
      pageNum:          pageNum,
      capacityTypeList: [2],
      orgId:            ORG_ID,
      orgType:          ORG_TYPE,
      source:           0,
    };

    const resp = await apiPost(API_ENDPOINT, body);

    if (!resp || resp.code !== 0) {
      throw new Error(`API error code ${resp?.code}: ${resp?.msg || 'unknown'}`);
    }

    const { allCourierCoordinate, pageCourierInfo } = resp.data;

    if (pageNum === 1 && allCourierCoordinate) {
      coordinates = allCourierCoordinate;
    }

    const pc = pageCourierInfo?.pageContent || [];
    allContent.push(...pc);

    const page = pageCourierInfo?.page || {};
    totalPages = page.totalPageCount || page.pages || 1;

    if (pageNum >= 20) break;
    pageNum++;

  } while (pageNum <= totalPages);

  const coordMap = new Map(coordinates.map(c => [c.courierId, c]));

  return allContent.map(c => {
    const coord = coordMap.get(c.courierId) || {};
    return {
      ...c,
      lat: coord.lat || c.courierLat,
      lng: coord.lng || c.courierLng,
      locationUpdateTime: coord.latestUpdateTime || null,
      coordinateStatus:   coord.courierStatus,
    };
  });
}

// ── STATS ──────────────────────────────────────────────
function computeStats(couriers) {
  const s = {
    // free (status 10) merged into offline — not tracked separately
    going: 0, delivering: 0, offline: 0, timeout: 0,
    totalFinished: 0, totalActive: 0, totalCanceled: 0, totalOnlineMs: 0,
    total: couriers.length
  };
  couriers.forEach(c => {
    const st = courierStatus(c);
    if (st === 'going') s.going++;
    else if (st === 'delivering') s.delivering++;
    else s.offline++;          // free (10) and offline (40) both count as offline
    if (isTimeout(c)) s.timeout++;
    s.totalFinished += c.finishedTaskCount || 0;
    s.totalActive += c.deliveryingTaskCount || 0;
    s.totalCanceled += c.canceledTaskCount || 0;
    s.totalOnlineMs += c.courierOnlineTime || 0;
  });
  return s;
}

// ── RENDER COMPANY STATS ───────────────────────────────
function renderCompanyStats(stats) {
  // cp-free element removed from HTML; cp-going now represents "بدون طلب"
  setText('cp-going', stats.going);
  setText('cp-delivering', stats.delivering);
  setText('cp-timeout', stats.timeout);
  setText('cp-offline', stats.offline);
  setText('cp-totalFinished', stats.totalFinished);
  setText('cp-totalActive', stats.totalActive);
  setText('cp-totalCanceled', stats.totalCanceled);

  const totalHrs = (stats.totalOnlineMs / 3_600_000).toFixed(1);
  setText('cp-totalOnlineHrs', `${totalHrs} ${t('hour_lbl')}`);

  const banner = document.getElementById('cpTimeoutBanner');
  if (banner) {
    banner.style.display = stats.timeout > 0 ? 'flex' : 'none';
    setText('cp-timeoutCount', stats.timeout);
  }

  const spinner = document.getElementById('cpLoadingSpinner');
  if (spinner) spinner.style.display = 'none';
}

function updateHeaderStats(couriers) {
  const s = computeStats(couriers);
  // stat-free element removed from HTML
  setText('stat-going', s.going);
  setText('stat-delivering', s.delivering);
  setText('stat-timeout', s.timeout);
  setText('stat-total', s.total);
  return s;
}

// ── COURIER LIST ───────────────────────────────────────
function buildCourierCard(c) {
  const st = courierStatus(c);
  const timeout = isTimeout(c);
  const name = courierFullName(c);
  const avCls = avatarClass(name);
  const selected = c.courierId === selectedId;
  const badgeCls = timeout ? 'badge-timeout' : (STATUS_BADGE[st] || 'badge-offline');
  const cardCls = `courier-card${timeout ? ' timeout-card' : ''}${selected ? ' selected' : ''}`;
  const statusLbl = timeout ? t('status_timeout') : (t(`status_${st}`) || st);

  const card = document.createElement('div');
  card.className = cardCls;
  card.dataset.id = c.courierId;

  const imgHtml = c.courierPictureUrl
    ? `<img src="${c.courierPictureUrl}" alt="" loading="lazy" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
    : '';
  const fallback = imgHtml
    ? `<span style="display:none">${avatarInitial(name)}</span>`
    : avatarInitial(name);

  const warnings = getIrregularWarnings(c);
  const warningHtml = warnings.length
    ? `<div class="courier-card-warnings">${
        warnings.map(w =>
          `<span class="irregular-pill" title="${w.label}">
            ⚠ ${w.label} (${w.count})
          </span>`
        ).join('')
      }</div>`
    : '';

  card.innerHTML = `
    ${timeout ? '<div class="timeout-indicator"></div>' : ''}
    <div class="courier-avatar ${avCls}">${imgHtml}${fallback}</div>
    <div class="courier-card-info">
      <div class="courier-card-name">${name}</div>
      <div class="courier-card-sub">
        ${c.courierLicenseNumber || '—'} · +${c.courierCountryCode || ''}${c.courierPhoneNumber || ''}
      </div>
      ${warningHtml}
    </div>
    <div class="courier-card-meta">
      <span class="badge ${badgeCls}">${statusLbl}</span>
      <span class="deliveries-mini">✅${c.finishedTaskCount || 0} 🚚${c.deliveryingTaskCount || 0}</span>
    </div>`;

  card.addEventListener('click', () => selectCourier(c.courierId));
  return card;
}

function renderCourierList() {
  const list = document.getElementById('courierList');
  list.innerHTML = '';
  if (!filteredCouriers.length) {
    list.innerHTML = `<div class="no-data">${t('no_data')}</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  filteredCouriers.forEach((c, i) => {
    const card = buildCourierCard(c);
    card.style.animationDelay = `${Math.min(i * 18, 400)}ms`;
    frag.appendChild(card);
  });
  list.appendChild(frag);
}

function applyFiltersAndSort() {
  let list = [...allCouriers];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c =>
      courierFullName(c).toLowerCase().includes(q) ||
      (c.courierPhoneNumber || '').includes(q) ||
      String(c.courierId).includes(q) ||
      (c.courierLicenseNumber || '').toLowerCase().includes(q)
    );
  }

  switch (currentFilter) {
    case 'timeout':
      list = list.filter(c => isTimeout(c));
      break;
    case 'all':
      break;
    default:
      list = list.filter(c => courierStatus(c) === currentFilter);
  }

  list.sort((a, b) => {
    switch (sortBy) {
      case 'name': return courierFullName(a).localeCompare(courierFullName(b), currentLang);
      case 'status': return courierStatus(a).localeCompare(courierStatus(b));
      case 'finished': return (b.finishedTaskCount || 0) - (a.finishedTaskCount || 0);
      case 'online': return (b.courierOnlineTime || 0) - (a.courierOnlineTime || 0);
      default: return 0;
    }
  });

  // Timeout couriers bubble to top
  if (currentFilter === 'all') {
    list.sort((a, b) => (isTimeout(b) ? 1 : 0) - (isTimeout(a) ? 1 : 0));
  }

  filteredCouriers = list;
  renderCourierList();
}

// ── LOAD COURIERS ──────────────────────────────────────
async function loadCouriers(silent = false) {
  if (isLoading) return;
  isLoading = true;

  const btn = document.getElementById('btnRefresh');
  if (btn) btn.classList.add('spinning');

  if (!silent) {
    document.getElementById('courierList').innerHTML = `
      <div class="loading-state"><div class="spinner"></div><p>${t('loading')}</p></div>`;
  }

  try {
    allCouriers = await fetchAllCouriers();

    if (Object.keys(prevStatuses).length > 0) {
      let changed = false;
      allCouriers.forEach(c => {
        const id = c.courierId;
        const nst = courierStatus(c);
        const ost = prevStatuses[id];
        if (ost && ost !== nst) {
          changed = true;
          const name = courierFullName(c);
          const oLbl = t(`status_${ost}`) || ost;
          const nLbl = t(`status_${nst}`) || nst;
          const msg = currentLang === 'ar'
            ? `${name}: ${oLbl} ← ${nLbl}`
            : `${name}: ${oLbl} → ${nLbl}`;
          toast(msg, 'info', 8000);
        }
        prevStatuses[id] = nst;
      });
      if (changed) playNotif();
    } else {
      allCouriers.forEach(c => { prevStatuses[c.courierId] = courierStatus(c); });
    }

    const stats = updateHeaderStats(allCouriers);
    applyFiltersAndSort();
    renderCompanyStats(stats);
    setText('lastUpdate', new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-GB'));

    if (!silent) toast(`${t('toast_loaded')} ${allCouriers.length} ${t('toast_couriers')}`, 'success');

  } catch (err) {
    console.error('loadCouriers:', err);
    if (!silent) {
      const isAuth = err instanceof AuthError || err.message.includes('تسجيل الدخول') || err.message.includes('جلسة');
      document.getElementById('courierList').innerHTML = `
        <div class="no-data">
          ${isAuth
          ? `🔐 <b>انتهت جلسة العمل</b><br>
               <small>افتح <a href="https://courier.mykeeta.com" target="_blank"
               style="color:var(--cyan)">courier.mykeeta.com</a> وسجّل الدخول، ثم حدّث اللوحة.</small>`
          : `${t('load_fail')}<br><small>${err.message}</small><br><br>
               <small>${t('login_hint')}</small>`
        }
        </div>`;
      toast(isAuth ? '🔐 جلسة العمل منتهية' : t('toast_fail'), 'error', 8000);
    }
  } finally {
    isLoading = false;
    if (btn) btn.classList.remove('spinning');
  }
}

async function fetchCourierDetail(courier) {
  const body = {
    taskId:        "",
    courierId:     String(courier.courierId),
    currentShift:  null,
    orgId:         ORG_ID,
    orgType:       ORG_TYPE,
    shiftTimeRange: (courier.shiftTimeRange || []).map(s => ({
      underSchedule: s.underSchedule,
      startTime:     s.startTime,
      endTime:       s.endTime,
      shiftAreaId:   s.shiftAreaId,
    })),
    source: 0,
  };
  return await apiPost(DETAIL_ENDPOINT, body);
}

async function selectCourier(id) {
  selectedId = id;

  document.querySelectorAll('.courier-card').forEach(c =>
    c.classList.toggle('selected', c.dataset.id === String(id))
  );

  document.getElementById('emptyState').style.display    = 'none';
  document.getElementById('courierDetail').style.display = 'flex';

  const panel = document.getElementById('detailPanel');
  if (panel) panel.scrollTop = 0;

  switchTab('overview');

  const courier = allCouriers.find(c => c.courierId === id);
  if (!courier) return;

  renderDetailHeader(courier);
  renderOverviewTab(courier);
  renderShiftsTab(courier);
  renderLocationTab(courier);

  try {
    const detail = await fetchCourierDetail(courier);
    console.log('[Keeta] detail response:', detail);
    if (detail?.code === 0 && detail?.data) {
      Object.assign(courier, detail.data);
      renderDetailHeader(courier);
      renderOverviewTab(courier);
      renderShiftsTab(courier);
      renderLocationTab(courier);
    }
  } catch(e) {
    console.warn('[Keeta] detail fetch failed:', e.message);
  }
}

// ── RENDER DETAIL ──────────────────────────────────────
function renderDetailHeader(c) {
  const st = courierStatus(c);
  const timeout = isTimeout(c);
  const name = courierFullName(c);
  const avCls = avatarClass(name);

  const avEl = document.getElementById('detailAvatar');
  avEl.className = `detail-avatar ${avCls}`;
  if (c.courierPictureUrl) {
    avEl.innerHTML = `<img src="${c.courierPictureUrl}" alt="" onerror="this.style.display='none'">`;
  } else {
    avEl.textContent = avatarInitial(name);
  }

  setText('detailName', name);

  const badge = document.getElementById('detailStatusBadge');
  const displaySt = timeout ? 'timeout' : st;
  badge.textContent = t(`status_${displaySt}`) || displaySt;
  badge.className = `status-badge ${timeout ? 'badge-timeout' : (STATUS_BADGE[st] || 'badge-offline')}`;

  setText('detailPhone', `📞 +${c.courierCountryCode || ''}${c.courierPhoneNumber || '—'}`);
  setText('detailLicense', `🪪 ${c.courierLicenseNumber || '—'}`);

  const activeShift = (c.shiftTimeRange || []).find(s => s.underSchedule);
  setText('detailArea', `📍 ${activeShift?.shiftAreaName || '—'}`);
}

function renderOverviewTab(c) {
  setText('ds-delivering', c.deliveryingTaskCount || 0);
  setText('ds-finished', c.finishedTaskCount || 0);
  setText('ds-canceled', c.canceledTaskCount || 0);
  setText('ds-onlineTime', formatMs(c.courierOnlineTime));

  const container = document.getElementById('overviewCards');
  container.innerHTML = '';

  // ── Basic Info Card ──
  const basicCard = document.createElement('div');
  basicCard.className = 'info-card';
  const st = courierStatus(c);
  const timeout = isTimeout(c);
  basicCard.innerHTML = `
    <div class="card-header">
      <span class="card-icon">👤</span>
      <h3>${t('card_basic')}</h3>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_phone')}</span>
      <span class="info-val">+${c.courierCountryCode || ''}${c.courierPhoneNumber || '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_license')}</span>
      <span class="info-val">${c.courierLicenseNumber || '—'}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_vehicle')}</span>
      <span class="info-val">${vehicleLabel(c.courierVehicleType)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_online_time')}</span>
      <span class="info-val accent">${formatMs(c.courierOnlineTime)}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_status')}</span>
      <span class="info-val"><span class="badge ${timeout ? 'badge-timeout' : (STATUS_BADGE[st] || 'badge-offline')}">${t(`status_${timeout ? 'timeout' : st}`) || st}</span></span>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_timeout')}</span>
      <span class="info-val" style="color:${timeout ? 'var(--red)' : 'var(--green)'}">${timeout ? t('yes') : t('no')}</span>
    </div>`;
  container.appendChild(basicCard);

  // ── Active Shift Card ──
  const activeShift = (c.shiftTimeRange || []).find(s => s.underSchedule);
  const allShifts = c.shiftTimeRange || [];
  if (allShifts.length) {
    const shiftCard = document.createElement('div');
    shiftCard.className = 'info-card';
    const upcoming = allShifts.filter(s => !s.underSchedule);
    shiftCard.innerHTML = `
      <div class="card-header">
        <span class="card-icon">⏰</span>
        <h3>${t('tab_shifts')}</h3>
      </div>
      ${activeShift ? `
        <div class="info-row">
          <span class="info-label">📍 ${t('shift_col_area')}</span>
          <span class="info-val accent">${activeShift.shiftAreaName || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${t('shift_col_start')}</span>
          <span class="info-val">${formatTime(activeShift.startTime)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${t('shift_col_end')}</span>
          <span class="info-val">${formatTime(activeShift.endTime)}</span>
        </div>
      ` : '<div style="color:var(--text-muted);font-size:12px;padding:8px 0">لا توجد وردية نشطة حالياً</div>'}
      ${upcoming.length ? `<div style="font-size:11px;color:var(--text-muted);margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
        ${upcoming.length} ${currentLang === 'ar' ? 'وردية قادمة' : 'upcoming shift(s)'}
      </div>` : ''}`;
    container.appendChild(shiftCard);
  }

  // ── Deliveries Card ──
  const delCard = document.createElement('div');
  delCard.className = 'info-card';
  delCard.innerHTML = `
    <div class="card-header">
      <span class="card-icon">📦</span>
      <h3>${t('card_deliveries')}</h3>
    </div>
    <div class="info-row">
      <span class="info-label">🚚 ${t('ds_delivering')}</span>
      <span class="info-val" style="color:var(--orange)">${c.deliveryingTaskCount || 0}</span>
    </div>
    <div class="info-row">
      <span class="info-label">✅ ${t('ds_finished')}</span>
      <span class="info-val" style="color:var(--green)">${c.finishedTaskCount || 0}</span>
    </div>
    <div class="info-row">
      <span class="info-label">❌ ${t('ds_canceled')}</span>
      <span class="info-val" style="color:var(--red)">${c.canceledTaskCount || 0}</span>
    </div>`;
  container.appendChild(delCard);

  // ── Irregular Warnings Card ──
  const warnings = getIrregularWarnings(c);
  if (warnings.length) {
    const warnCard = document.createElement('div');
    warnCard.className = 'info-card warn-card';
    warnCard.innerHTML = `
      <div class="card-header">
        <span class="card-icon">🚨</span>
        <h3>${currentLang === 'ar' ? 'تحذيرات السلوك' : 'Behaviour Warnings'}</h3>
      </div>
      ${warnings.map(w => `
        <div class="info-row irregular-row">
          <span class="info-label irregular-label">⚠ ${w.label}</span>
          <span class="info-val irregular-count">${w.count} ${currentLang === 'ar' ? 'مرة' : 'time(s)'}</span>
        </div>`).join('')}
    `;
    container.appendChild(warnCard);
  }
}

function renderShiftsTab(c) {
  const tbody = document.getElementById('shiftsTableBody');
  if (!tbody) return;

  const shifts = c.shiftTimeRange || [];
  if (!shifts.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="no-data">${t('no_shifts')}</td></tr>`;
    return;
  }

  const now = Date.now();
  tbody.innerHTML = shifts.map(s => {
    const start = s.startTime;
    const end = s.endTime;
    const isActive = s.underSchedule;
    const isPast = end < now && !isActive;
    const isFuture = start > now && !isActive;

    const stateLabel = isActive ? t('shift_active')
      : (isFuture ? t('shift_upcoming') : t('shift_past'));
    const stateCls = isActive ? 'state-current' : (isFuture ? 'state-scheduled' : 'state-past');

    return `<tr class="${isActive ? 'active-shift' : ''}">
      <td style="font-family:var(--font-main)">${s.shiftAreaName || '—'}</td>
      <td>${formatTime(start)}</td>
      <td>${formatTime(end)}</td>
      <td>${s.underSchedule ? t('shift_scheduled_yes') : t('shift_scheduled_no')}</td>
      <td><span class="shift-state-badge ${stateCls}">${stateLabel}</span></td>
    </tr>`;
  }).join('');
}

function renderLocationTab(c) {
  const container = document.getElementById('locationCards');
  if (!container) return;
  container.innerHTML = '';

  const locCard = document.createElement('div');
  locCard.className = 'info-card';
  const lat = c.lat?.toFixed(6) || '—';
  const lng = c.lng?.toFixed(6) || '—';
  const updatedTs = c.locationUpdateTime;
  const mapUrl = (c.lat && c.lng)
    ? `https://www.google.com/maps?q=${c.lat},${c.lng}`
    : null;

  locCard.innerHTML = `
    <div class="card-header">
      <span class="card-icon">📍</span>
      <h3>${t('card_location')}</h3>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_lat')}</span>
      <span class="info-val mono">${lat}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_lng')}</span>
      <span class="info-val mono">${lng}</span>
    </div>
    <div class="info-row">
      <span class="info-label">${t('lbl_updated')}</span>
      <span class="info-val" style="font-size:11px">${updatedTs ? formatTs(updatedTs) : '—'}</span>
    </div>
    ${mapUrl ? `<a href="${mapUrl}" target="_blank"
        style="display:inline-block;margin-top:12px;padding:8px 14px;background:var(--bg-card2);
               border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--blue);
               font-size:12px;text-decoration:none;transition:all .2s;"
        onmouseover="this.style.background='var(--blue-dim)'"
        onmouseout="this.style.background='var(--bg-card2)'"
      >${t('open_map')}</a>` : ''}`;
  container.appendChild(locCard);
}

// ── TAB SWITCHING ──────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.detail-tab').forEach(t2 =>
    t2.classList.toggle('active', t2.dataset.tab === name)
  );
  document.querySelectorAll('.tab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${name}`)
  );
}

// ── PAGE NAVIGATION ────────────────────────────────────
function showPage(page) {
  currentPage = page;
  document.getElementById('dashboardPage').style.display = page === 'dashboard' ? 'flex' : 'none';
  document.getElementById('mapPage').style.display = page === 'map' ? 'flex' : 'none';
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.page === page)
  );
  if (page === 'map') {
    requestAnimationFrame(() => requestAnimationFrame(() => initMap()));
  }
}

// ── THEME & LANGUAGE ───────────────────────────────────
function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = currentTheme === 'dark' ? t('theme_light') : t('theme_dark');
  if (mapTileLayer) mapTileLayer.setUrl(tileUrl());
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('keeta_theme', currentTheme);
  applyTheme();
}

function applyLanguage() {
  const isAr = currentLang === 'ar';
  document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  const so = document.getElementById('sortSelect');
  if (so) {
    so.options[0].text = t('sort_name');
    so.options[1].text = t('sort_status');
    so.options[2].text = t('sort_finished');
    so.options[3].text = t('sort_online');
  }
  document.getElementById('btnLang').textContent = t('lang_toggle');
  applyTheme();
  if (allCouriers.length) {
    applyFiltersAndSort();
    renderCompanyStats(computeStats(allCouriers));
    if (selectedId) {
      const c = allCouriers.find(x => x.courierId === selectedId);
      if (c) renderDetailHeader(c);
    }
  }
}

function toggleLang() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('keeta_lang', currentLang);
  applyLanguage();
}

// ── MAP ────────────────────────────────────────────────
function tileUrl() {
  return currentTheme === 'light'
    ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
}

function initMap() {
  const el = document.getElementById('liveMap');
  if (!el) return;

  if (typeof L !== 'undefined') { buildMap(el); return; }

  const getUrl = (f) => chrome?.runtime?.getURL ? chrome.runtime.getURL(f) : f;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = getUrl('libs/leaflet.css');
  document.head.appendChild(link);

  const script = document.createElement('script');
  script.src = getUrl('libs/leaflet.js');
  script.onload = () => buildMap(el);
  script.onerror = () => {
    el.innerHTML = `<div class="map-error">
      <div style="font-size:40px">🗺</div>
      <div style="font-size:15px;color:var(--text-primary);font-weight:700">${t('map_error')}</div>
      <div style="font-size:12px;color:var(--text-muted);max-width:360px;line-height:1.8">${t('map_error_sub')}</div>
    </div>`;
  };
  document.head.appendChild(script);
}

function buildMap(el) {
  if (leafletMap) { try { leafletMap.remove(); } catch (_) { } leafletMap = null; mapTileLayer = null; }

  leafletMap = L.map(el, { zoomControl: true }).setView([21.4858, 39.1925], 11);

  mapTileLayer = L.tileLayer(tileUrl(), {
    attribution: '© OpenStreetMap © CARTO',
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(leafletMap);

  setTimeout(() => leafletMap?.invalidateSize(), 200);

  mapMarkers.forEach(m => { try { m.remove(); } catch (_) { } });
  mapMarkers = [];

  const activeCouriers = allCouriers.filter(c => c.lat && c.lng && courierStatus(c) !== 'offline');

  // Count going (بدون طلب) and delivering (يوصل) separately; free merged into offline
  const counts = { going: 0, delivering: 0 };
  activeCouriers.forEach(c => {
    const st = courierStatus(c);
    if (st === 'going') counts.going++;
    else if (st === 'delivering') counts.delivering++;
  });

  // Update map legend counters (map-free element removed from HTML)
  setText('map-going', counts.going);
  setText('map-delivering', counts.delivering);
  setText('map-total', activeCouriers.length);

  activeCouriers.forEach(courier => {
    const st = courierStatus(courier);
    const timeout = isTimeout(courier);

    // Color logic:
    // timeout → red
    // going (بدون طلب, no order) → green
    // delivering (يوصل, has order) → orange
    // free (status 10, hidden) → grey (same as offline, shouldn't appear often)
    const color = timeout     ? '#ef4444'
      : st === 'going'        ? '#22c55e'
      : st === 'delivering'   ? '#f97316'
      : '#6b7280';

    const emoji = st === 'delivering' ? '📦' : '🛵';

    const icon = L.divIcon({
      html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};
        border:3px solid rgba(255,255,255,.8);display:flex;align-items:center;
        justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.4);cursor:pointer;">${emoji}</div>`,
      className: '', iconSize: [32, 32], iconAnchor: [16, 16],
    });

    const name = courierFullName(courier);
    const popup = `<div dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}"
      style="font-family:'Cairo',sans-serif;min-width:200px;font-size:12px">
      <strong style="font-size:14px">${name}</strong><br>
      <span style="color:#94a3b8">${courier.courierLicenseNumber || '—'}</span><br>
      <span style="color:${color};font-weight:700">
        ${t(`status_${timeout ? 'timeout' : st}`) || st}
      </span><br>
      ✅ ${courier.finishedTaskCount || 0} · 🚚 ${courier.deliveryingTaskCount || 0}
    </div>`;

    const marker = L.marker([courier.lat, courier.lng], { icon })
      .addTo(leafletMap)
      .bindPopup(popup);
    mapMarkers.push(marker);
  });

  if (mapMarkers.length > 0) {
    try {
      const group = L.featureGroup(mapMarkers);
      leafletMap.fitBounds(group.getBounds().pad(0.1));
    } catch (_) { }
  }
}

// ── AUTO REFRESH ───────────────────────────────────────
function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    loadCouriers(true);
    if (currentPage === 'map' && leafletMap) buildMap(document.getElementById('liveMap'));
    if (selectedId) {
      const c = allCouriers.find(x => x.courierId === selectedId);
      if (c) { renderDetailHeader(c); renderOverviewTab(c); renderShiftsTab(c); renderLocationTab(c); }
    }
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

// ── KEETA STATS SENDER ─────────────────────────────────
const KEETA_STATS_API = 'https://express-extension-manager.premiumasp.net/api/keeta-stats';
const KEETA_SEND_MS   = 60_000;
let keetaSendTimer    = null;

async function sendKeetaStatsJob() {
  if (!allCouriers || !allCouriers.length) return;

  const UTC3_OFFSET_MS = 3 * 60 * 60 * 1000;
  const nowInUTC3 = new Date(Date.now() + UTC3_OFFSET_MS);
  const today = nowInUTC3.toISOString().slice(0, 10);

  const payload = allCouriers.map(c => ({
    courierId:       String(c.courierId),
    courierName:     courierFullName(c),
    orgId:           String(ORG_ID),
    date:            today,
    finishedTasks:   c.finishedTaskCount    || 0,
    deliveringTasks: c.deliveryingTaskCount || 0,
    canceledTasks:   c.canceledTaskCount    || 0,
    onlineHours:     (c.courierOnlineTime   || 0) / 3_600_000,   // ms → hours
    statusCode:      c.courierStatus        || 40,
  }));

  // ❗ FIX: DO NOT SEND IF NO COURIERS HAVE BEEN LOADED YET

  console.log('sendKeetaStatsJob payload:', payload);

  if (!payload.length) return;

  try {
    await fetch(KEETA_STATS_API, {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('sendKeetaStatsJob error:', e);
  }
}

function startKeetaSender() {
  stopKeetaSender();
  sendKeetaStatsJob();                              // immediate first send
  keetaSendTimer = setInterval(sendKeetaStatsJob, KEETA_SEND_MS);
}

function stopKeetaSender() {
  if (keetaSendTimer) { clearInterval(keetaSendTimer); keetaSendTimer = null; }
}

// ── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applyLanguage();

  loadCouriers().then(() => setTimeout(startKeetaSender, 2000));

  document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  document.getElementById('btnTheme').addEventListener('click', toggleTheme);
  document.getElementById('btnLang').addEventListener('click', toggleLang);

  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadCouriers();
    if (currentPage === 'map') buildMap(document.getElementById('liveMap'));
    if (selectedId) selectCourier(selectedId);
  });

  const toggle = document.getElementById('autoRefreshToggle');
  toggle.addEventListener('change', () => {
    if (toggle.checked) { startAutoRefresh(); toast(t('toast_auto_on'), 'info'); }
    else { stopAutoRefresh(); toast(t('toast_auto_off'), 'info'); }
  });
  if (toggle.checked) startAutoRefresh();

  const searchInput = document.getElementById('searchInput');
  const searchClear = document.getElementById('searchClear');
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value.trim();
    searchClear.style.display = searchQuery ? 'block' : 'none';
    applyFiltersAndSort();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.style.display = 'none';
    applyFiltersAndSort();
  });

  document.querySelectorAll('.filter-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.status;
      applyFiltersAndSort();
    });
  });

  document.getElementById('sortSelect').addEventListener('change', e => {
    sortBy = e.target.value;
    applyFiltersAndSort();
  });

  document.querySelectorAll('.detail-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  document.getElementById('closeDetail').addEventListener('click', () => {
    selectedId = null;
    document.getElementById('courierDetail').style.display = 'none';
    document.getElementById('emptyState').style.display = 'flex';
    document.querySelectorAll('.courier-card').forEach(c => c.classList.remove('selected'));
  });
  
  document.querySelectorAll('.branch-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const orgId   = parseInt(btn.dataset.orgId,  10);
    const orgType = parseInt(btn.dataset.orgType, 10);
    switchBranch(orgId, orgType, btn);
  });
});

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); loadCouriers(); }
    if (e.key === 'Escape') document.getElementById('closeDetail')?.click();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  });
});