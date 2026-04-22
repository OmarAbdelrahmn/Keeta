'use strict';

/* ═══════════════════════════════════════════════════════
   RIDER LIVE OPS v3.4 — DASHBOARD JS
   Fixes:
   - isLate() uses ONLY live api status==='late' (not cumulative late_seconds)
   - Map tiles are theme-aware: dark_all ↔ light_all via mapTileUrl()
   - Theme toggle hot-swaps tile URL via mapTileLayer.setUrl() — no rebuild
   - computeStatsFromRiders: no double-counting of late riders
   - Detail tabs made sticky (via .detail-sticky-top wrapper in HTML)
   - Leaflet loaded from libs/ folder (web_accessible_resources)
   ═══════════════════════════════════════════════════════ */

const KEETA_API_BASE = 'https://courier.mykeeta.net/api/partner/dispatch/admin';
const REFRESH_MS = 30_000;

// Mapping KeeTa numeric statuses to internal dashboard status strings
const KEETA_STATUS_MAP = {
  10: 'working',  // Online
  20: 'starting', // Idle / Ready
  30: 'working',  // Delivering
  40: 'offline',  // Offline
  50: 'break',    // Restricted
  60: 'late',     // Irregular / Missing
};

// ── CITIES LIST ────────────────────────────────────────
// Each entry: { id, name (EN), nameAr (AR), city_id (used in API) }
const CITIES = [
  {id:6,  name:"Jeddah",                nameAr:"جدة",                   city_id:5, orgId: 2960},
  {id:14, name:"Al Ahsa",               nameAr:"الأحساء",               city_id:7},
  {id:12, name:"Jubail",                nameAr:"الجبيل",                city_id:8},
  {id:4,  name:"Alkharj",               nameAr:"الخرج",                 city_id:3},
  {id:5,  name:"Medina",                nameAr:"المدينة المنورة",        city_id:4},
  {id:17, name:"Hail",                  nameAr:"حائل",                  city_id:201},
  {id:18, name:"Tabuk",                 nameAr:"تبوك",                  city_id:202},
  {id:19, name:"Taif",                  nameAr:"الطائف",                city_id:203},
  {id:24, name:"Yanbu",                 nameAr:"ينبع",                  city_id:208},
  {id:25, name:"Jazan",                 nameAr:"جازان",                 city_id:209},
  {id:26, name:"Sakaka",                nameAr:"سكاكا",                 city_id:210},
  {id:27, name:"Arar",                  nameAr:"عرعر",                  city_id:211},
  {id:28, name:"Najran",                nameAr:"نجران",                 city_id:212},
  {id:30, name:"Al Quarayat",           nameAr:"القريات",               city_id:214},
  {id:43, name:"Rafha",                 nameAr:"رفحاء",                 city_id:222},
  {id:44, name:"Buqayq",                nameAr:"بقيق",                  city_id:223},
  {id:47, name:"Shaqra",                nameAr:"شقراء",                 city_id:226},
  {id:49, name:"Afif",                  nameAr:"عفيف",                  city_id:228},
  {id:50, name:"Dawadmi",               nameAr:"الدوادمي",              city_id:229},
  {id:51, name:"Nariyah",               nameAr:"النعيرية",              city_id:230},
  {id:52, name:"Rabigh",                nameAr:"رابغ",                  city_id:231},
  {id:126,name:"Ar Rass",               nameAr:"الرس",                  city_id:6},
  {id:58, name:"Turaif",                nameAr:"طريف",                  city_id:237},
  {id:53, name:"Bishah",                nameAr:"بيشة",                  city_id:232},
  {id:59, name:"Sabya",                 nameAr:"صبيا",                  city_id:238},
  {id:60, name:"Al Ula",                nameAr:"العُلا",                city_id:239},
  {id:61, name:"Baha",                  nameAr:"الباحة",                city_id:240},
  {id:62, name:"Al Qaisumah",           nameAr:"القيصومة",              city_id:241},
  {id:40, name:"Riyadh South",          nameAr:"الرياض الجنوبية",       city_id:1},
  {id:37, name:"Eastern Province 2",    nameAr:"المنطقة الشرقية 2",     city_id:219},
  {id:38, name:"Eastern Province 3",    nameAr:"المنطقة الشرقية 3",     city_id:219},
  {id:55, name:"Howtat Bani Tamim",     nameAr:"حوطة بني تميم",         city_id:234},
  {id:67, name:"Al Muzahmiya",          nameAr:"المزاحمية",             city_id:243},
  {id:70, name:"Damd",                  nameAr:"ضمد",                   city_id:246},
  {id:71, name:"Sharorah",              nameAr:"شرورة",                 city_id:247},
  {id:72, name:"Uhed Masarha",          nameAr:"أحد المسارحة",          city_id:248},
  {id:73, name:"Ad Darb",               nameAr:"الدرب",                 city_id:249},
  {id:74, name:"Al Namas",              nameAr:"النماص",                city_id:250},
  {id:75, name:"Baljurashi",            nameAr:"بلجرشي",                city_id:251},
  {id:21, name:"Abha Province",         nameAr:"أبها",                  city_id:205},
  {id:76, name:"Ahad Rafidah",          nameAr:"أحد رفيدة",             city_id:205},
  {id:77, name:"Al Wajh",               nameAr:"الوجه",                 city_id:252},
  {id:78, name:"Duba",                  nameAr:"ضبا",                   city_id:253},
  {id:79, name:"Sarat Abida",           nameAr:"سراة عبيدة",            city_id:254},
  {id:80, name:"Tabarjul",              nameAr:"طبرجل",                 city_id:255},
  {id:81, name:"Tanomah",               nameAr:"تنومة",                 city_id:256},
  {id:82, name:"Al Uwayqilah",          nameAr:"العويقيلة",             city_id:257},
  {id:84, name:"Umluj",                 nameAr:"أملج",                  city_id:259},
  {id:85, name:"Al Quwaiiyah",          nameAr:"القويعية",              city_id:260},
  {id:90, name:"Kaec",                  nameAr:"كيك",                   city_id:262},
  {id:23, name:"Hafar Al Batin",        nameAr:"حفر الباطن",            city_id:207},
  {id:29, name:"Mahayel Asir",          nameAr:"محايل عسير",            city_id:213},
  {id:48, name:"Abu Arish",             nameAr:"أبو عريش",              city_id:227},
  {id:99, name:"Mecca Haram Walkers",   nameAr:"مكة الحرم",             city_id:266},
  {id:100,name:"Neom",                  nameAr:"نيوم",                  city_id:267},
  {id:41, name:"Al Majmaah",            nameAr:"المجمعة",               city_id:220},
  {id:32, name:"Al Qunfudhah",          nameAr:"القنفذة",               city_id:216},
  {id:106,name:"Aramco Compound RT",    nameAr:"مجمع أرامكو رت",        city_id:268},
  {id:108,name:"Bish",                  nameAr:"بيش",                   city_id:270},
  {id:56, name:"Dumah Aj Jandal",       nameAr:"دومة الجندل",           city_id:235},
  {id:45, name:"Wadi Al Dawasir",       nameAr:"وادي الدواسر",          city_id:224},
  {id:110,name:"Al Lith",               nameAr:"الليث",                 city_id:272},
  {id:112,name:"Aramco Compound DH",    nameAr:"مجمع أرامكو ظهران",     city_id:273},
  {id:115,name:"Aramco Compound Buqayq",nameAr:"مجمع أرامكو بقيق",     city_id:274},
  {id:116,name:"Khulais",               nameAr:"خليص",                  city_id:275},
  {id:117,name:"Al Wadeen",             nameAr:"الوادين",               city_id:278},
  {id:118,name:"Mecca South",           nameAr:"مكة الجنوبية",          city_id:200},
  {id:136,name:"Al Jumum",              nameAr:"الجموم",                city_id:281},
  {id:16, name:"Mecca North",           nameAr:"مكة الشمالية",          city_id:200},
  {id:46, name:"Al Khafji",             nameAr:"الخفجي",                city_id:225},
  {id:57, name:"Al Mithnab",            nameAr:"المذنب",                city_id:236},
  {id:54, name:"Ad Dilm",               nameAr:"الدلم",                 city_id:233},
  {id:125,name:"Automation Test",       nameAr:"منتج اختبار",           city_id:280},
  {id:127,name:"Al Badayea",            nameAr:"البدائع",               city_id:6},
  {id:128,name:"Al Bukayriyah",         nameAr:"البكيرية",              city_id:6},
  {id:129,name:"Unayzah",               nameAr:"عنيزة",                 city_id:6},
  {id:130,name:"Buraydah",              nameAr:"بريدة",                 city_id:6},
];

/** Returns city display name in the current UI language. */
function cityName(city) {
  return (currentLang === 'ar' && city.nameAr) ? city.nameAr : city.name;
}

/** Re-labels all options in the city dropdown to match the current language. */
function refreshCityDropdownLabels() {
  const sel = document.getElementById('citySelect');
  if (!sel) return;
  CITIES.forEach((city, i) => {
    if (sel.options[i]) sel.options[i].textContent = cityName(city);
  });
}

// ── DYNAMIC CITY / COMPANY STATE ──────────────────────
let currentCityEntry = CITIES[0]; // default: Jeddah (city_id 5)
let currentCompanyId = null;      // read from API after each city load

// ── STATE ──────────────────────────────────────────────
let allRiders       = [];
let filteredRiders  = [];
let currentFilter   = 'all';
let selectedRiderId = null;
let refreshTimer    = null;
let previousStatuses= {};
let searchQuery     = '';
let sortBy          = 'name';
let isLoading       = false;
let currentPage     = 'dashboard';
let mapMarkers      = [];
let leafletMap      = null;
let mapTileLayer    = null;   // reference kept so we can hot-swap tiles on theme change
let currentLang     = localStorage.getItem('dash_lang')  || 'ar';
let currentTheme    = localStorage.getItem('dash_theme') || 'dark';

// ── TRANSLATIONS ───────────────────────────────────────
const STRINGS = {
  ar: {
    status_working:'يعمل', status_starting:'بداية', dtstus_starting:'بداية', status_ending:'إنهاء', status_break:'استراحة',
    status_late:'متأخر', status_offline:'غير متصل',
    brand_title:'لوحة تحكم كيتا', brand_sub:'لوحة تحكم كيتا',
    nav_dashboard:'🏠 الرئيسية', nav_map:'🗺 الخريطة',
    stat_working:'يعمل', stat_starting:'بداية', stat_break:'استراحة',
    stat_late:'متأخر', stat_orders:'📦 طلب', stat_all:'الكل',
    last_update_label:'آخر تحديث', live:'مباشر', auto_refresh:'تحديث تلقائي',
    filter_all:'الكل', filter_working:'يعمل', filter_starting:'بداية',
    filter_break:'استراحة', filter_late:'⚠ متأخر', filter_orders:'📦 طلب',
    filter_no_orders:'⚪ بدون طلب',
    sort_label:'ترتيب:', sort_name:'الاسم', sort_status:'الحالة',
    sort_deliveries:'التوصيلات', sort_util:'معدل الاستخدام', sort_late:'وقت التأخير',
    search_placeholder:'بحث بالاسم أو الهاتف...',
    cp_title:'أداء الشركة الإجمالي', cp_sub:'أداء الشركة الإجمالي',
    cp_workers:'حالة السائقين', cp_checked_in:'يعمل / بداية', cp_late_lbl:'متأخر',
    cp_offline:'غير متصل', cp_break:'في استراحة', cp_with_orders_lbl:'لديه طلب', cp_without_orders_lbl:'بدون طلب',
    cp_orders_section:'الطلبات', cp_accepted:'طلب مقبول', cp_declined:'طلب مرفوض',
    cp_util_section:'متوسط معدل الاستخدام', cp_vehicles_section:'توزيع المركبات',
    cp_company_section:'ملخص الشركة', cp_footer_hint:'انقر على أي سائق من القائمة لعرض تفاصيله الكاملة',
    cp_loading:'جاري التحميل...', cp_no_data:'لا توجد بيانات',
    cp_table_id:'رقم الشركة', cp_table_active:'السائقون النشطون',
    cp_table_deliveries:'إجمالي التوصيلات', cp_table_util:'متوسط الاستخدام',
    cp_late_alert:'تنبيه:', cp_late_drivers:'سائق متأخر الآن', cp_reassign:'إعادة تعيين:',
    tab_overview:'نظرة عامة', tab_deliveries:'التوصيلات', tab_shifts:'الوردية',
    card_shift:'الوردية الحالية', shift_start:'بداية الوردية', shift_end:'نهاية الوردية',
    shift_remain:'المدة المتبقية', card_vehicle:'المركبة', vehicle_speed_lbl:'السرعة الافتراضية',
    speed_unit:'كم/ساعة', card_wallet:'المحفظة', card_location:'الموقع الحالي',
    loc_lat:'خط العرض', loc_lng:'خط الطول', loc_updated:'آخر تحديث',
    open_map:'🗺 فتح في خرائط جوجل',
    ds_completed:'مكتملة', ds_accepted:'مقبولة', ds_notified:'إشعارات',
    ds_declined:'مرفوضة', ds_stacked:'مكدسة', ds_acceptance:'معدل القبول',
    no_deliveries:'لا توجد توصيلات',
    shifts_loading:'جاري تحميل الورديات...', shifts_id:'رقم الوردية',
    shifts_start:'البداية', shifts_end:'النهاية', shifts_point:'نقطة الانطلاق',
    shifts_status:'الحالة', shifts_duration:'المدة', no_shifts:'لا توجد ورديات',
    perf_util:'معدل الاستخدام', perf_acceptance:'معدل القبول',
    ts_worked:'وقت العمل', ts_late:'وقت التأخير',
    ts_break:'وقت الاستراحة', ts_breaks:'عدد الاستراحات',
    currency:'ر.س',
    map_title:'🗺 خريطة السائقين المباشرة', map_with_orders:'لديه طلب نشط',
    map_without_orders:'بدون طلب', map_late_legend:'متأخر',
    map_total:'إجمالي على الخريطة:', map_driver:'سائق',
    map_error:'تعذر تحميل مكتبة الخرائط',
    map_error_sub:'ضع ملفات Leaflet في مجلد libs/ داخل الإضافة (leaflet.js و leaflet.css)',
    loading:'جاري التحميل...', no_data:'لا يوجد سائقون مطابقون',
    load_fail:'⚠ فشل التحميل', login_hint:'تأكد من تسجيل الدخول في المنصة',
    has_order:'🟢 طلب', no_order:'⚪',
    del_dispatched:'تم الإرسال', del_courier_notified:'تم الإشعار',
    del_accepted:'مقبولة', del_near_pickup:'قرب الاستلام', del_picked_up:'تم الاستلام',
    del_left_pickup:'غادر الاستلام', del_near_dropoff:'قرب التسليم',
    del_completed:'مكتملة', del_cancelled:'ملغاة',
    shift_published:'منشورة', shift_active:'نشطة', shift_finished:'منتهية', shift_draft:'مسودة',
    wallet_over_hard:'تجاوز الحد الصعب', wallet_over_soft:'تجاوز الحد اللين', wallet_ok:'طبيعي',
    delivery_pickup:'📦 الاستلام', delivery_dropoff:'🏠 التسليم',
    theme_light:'☀️ فاتح', theme_dark:'🌙 داكن', lang_toggle:'EN',
    toast_loaded:'تم تحميل', toast_riders:'سائق', toast_fail:'فشل تحميل البيانات',
    toast_auto_on:'تحديث تلقائي كل 30 ثانية', toast_auto_off:'تم إيقاف التحديث التلقائي',
    hour_label:'س', min_short:'د', less_min:'< دقيقة',
    not_started:'لم تبدأ بعد', ended:'انتهت', remaining:'متبقي',
  },
  en: {
    status_working:'Working', status_starting:'Starting', dtstus_starting:'Starting', status_ending:'Ending', status_break:'On Break',
    status_late:'Late', status_offline:'Offline',
    brand_title:'KeeTa Dashboard', brand_sub:'KeeTa Dashboard',
    nav_dashboard:'🏠 Dashboard', nav_map:'🗺 Map',
    stat_working:'Working', stat_starting:'Starting', stat_break:'Break',
    stat_late:'Late', stat_orders:'📦 Orders', stat_all:'All',
    last_update_label:'Last Update', live:'Live', auto_refresh:'Auto Refresh',
    filter_all:'All', filter_working:'Working', filter_starting:'Starting',
    filter_break:'Break', filter_late:'⚠ Late', filter_orders:'📦 Orders',
    filter_no_orders:'⚪ No Orders',
    sort_label:'Sort:', sort_name:'Name', sort_status:'Status',
    sort_deliveries:'Deliveries', sort_util:'Utilization', sort_late:'Late Time',
    search_placeholder:'Search by name or phone...',
    cp_title:'Overall Company Performance', cp_sub:'Overall Company Performance',
    cp_workers:'Rider Status', cp_checked_in:'Working / Starting', cp_late_lbl:'Late',
    cp_offline:'Offline', cp_break:'On Break', cp_with_orders_lbl:'Has Order', cp_without_orders_lbl:'No Orders',
    cp_orders_section:'Orders', cp_accepted:'Accepted Order', cp_declined:'Declined Order',
    cp_util_section:'Average Utilization Rate', cp_vehicles_section:'Vehicle Distribution',
    cp_company_section:'Company Summary', cp_footer_hint:'Click any rider in the list to view full details',
    cp_loading:'Loading...', cp_no_data:'No data',
    cp_table_id:'Company ID', cp_table_active:'Active Riders',
    cp_table_deliveries:'Total Deliveries', cp_table_util:'Avg Utilization',
    cp_late_alert:'Alert:', cp_late_drivers:'riders late now', cp_reassign:'Reassignments:',
    tab_overview:'Overview', tab_deliveries:'Deliveries', tab_shifts:'Shifts',
    card_shift:'Current Shift', shift_start:'Shift Start', shift_end:'Shift End',
    shift_remain:'Remaining', card_vehicle:'Vehicle', vehicle_speed_lbl:'Default Speed',
    speed_unit:'km/h', card_wallet:'Wallet', card_location:'Current Location',
    loc_lat:'Latitude', loc_lng:'Longitude', loc_updated:'Last Updated',
    open_map:'🗺 Open in Google Maps',
    ds_completed:'Completed', ds_accepted:'Accepted', ds_notified:'Notified',
    ds_declined:'Declined', ds_stacked:'Stacked', ds_acceptance:'Acceptance Rate',
    no_deliveries:'No deliveries found',
    shifts_loading:'Loading shifts...', shifts_id:'Shift ID',
    shifts_start:'Start', shifts_end:'End', shifts_point:'Starting Point',
    shifts_status:'Status', shifts_duration:'Duration', no_shifts:'No shifts found',
    perf_util:'Utilization Rate', perf_acceptance:'Acceptance Rate',
    ts_worked:'Worked Time', ts_late:'Late Time',
    ts_break:'Break Time', ts_breaks:'Break Count',
    currency:'SAR',
    map_title:'🗺 Live Rider Map', map_with_orders:'Has Active Order',
    map_without_orders:'No Order', map_late_legend:'Late',
    map_total:'Total on map:', map_driver:'riders',
    map_error:'Failed to load map library',
    map_error_sub:'Place Leaflet files inside libs/ folder of the extension (leaflet.js and leaflet.css)',
    loading:'Loading...', no_data:'No matching riders',
    load_fail:'⚠ Load Failed', login_hint:'Make sure you are logged in to the platform',
    has_order:'🟢 Order', no_order:'⚪',
    del_dispatched:'Dispatched', del_courier_notified:'Notified',
    del_accepted:'Accepted', del_near_pickup:'Near Pickup', del_picked_up:'Picked Up',
    del_left_pickup:'Left Pickup', del_near_dropoff:'Near Dropoff',
    del_completed:'Completed', del_cancelled:'Cancelled',
    shift_published:'Published', shift_active:'Active', shift_finished:'Finished', shift_draft:'Draft',
    wallet_over_hard:'Over Hard Limit', wallet_over_soft:'Over Soft Limit', wallet_ok:'Normal',
    delivery_pickup:'📦 Pickup', delivery_dropoff:'🏠 Dropoff',
    theme_light:'☀️ Light', theme_dark:'🌙 Dark', lang_toggle:'ع',
    toast_loaded:'Loaded', toast_riders:'riders', toast_fail:'Failed to load data',
    toast_auto_on:'Auto-refresh every 30 seconds', toast_auto_off:'Auto-refresh disabled',
    hour_label:'h', min_short:'m', less_min:'< 1 min',
    not_started:'Not started yet', ended:'Ended', remaining:'remaining',
  }
};

function t(key) {
  return (STRINGS[currentLang] && STRINGS[currentLang][key]) ||
         (STRINGS['ar'][key]) || key;
}

// ── THEME & LANGUAGE ───────────────────────────────────

function applyTheme() {
  document.documentElement.setAttribute('data-theme', currentTheme);
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = currentTheme === 'dark' ? t('theme_light') : t('theme_dark');
}

function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('dash_theme', currentTheme);
  applyTheme();

  // Hot-swap Leaflet tile layer so the map reflects the new theme immediately.
  // We change the URL on the existing layer — no full map rebuild needed.
  if (mapTileLayer) {
    mapTileLayer.setUrl(mapTileUrl());
  }
}

function applyLanguage() {
  const isAr = currentLang === 'ar';
  document.documentElement.dir  = isAr ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLang;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });

  const so = document.getElementById('sortSelect');
  if (so) {
    so.options[0].text = t('sort_name');
    so.options[1].text = t('sort_status');
    so.options[2].text = t('sort_deliveries');
    so.options[3].text = t('sort_util');
    so.options[4].text = t('sort_late');
  }

  const langBtn = document.getElementById('btnLang');
  if (langBtn) langBtn.textContent = t('lang_toggle');
  applyTheme();

  if (allRiders.length) {
    applyFiltersAndSort();
    renderCompanyStats(computeStatsFromRiders(allRiders));
    if (selectedRiderId) {
      const riderData = allRiders.find(r => r.employee_id === selectedRiderId);
      if (riderData) renderRiderHeader(riderData);
    }
  }
  // Re-label city dropdown in the new language
  refreshCityDropdownLabels();
}

function toggleLang() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('dash_lang', currentLang);
  applyLanguage();
}

// ── LABEL MAPS ─────────────────────────────────────────

const STATUS_BADGE = {
  working:  'badge-working',
  starting: 'badge-starting',
  dtstus_starting: 'badge-starting',
  ending:   'badge-ending',
  break:    'badge-break',
  late:     'badge-late',
  offline:  'badge-offline',
};

const DELIVERY_STATUS_KEY = {
  dispatched:       'del_dispatched',
  courier_notified: 'del_courier_notified',
  accepted:         'del_accepted',
  near_pickup:      'del_near_pickup',
  picked_up:        'del_picked_up',
  left_pickup:      'del_left_pickup',
  near_dropoff:     'del_near_dropoff',
  completed:        'del_completed',
  cancelled:        'del_cancelled',
};

const SHIFT_STATE_KEY = {
  PUBLISHED: 'shift_published',
  ACTIVE:    'shift_active',
  FINISHED:  'shift_finished',
  DRAFT:     'shift_draft',
};

const VEHICLE_ICONS = {
  Motorbike:  '🏍',
  Motor_Bike: '🏍',
  Bicycle:    '🚲',
  Car:        '🚗',
};

// ── HELPERS ────────────────────────────────────────────

/**
 * Returns the raw status from the API (normalized to lowercase).
 * This is the single source of truth for a rider's status.
 */
function effectiveStatus(rider) {
  return (rider.status || 'offline').toLowerCase();
}

/**
 * TRUE when a rider is CURRENTLY late right now.
 *
 * The API's rider.status field is updated in real-time and is set to
 * "late" only when the rider is CURRENTLY in a late state. That is
 * the correct signal for the live filter, badge, and map marker colour.
 * ──────────────────────────────────────────────────────────────
 */
function isLate(rider) {
  if (!rider) return false;
  return effectiveStatus(rider) === 'late';
}

function hasActiveOrder(rider) {
  return !!(rider.deliveries_info?.has_active_deliveries);
}

function cleanName(name) {
  if (!name) return '—';
  return name.replace(/\*\d+\*/g, '').trim() || name.trim();
}

function getRiderDisplayName(rider) {
  if (!rider) return '—';
  return cleanName(rider.name);
}

function avatarClass(name) {
  if (!name) return 'av-4';
  return `av-${name.charCodeAt(0) % 5}`;
}

function avatarInitial(name) {
  const c = cleanName(name);
  return c.charAt(0) || '?';
}

function walletStatus(limitStatus, balance) {
  if (balance >= 500) return { text: t('wallet_over_hard'), cls: 'wallet-hard' };
  if (balance >= 300) return { text: t('wallet_over_soft'), cls: 'wallet-soft' };
  return { text: t('wallet_ok'), cls: 'wallet-ok' };
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-GB',
    { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-GB', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatSeconds(sec) {
  if (!sec || sec === 0) return `0 ${t('min_short')}`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts = [];
  if (h) parts.push(`${h}${t('hour_label')}`);
  if (m) parts.push(`${m}${t('min_short')}`);
  return parts.join(' ') || t('less_min');
}

function shiftDuration(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end) - new Date(start);
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}${t('hour_label')} ${m}${t('min_short')}`;
}

function shiftRemaining(start, end) {
  if (!start || !end) return { text: '—', pct: 0 };
  const now = new Date(), s = new Date(start), e = new Date(end);
  if (now < s) return { text: t('not_started'), pct: 0 };
  if (now > e) return { text: t('ended'), pct: 100 };
  const pct = Math.round(((now - s) / (e - s)) * 100);
  const rem = Math.floor((e - now) / 60_000);
  return {
    text: `${Math.floor(rem / 60)}${t('hour_label')} ${rem % 60}${t('min_short')} ${t('remaining')}`,
    pct,
  };
}

async function apiFetch(url, options = {}) {
  const method = options.method || 'GET';
  const body   = options.body ? JSON.stringify(options.body) : null;
  const headers = { 'Content-Type': 'application/json' };

  const res = await fetch(url, {
    method,
    headers: method === 'POST' ? headers : {},
    body,
    credentials: 'include'
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.json();
}

/** 
 * Fetches status group counts from KeeTa.
 * Used for header stats and overall city performance.
 */
async function fetchKeetaStats() {
  if (!currentCityEntry.orgId) return null;
  const url = `${KEETA_API_BASE}/getCourierStatusGroupCount?yodaReady=h5&csecplatform=4&csecversion=3.4.0`;
  const body = {
    orgId: currentCityEntry.orgId,
    orgType: 24
  };
  const res = await apiFetch(url, { method: 'POST', body });
  return res.data || [];
}

/**
 * Fetches both coordinates and list info from KeeTa, then merges them.
 */
async function fetchKeetaRiders() {
  if (!currentCityEntry.orgId) return [];

  const url = `${KEETA_API_BASE}/queryCourierByCondition?yodaReady=h5&csecplatform=4&csecversion=3.4.0`;
  const body = {
    sortField: 0,
    pageSize: 100, // Fetch more to cover the dashboard needs
    capacityTypeList: [2],
    orgId: currentCityEntry.orgId,
    orgType: 24,
    pageNum: 1,
    source: 0
  };

  const res = await apiFetch(url, { method: 'POST', body });
  const data = res.data || {};
  
  const coords = data.allCourierCoordinate || [];
  const list   = data.pageCourierInfo?.pageContent || [];

  // Merge list info with coordinates
  return list.map(item => {
    const coord = coords.find(c => String(c.courierId) === String(item.courierId));
    return mapKeetaRider(item, coord);
  });
}

/**
 * Maps KeeTa data to the dashboard's internal RiderStat structure.
 */
function mapKeetaRider(item, coord) {
  return {
    employee_id: String(item.courierId),
    name: `${item.courierFirstName || ''} ${item.courierLastName || ''}`.trim() || '—',
    phone_number: item.courierPhoneNumber || '—',
    status: KEETA_STATUS_MAP[item.courierStatus] || 'offline',
    // Mocking structure for rest of dashboard compatibility
    starting_point: { name: item.storeName || item.poiName || 'KeeTa Main' }, 
    company_id: currentCityEntry.orgId,
    wallet_info: { balance: Number(item.walletAmount || 0) },
    deliveries_info: {
      completed_deliveries_count: item.finishedTaskCount || 0,
      has_active_deliveries: item.deliveryingTaskCount > 0
    },
    performance: {
      utilization_rate: 0,
      acceptance_rate: item.acceptanceRate || 0,
      time_spent: {
        worked_seconds: item.courierOnlineTime ? Math.floor(item.courierOnlineTime / 1000) : 0,
        late_seconds: 0
      }
    },
    current_location: {
      latitude: coord ? coord.lat : item.lat,
      longitude: coord ? coord.lng : item.lng,
      location_updated_at: coord ? new Date(coord.latestUpdateTime).toISOString() : new Date().toISOString()
    },
    vehicle: {
      name: item.courierVehicleType === 3 ? 'Motorbike' : 'Vehicle',
      icon: 'Motorbike'
    }
  };
}

// ── API CALLS ──────────────────────────────────────────

async function fetchRiders() {
  currentCompanyId = currentCityEntry.orgId; 
  return fetchKeetaRiders();
}

async function fetchRiderDetails(id) {
  if (!currentCityEntry.orgId) throw new Error("No orgId");
  
  const url = `${KEETA_API_BASE}/queryTaskOrCourierDetail?yodaReady=h5&csecplatform=4&csecversion=3.4.0`;
  const body = {
    taskId: "",
    courierId: String(id),
    currentShift: null,
    orgId: currentCityEntry.orgId,
    orgType: 24,
    shiftTimeRange: [],
    source: 0
  };

  const res = await apiFetch(url, { method: 'POST', body });
  const data = res.data || {};
  const courier = data.courierInfo || {};

  // Enrich the rider object with detail data
  const rider = mapKeetaRider(courier);
  
  // Attach extra detail-specific fields
  rider.shifts = (courier.shiftTimeRange || []).map(s => ({
    id: s.shiftAreaId,
    start_at: new Date(s.startTime).toISOString(),
    end_at: new Date(s.endTime).toISOString(),
    starting_point: { name: s.shiftAreaName },
    state: s.underSchedule ? 'ACTIVE' : 'PUBLISHED'
  }));

  rider.deliveries_list = (courier.finishedTaskList || []).map(t => ({
    id: t.taskId,
    status: t.taskStatus === 50 ? 'completed' : 'cancelled',
    pickup_point: { name: t.poiName },
    dropoff_point: { name: 'Customer' },
    created_at: new Date(t.finishedTime).toISOString()
  }));

  return rider;
}

async function fetchRiderShifts(id) {
  // Now handled inside fetchRiderDetails for KeeTa
  return [];
}

function cleanName(original) {
  return original || '—';
}

// ── STATS FROM RIDERS ──────────────────────────────────
/*
  FIX: Previously stats.late was incremented TWICE:
    1) effectiveStatus(r) === 'late'  → stats['late']++
    2) isLate(r) (late_seconds > 0)  → stats.late++
  Now: we only count a rider's API status in the status buckets
  (working / starting / break / offline), and keep late as a
  separate orthogonal counter via isLate().
  A rider with status==='late' is still shown as late in the badge
  because STATUS_BADGE['late'] exists.
*/
function computeStatsFromRiders(riders) {
  const stats = {
    working: 0, starting: 0, break: 0, offline: 0,
    late: 0,   // counted separately via isLate()
    withOrders: 0, withoutOrders: 0, total: riders.length,
    walletOverHard: 0, walletOverSoft: 0, walletOk: 0,
    totalCompleted: 0, byPoint: {}, vehicles: {},
    utilTotal: 0, utilCount: 0, ordersAccepted: 0, ordersDeclined: 0,
  };

  riders.forEach(r => {
    const st = effectiveStatus(r);

    // Count each rider in their API status bucket
    // (working / starting / break / offline / late)
    // Note: 'late' riders are NOT double-added below; isLate() handles the late counter.
    if (st === 'working' || st === 'ending')  stats.working++;
    else if (st === 'starting' || st === 'dtstus_starting') stats.starting++;
    else if (st === 'break')    stats.break++;
    else if (st === 'offline')  stats.offline++;
    // riders with status==='late' are not counted in the above buckets —
    // they are only reflected in the late counter below.

    // Late counter: covers status==='late' AND riders with late_seconds > 0
    if (isLate(r)) stats.late++;

    const hasOrd = hasActiveOrder(r);
    if (hasOrd) {
      stats.withOrders++;
    } else if (['working', 'starting', 'late', 'ending', 'dtstus_starting'].includes(st)) {
      stats.withoutOrders++;
    }

    const bal = r.wallet_info?.balance;
    if (bal !== undefined && bal !== null) {
      if (bal >= 500)      stats.walletOverHard++;
      else if (bal >= 300) stats.walletOverSoft++;
      else                 stats.walletOk++;
    }

    stats.totalCompleted  += r.deliveries_info?.completed_deliveries_count || 0;
    stats.ordersAccepted  += r.deliveries_info?.accepted_deliveries_count  || 0;

    const ptName = r.starting_point?.name || 'غير محدد';
    if (!stats.byPoint[ptName]) {
      stats.byPoint[ptName] = { working:0, starting:0, break:0, late:0, total:0, withOrders:0, withoutOrders:0 };
    }
    const pg = stats.byPoint[ptName];
    pg.total++;
    if (st === 'working' || st === 'ending')       pg.working++;
    else if (st === 'starting' || st === 'dtstus_starting') pg.starting++;
    else if (st === 'break')    pg.break++;
    if (isLate(r)) pg.late++;
    if (hasOrd) pg.withOrders++;
    else if (['working','starting','late','ending','dtstus_starting'].includes(st)) pg.withoutOrders++;

    const vIcon = r.vehicle?.icon || 'Unknown';
    stats.vehicles[vIcon] = (stats.vehicles[vIcon] || 0) + 1;

    const util = r.performance?.utilization_rate;
    if (util !== undefined && util !== null) {
      stats.utilTotal += util;
      stats.utilCount++;
    }
  });

  stats.avgUtil = stats.utilCount > 0
    ? Math.round((stats.utilTotal / stats.utilCount) * 100)
    : 0;

  return stats;
}

// ── COMPANY STATS RENDER ───────────────────────────────

function renderCompanyStats(stats) {
  // "يعمل / بداية" card shows working + starting (late riders shown separately)
  setText('cp-checkedIn',      stats.working + stats.starting);
  setText('cp-checkedInLate',  stats.late);
  setText('cp-withoutOrders',  stats.withoutOrders);
  setText('cp-onBreak',        stats.break);
  setText('cp-ordersAccepted', stats.ordersAccepted);
  setText('cp-ordersDeclined', stats.ordersDeclined || 0);
  setText('cp-utilRate',       `${stats.avgUtil}%`);

  const bar = document.getElementById('cp-utilBar');
  if (bar) bar.style.width = `${Math.min(stats.avgUtil, 100)}%`;

  const banner = document.getElementById('cpLateBanner');
  if (banner) {
    banner.style.display = stats.late > 0 ? 'flex' : 'none';
    setText('cp-lateWorkers',    stats.late);
    setText('cp-reassignments',  0);
  }

  const vRow = document.getElementById('cp-vehicles');
  if (vRow) {
    const entries = Object.entries(stats.vehicles);
    if (entries.length) {
      vRow.innerHTML = entries.map(([icon, count]) => {
        const emoji = VEHICLE_ICONS[icon] || '🛵';
        return `<div class="cp-vehicle-chip">
          <span class="cp-vehicle-chip-icon">${emoji}</span>
          <div><div class="cp-vehicle-chip-name">${icon}</div></div>
          <span class="cp-vehicle-chip-count">${count}</span>
        </div>`;
      }).join('');
    } else {
      vRow.innerHTML = `<span class="cp-loading-text">${t('cp_no_data')}</span>`;
    }
  }

  setText('cp-withOrders', stats.withOrders);

  // Update company sub-label with live company ID
  const cpSubEl = document.querySelector('[data-i18n="cp_sub"]');
  if (cpSubEl && currentCompanyId) {
    const cityName = currentCityEntry.name;
    cpSubEl.textContent = currentLang === 'ar'
      ? `شركة ${currentCompanyId} · ${cityName} · المدينة ${currentCityEntry.city_id}`
      : `Company ${currentCompanyId} · ${cityName} · District ${currentCityEntry.city_id}`;
  }

  const tbody = document.getElementById('cp-statsBody');
  if (tbody) {
    const companyDisplay = currentCompanyId ?? '—';
    tbody.innerHTML = `
      <tr>
        <td>${companyDisplay}</td>
        <td style="color:var(--green)">${stats.working + stats.starting}</td>
        <td style="color:var(--amber)">${stats.totalCompleted}</td>
        <td style="color:var(--blue)">${stats.avgUtil}%</td>
      </tr>`;
  }

  const spinner = document.getElementById('cpLoadingSpinner');
  if (spinner) spinner.style.display = 'none';
}

// ── RIDER LIST RENDER ──────────────────────────────────

function buildRiderCard(rider) {
  const status   = effectiveStatus(rider);
  const late     = isLate(rider);
  const hasOrder = hasActiveOrder(rider);
  const avCls    = avatarClass(rider.name);
  const delivs   = rider.deliveries_info?.completed_deliveries_count || 0;
  const isSelected = rider.employee_id === selectedRiderId;
  const displayName = getRiderDisplayName(rider);

  const card = document.createElement('div');
  card.className = `rider-card${late ? ' late-card' : ''}${isSelected ? ' selected' : ''}`;
  card.dataset.id = rider.employee_id;

  const statusLabel = t(`status_${status}`) || status;
  const badgeCls    = STATUS_BADGE[status] || 'badge-offline';

  card.innerHTML = `
    ${late ? '<div class="late-indicator"></div>' : ''}
    <div class="rider-avatar ${avCls}">${avatarInitial(rider.name)}</div>
    <div class="rider-card-info">
      <div class="rider-card-name">${displayName} <span style="font-size:11px;color:var(--text-muted);font-weight:normal">#${rider.employee_id}</span></div>
      <div class="rider-card-sub">${rider.starting_point?.name || '—'} · ${rider.phone_number || '—'}</div>
    </div>
    <div class="rider-card-meta">
      <span class="badge ${badgeCls}">${statusLabel}</span>
      <span class="deliveries-mini">${hasOrder ? t('has_order') : t('no_order')} ${delivs}</span>
    </div>`;

  card.addEventListener('click', () => selectRider(rider.employee_id));
  return card;
}

function renderRiderList() {
  const list = document.getElementById('riderList');
  list.innerHTML = '';
  if (!filteredRiders.length) {
    list.innerHTML = `<div class="no-data">${t('no_data')}</div>`;
    return;
  }
  const frag = document.createDocumentFragment();
  filteredRiders.forEach((r, i) => {
    const card = buildRiderCard(r);
    card.style.animationDelay = `${Math.min(i * 18, 400)}ms`;
    frag.appendChild(card);
  });
  list.appendChild(frag);
}

function updateHeaderStats(riders) {
  const stats = computeStatsFromRiders(riders);
  setText('stat-working',  stats.working);
  setText('stat-starting', stats.starting);
  setText('stat-break',    stats.break);
  setText('stat-late',     stats.late);
  setText('stat-orders',   stats.withOrders);
  setText('stat-total',    stats.total);
  return stats;
}

function applyFiltersAndSort() {
  let list = [...allRiders];

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(r =>
      cleanName(r.name).toLowerCase().includes(q) ||
      (r.phone_number || '').includes(q) ||
      String(r.employee_id).includes(q)
    );
  }

  switch (currentFilter) {
    case 'orders':
      list = list.filter(r => hasActiveOrder(r));
      break;
    case 'no-orders':
      list = list.filter(r =>
        ['working', 'starting', 'late'].includes(effectiveStatus(r)) && !hasActiveOrder(r)
      );
      break;
    case 'late':
      // isLate() covers both status==='late' AND late_seconds > 0
      list = list.filter(r => isLate(r));
      break;
    case 'all':
      break;
    default:
      // For working/starting/break/offline filters use the API status field directly
      list = list.filter(r => effectiveStatus(r) === currentFilter);
  }

  list.sort((a, b) => {
    switch (sortBy) {
      case 'name':        return cleanName(a.name).localeCompare(cleanName(b.name), currentLang);
      case 'status':      return effectiveStatus(a).localeCompare(effectiveStatus(b));
      case 'deliveries':  return (b.deliveries_info?.completed_deliveries_count || 0) - (a.deliveries_info?.completed_deliveries_count || 0);
      default: return 0;
    }
  });

  // Bubble late riders to top in 'all' view
  if (currentFilter === 'all') {
    list.sort((a, b) => (isLate(b) ? 1 : 0) - (isLate(a) ? 1 : 0));
  }

  filteredRiders = list;
  renderRiderList();
}

// ── LOAD RIDERS ────────────────────────────────────────

async function loadRiders(silent = false) {
  if (isLoading) return;
  isLoading = true;

  const btn = document.getElementById('btnRefresh');
  if (btn) btn.classList.add('spinning');

  if (!silent) {
    document.getElementById('riderList').innerHTML = `
      <div class="loading-state"><div class="spinner"></div><p>${t('loading')}</p></div>`;
  }

  try {
    allRiders = await fetchRiders();

    // Names/Substitutes logic (kept as placeholder or disabled if not needed)
    /*
    if (currentCompanyId && allRiders.length) {
       // sync logic removed to avoid pushing KeeTa data to old HS manager
    }
    */

    if (Object.keys(previousStatuses).length > 0) {
      let statusChanged = false;
      allRiders.forEach(r => {
        const id = r.employee_id;
        const newStatus = effectiveStatus(r);
        const oldStatus = previousStatuses[id];
        if (oldStatus && oldStatus !== newStatus) {
          statusChanged = true;
          const name = cleanName(r.name);
          const oldLbl = t('status_'+oldStatus) || oldStatus;
          const newLbl = t('status_'+newStatus) || newStatus;
          const msg = currentLang === 'ar' 
            ? `تغيرت حالة السائق ${name} (#${id}) من «${oldLbl}» إلى «${newLbl}»`
            : `${name} (#${id}): ${oldLbl} ➔ ${newLbl}`;
          toast(msg, 'info', 10000);
        }
        previousStatuses[id] = newStatus;
      });
      if (statusChanged) playNotificationSound();
    } else {
      allRiders.forEach(r => previousStatuses[r.employee_id] = effectiveStatus(r));
    }

    const stats = updateHeaderStats(allRiders);
    applyFiltersAndSort();
    renderCompanyStats(stats);
    setText('lastUpdate', new Date().toLocaleTimeString(currentLang === 'ar' ? 'ar-SA' : 'en-GB'));
    if (!silent) toast(`${t('toast_loaded')} ${allRiders.length} ${t('toast_riders')}`, 'success');

    /* 
    if (allRiders.length > 0 && currentCompanyId) {
      setTimeout(() => sendRiderStatsJob(), 2000);
    }
    */
  } catch (err) {
    console.error('loadRiders:', err);
    if (!silent) {
      document.getElementById('riderList').innerHTML = `
        <div class="no-data">${t('load_fail')}<br><small>${err.message}</small><br><br>
        <small>${t('login_hint')}</small></div>`;
      toast(t('toast_fail'), 'error');
    }
  } finally {
    isLoading = false;
    if (btn) btn.classList.remove('spinning');
  }
}

// ── SELECT RIDER ───────────────────────────────────────

async function selectRider(id) {
  selectedRiderId = id;

  document.querySelectorAll('.rider-card').forEach(c =>
    c.classList.toggle('selected', Number(c.dataset.id) === id)
  );

  document.getElementById('emptyState').style.display  = 'none';
  document.getElementById('riderDetail').style.display = 'flex';
  switchTab('overview');

  // Scroll detail panel back to top so the sticky header+tabs are visible
  const panel = document.getElementById('detailPanel');
  if (panel) panel.scrollTop = 0;

  try {
    const rider = await fetchRiderDetails(id);
    renderRiderHeader(rider);
    renderOverviewTab(rider);
    renderDeliveriesTab(rider);
    loadShifts(id);
  } catch (err) {
    console.error('selectRider:', err);
    toast(t('toast_fail'), 'error');
  }
}

async function loadShifts(id) {
  const loading = document.getElementById('shiftsLoading');
  const content = document.getElementById('shiftsContent');
  loading.style.display = 'flex';
  content.style.display = 'none';
  try {
    const shifts = await fetchRiderShifts(id);
    renderShiftsTab(shifts);
    loading.style.display = 'none';
    content.style.display = 'block';
  } catch (err) {
    loading.innerHTML = `<p style="color:var(--red)">⚠ ${t('toast_fail')}</p>`;
  }
}

// ── RENDER RIDER DETAIL ────────────────────────────────

function renderRiderHeader(rider) {
  const status = effectiveStatus(rider);
  const avCls  = avatarClass(rider.name);

  const av = document.getElementById('detailAvatar');
  av.textContent = avatarInitial(rider.name);
  av.className   = `detail-avatar ${avCls}`;

  setText('detailName', `${getRiderDisplayName(rider)} (#${rider.employee_id})`);

  const badge = document.getElementById('detailStatusBadge');
  badge.textContent = t(`status_${status}`) || status;
  badge.className   = `status-badge ${STATUS_BADGE[status] || 'badge-offline'}`;

  setText('detailPhone',   `📞 ${rider.phone_number || '—'}`);
  setText('detailPoint',   `📍 ${rider.starting_point?.name || '—'}`);
  setText('detailCompany', `🏢 ${t('cp_sub').split('·')[0].trim()} ${rider.company_id || '—'}`);
}

function renderOverviewTab(rider) {
  const s = rider.active_shift_started_at;
  const e = rider.active_shift_ended_at;
  setText('shiftStart', formatDateTime(s));
  setText('shiftEnd',   formatDateTime(e));

  const { text, pct } = shiftRemaining(s, e);
  setText('shiftRemain', text);
  const fill = document.getElementById('shiftProgressFill');
  if (fill) fill.style.width = `${pct}%`;

  const v = rider.vehicle;
  setText('vehicleName',  v?.name || '—');
  setText('vehicleSpeed', v?.default_speed ? `${v.default_speed} ${t('speed_unit')}` : '—');

  const wal = rider.wallet_info;
  const bal = wal?.balance;
  setText('walletBalance', bal !== undefined ? `${bal.toFixed(2)} ${t('currency')}` : '—');

  const ws = walletStatus(wal?.limit_status, bal);
  const wsEl = document.getElementById('walletStatus');
  if (wsEl) { wsEl.textContent = ws.text; wsEl.className = `wallet-status ${ws.cls}`; }

  const loc = rider.current_location;
  setText('locLat',     loc?.latitude?.toFixed(6));
  setText('locLng',     loc?.longitude?.toFixed(6));
  setText('locUpdated', formatDateTime(loc?.location_updated_at));

  const link = document.getElementById('mapLink');
  if (link) {
    if (loc?.latitude && loc?.longitude) {
      link.href = `https://www.google.com/maps?q=${loc.latitude},${loc.longitude}`;
      link.textContent = t('open_map');
      link.style.display = 'inline-block';
    } else {
      link.style.display = 'none';
    }
  }
}

function renderDeliveriesTab(rider) {
  const di = rider.deliveries_info || {};
  setText('ds-completed', di.completed_deliveries_count || 0);
  setText('ds-accepted',  di.accepted_deliveries_count  || 0);
  setText('ds-notified',  di.notified_deliveries_count  || 0);
  setText('ds-declined',  di.declined_deliveries_count  || 0);
  setText('ds-stacked',   di.stacked_deliveries_count   || 0);

  const acc = rider.performance?.acceptance_rate;
  setText('ds-acceptance', acc !== undefined ? `${Math.round(acc * 100)}%` : '—');

  const list = document.getElementById('deliveriesList');
  const deliveries = di.latest_deliveries || [];
  if (!deliveries.length) {
    list.innerHTML = `<div class="no-data">${t('no_deliveries')}</div>`;
    return;
  }

  const STEPS = ['dispatched', 'accepted', 'picked_up', 'near_dropoff', 'completed'];
  list.innerHTML = '';

  deliveries.forEach(d => {
    const tl = d.timeline || [];
    const tlHTML = STEPS.map((step, i) => {
      const ev     = tl.find(t2 => t2.status === step);
      const isDone = !!ev;
      const dotCls = isDone ? 'done' : (d.status === step ? 'current' : '');
      const linCls = isDone ? 'done' : '';
      return `
        <div class="timeline-step">
          <div class="timeline-dot ${dotCls}"></div>
          <div class="tl-label">${t(DELIVERY_STATUS_KEY[step] || step)}</div>
          ${ev ? `<div class="tl-time">${formatTime(ev.timestamp)}</div>` : ''}
        </div>
        ${i < STEPS.length - 1 ? `<div class="timeline-line ${linCls}"></div>` : ''}`;
    }).join('');

    const stCls = `ds-${d.status || 'dispatched'}`;
    const card  = document.createElement('div');
    card.className = 'delivery-card';
    card.innerHTML = `
      <div class="delivery-card-header">
        <span class="delivery-code">${d.order_code || '—'}</span>
        <span class="delivery-vendor">${d.vendor_name || '—'}</span>
        <span class="delivery-status-badge ${stCls}">${t(DELIVERY_STATUS_KEY[d.status] || d.status)}</span>
      </div>
      <div class="delivery-addresses">
        <div class="addr-box"><div class="addr-label">${t('delivery_pickup')}</div><div class="addr-val">${d.pickup_address || '—'}</div></div>
        <div class="addr-box"><div class="addr-label">${t('delivery_dropoff')}</div><div class="addr-val">${d.dropoff_address || '—'}</div></div>
      </div>
      <div class="delivery-timeline">${tlHTML}</div>`;
    list.appendChild(card);
  });
}

function renderShiftsTab(shifts) {
  const tbody = document.getElementById('shiftsTableBody');
  if (!shifts?.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="no-data">${t('no_shifts')}</td></tr>`;
    return;
  }
  const sorted = [...shifts].sort((a, b) => new Date(b.start) - new Date(a.start));
  const now    = new Date();
  tbody.innerHTML = sorted.map(s => {
    const sd = new Date(s.start), ed = new Date(s.end);
    const isActive = sd <= now && ed >= now;
    const stateLabel = t(SHIFT_STATE_KEY[s.state] || s.state);
    return `
      <tr class="${isActive ? 'active-shift' : ''}">
        <td style="font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${s.id}</td>
        <td>${formatDateTime(s.start)}</td>
        <td>${formatTime(s.end)}</td>
        <td style="font-family:var(--font-main)">${s.starting_point_name || '—'}</td>
        <td><span class="shift-state-badge state-${s.state}">${stateLabel}${isActive ? ' 🟢' : ''}</span></td>
        <td>${shiftDuration(s.start, s.end)}</td>
      </tr>`;
  }).join('');
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

// ── GROUP BY STARTING POINT ────────────────────────────


// ── PAGE NAVIGATION ────────────────────────────────────

function showDashboardPage() {
  currentPage = 'dashboard';
  document.getElementById('dashboardPage').style.display = 'flex';
  document.getElementById('mapPage').style.display       = 'none';
  updateNavButtons();
}

function showMapPage() {
  currentPage = 'map';
  document.getElementById('dashboardPage').style.display = 'none';
  document.getElementById('mapPage').style.display       = 'flex';
  updateNavButtons();
  requestAnimationFrame(() => requestAnimationFrame(() => initMap()));
}

function updateNavButtons() {
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.page === currentPage)
  );
}




// ── AUTO REFRESH ───────────────────────────────────────

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    loadRiders(true);
    if (currentPage === 'map' && leafletMap) buildMap(document.getElementById('liveMap'));
    if (selectedRiderId) {
      fetchRiderDetails(selectedRiderId).then(rider => {
        renderRiderHeader(rider);
        renderOverviewTab(rider);
        renderDeliveriesTab(rider);
      }).catch(() => {});
    }
  }, REFRESH_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

// ── INIT ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  applyTheme();

  // ── Populate city dropdown ──────────────────────────
  const citySelect = document.getElementById('citySelect');
  if (citySelect) {
    CITIES.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city.id;
      opt.textContent = cityName(city);
      // Default to Jeddah (id=6)
      if (city.id === 6) opt.selected = true;
      citySelect.appendChild(opt);
    });

    citySelect.addEventListener('change', () => {
      const selected = CITIES.find(c => c.id === Number(citySelect.value));
      if (selected) {
        currentCityEntry  = selected;
        currentCompanyId  = null;
        previousStatuses  = {}; // reset status tracking for new city
        selectedRiderId   = null;
        allRiders         = [];
        filteredRiders    = [];
        document.getElementById('riderDetail').style.display = 'none';
        document.getElementById('emptyState').style.display  = 'flex';
        loadRiders();
      }
    });
  }

  applyLanguage();

  loadRiders();

  document.getElementById('btnTheme')?.addEventListener('click', toggleTheme);
  document.getElementById('btnLang')?.addEventListener('click', toggleLang);

  document.getElementById('btnRefresh').addEventListener('click', () => {
    loadRiders();
    if (currentPage === 'map') buildMap(document.getElementById('liveMap'));
    if (selectedRiderId) selectRider(selectedRiderId);
  });

  const toggle = document.getElementById('autoRefreshToggle');
  toggle.addEventListener('change', () => {
    if (toggle.checked) { startAutoRefresh(); toast(t('toast_auto_on'), 'info'); }
    else                { stopAutoRefresh();  toast(t('toast_auto_off'), 'info'); }
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
    tab.addEventListener('click', () => {
      switchTab(tab.dataset.tab);
    });
  });

  document.getElementById('closeDetail').addEventListener('click', () => {
    selectedRiderId = null;
    document.getElementById('riderDetail').style.display = 'none';
    document.getElementById('emptyState').style.display  = 'flex';
    document.querySelectorAll('.rider-card').forEach(c => c.classList.remove('selected'));
  });

  document.getElementById('navDashboard').addEventListener('click', showDashboardPage);
  document.getElementById('navMap').addEventListener('click', showMapPage);

  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') { e.preventDefault(); loadRiders(); }
    if (e.key === 'Escape') document.getElementById('closeDetail').click();
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
  });
});