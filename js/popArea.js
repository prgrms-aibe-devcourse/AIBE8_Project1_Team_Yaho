/* ============================================================
   popArea.js — 인기 지역 데이터 (좌측 사이드바 + 전체보기 페이지 popArea.html)
   ------------------------------------------------------------
   TourAPI 데이터랩 "지역별 방문자 수" API로 최근 완결된 한 주(일~토)의
   방문자 수를 시/군/구·관광객 유형별로 합산해두고, 그 위에서
   전체/광역자치단체/내국인/외국인 랭킹을 파생시킨다.
   - 데이터가 존재하는 최신 일자는 localStorage에 캐시하고 하루 한 번만 갱신 확인.
   - 주간 합계도 localStorage에 캐시하고 주(일요일)가 바뀔 때만 재호출 —
     사이드바 상위 4개든 전체보기 페이지 랭킹이든 이 캐시 하나로 다 계산한다.
   ============================================================ */
// 예전에는 TourAPI 데이터랩을 브라우저에서 직접 호출했지만, 그러려면 빅데이터
// 서비스키를 클라이언트 코드에 그대로 넣어야 해서 GitHub Pages처럼 정적으로
// 배포하면 그 키가 노출된다. 그래서 진짜 키는 Supabase Edge Function
// (supabase/functions/datalab-proxy) 안에만 두고, 여기서는 그 프록시 주소만 부른다.
const baseUrl = `${CONFIG.SUPABASE_URL}/functions/v1/datalab-proxy`;

/* 지도 SVG(images/map-korea.svg)에 그려진 시/도 id 17개 — REGIONS를 대체 (map.js와 동일) */
const MAP_SIDO_IDS = ['11','26','27','28','29','30','31','36','41','43','44','45','46','47','48','50','51'];

let bjdCodes = null;
const bjdCodesReady = fetch('data/bjd-codes.json')
  .then((res) => res.json())
  .then((data) => { bjdCodes = data; })
  .catch((err) => console.error('법정동 코드 로드 실패:', err));

/* v2: totalCount>0만으로 최신일자 판단하던 v1 캐시에 API가 데이터 없는 날에도
   가장 가까운 과거 데이터를 돌려준 탓에 오늘 날짜가 잘못 저장되는 문제가 있어
   키를 올려 기존 캐시를 무시하도록 함 */
/* 예전에는 localStorage(브라우저별)에 저장했지만, 이제는 Supabase api_cache
   테이블(js/apiCache.js)에 저장해서 다른 사람 브라우저가 이미 계산해둔 결과도
   같이 재사용한다. 신선도 판단은 아래 값 안의 checkedYmd/weekKey로 직접 하므로
   ApiCache.get()에는 ttlMs를 넘기지 않는다. */
const LATEST_DATE_KEY = 'wtg:tourApiLatestYmd:v2';
const WEEKLY_TOTALS_KEY = 'wtg:weeklyTotals:v1';

const getKoreanYmdDaysAgo = (daysAgo) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(date).replaceAll('-', '');
};

/* ymd(YYYYMMDD, 한국 기준 날짜) 사이의 일수 연산은 타임존 영향을 없애기 위해
   UTC 인스턴트 + 밀리초 연산으로 처리 */
const ymdToUTCms = (ymd) =>
  Date.parse(`${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}T00:00:00+09:00`);

const addDaysYmd = (ymd, days) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' })
    .format(new Date(ymdToUTCms(ymd) + days * 86400000))
    .replaceAll('-', '');

const daysBetweenYmd = (fromYmd, toYmd) => Math.round((ymdToUTCms(toYmd) - ymdToUTCms(fromYmd)) / 86400000);

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayOfWeek = (ymd) =>
  WEEKDAYS.indexOf(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' })
      .format(new Date(ymdToUTCms(ymd)))
  );

/* 해당 날짜가 속한 주의 일요일(달력 기준 주 시작일) */
const sundayOfWeek = (ymd) => addDaysYmd(ymd, -dayOfWeek(ymd));

async function fetchVisitorPage(startYmd, endYmd, pageNo, numOfRows) {
  // serviceKey는 이제 안 넣는다 — Edge Function(datalab-proxy)이 서버 쪽에서
  // 진짜 빅데이터 키를 붙여준다.
  const queryParams = {
    MobileOS: "ETC",
    MobileApp: "project1",
    startYmd,
    endYmd,
    pageNo,
    numOfRows,
    _type: 'json',
  };

  const url = `${baseUrl}?${new URLSearchParams(queryParams)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const body = (await res.json()).response.body;
  const totalCount = Number(body.totalCount) || 0;
  const items = totalCount === 0 ? [] : [].concat(body.items.item);
  return { items, totalCount };
}

async function fetchVisitorRange(startYmd, endYmd) {
  const numOfRows = 500;
  let pageNo = 1;
  let all = [];
  for (;;) {
    const { items, totalCount } = await fetchVisitorPage(startYmd, endYmd, pageNo, numOfRows);
    all = all.concat(items);
    if (items.length === 0 || all.length >= totalCount) break;
    pageNo += 1;
  }
  return all;
}

/* totalCount>0만으로 판단하면 안 됨 — 이 API는 요청한 날짜에 데이터가 없어도
   가장 가까운 과거 날짜의 데이터를 그냥 돌려주는 경우가 있어, 응답의 baseYmd가
   실제로 요청한 날짜와 같은지까지 확인해야 진짜로 그 날짜 데이터가 있는 것 */
async function hasDataOnDate(ymd) {
  const { items, totalCount } = await fetchVisitorPage(ymd, ymd, 1, 1);
  return totalCount > 0 && items[0]?.baseYmd === ymd;
}

/* 최초 실행 시 최신 일자 탐색 — 공개데이터 API 특성상 최신일자가 오늘보다
   몇 주~몇 달 전일 수 있어, 하루씩 거슬러 올라가는 대신 2배씩 건너뛰며 데이터가
   있는 지점을 찾고 그 구간을 이분 탐색해서 정확한 경계를 찾는다 */
async function findLatestAvailableYmd(today) {
  if (await hasDataOnDate(today)) return today;

  let noDataYmd = today;   /* 데이터 없음이 확인된, 가장 최근(늦은) 날짜 */
  let hasDataYmd = null;    /* 데이터 있음이 확인된, 가장 오래된 날짜 */
  let step = 1;
  for (let i = 0; i < 12 && !hasDataYmd; i++) { /* 최대 2^12일(약 11년) 전까지 탐색 */
    const probe = addDaysYmd(today, -step);
    if (await hasDataOnDate(probe)) hasDataYmd = probe;
    else noDataYmd = probe;
    step *= 2;
  }
  if (!hasDataYmd) return null;

  while (daysBetweenYmd(hasDataYmd, noDataYmd) > 1) {
    const mid = addDaysYmd(hasDataYmd, Math.floor(daysBetweenYmd(hasDataYmd, noDataYmd) / 2));
    if (await hasDataOnDate(mid)) hasDataYmd = mid;
    else noDataYmd = mid;
  }
  return hasDataYmd;
}

/* 데이터가 존재하는 최신 일자 — 하루 한 번만 API로 확인, 나머지는 캐시 사용 */
async function getLatestAvailableYmd() {
  const today = getKoreanYmdDaysAgo(0);

  let cached = null;
  try { cached = await window.ApiCache.get(LATEST_DATE_KEY); } catch { /* 캐시 손상 시 무시 */ }
  if (cached && cached.checkedYmd === today) return cached.latestYmd;

  let latest = cached ? cached.latestYmd : null;

  if (!latest) {
    latest = await findLatestAvailableYmd(today);
  } else {
    /* 캐시된 최신일 다음날부터 하루씩 전진하며, 데이터가 존재하는 한 계속 갱신 */
    let probe = addDaysYmd(latest, 1);
    while (probe <= today && (await hasDataOnDate(probe))) {
      latest = probe;
      probe = addDaysYmd(probe, 1);
    }
  }

  await window.ApiCache.set(LATEST_DATE_KEY, { latestYmd: latest, checkedYmd: today });
  return latest;
}

/* 데이터가 존재하는 최신 일자를 포함한 주가 아직 다 채워지지 않았다면
   그 이전 주(일~토 전체가 존재하는 가장 최신 주)를 대신 사용 */
function getLatestFullWeekRange(latestYmd) {
  const start = sundayOfWeek(latestYmd);
  const end = addDaysYmd(start, 6);
  if (end <= latestYmd) return { start, end };
  const prevStart = addDaysYmd(start, -7);
  return { start: prevStart, end: addDaysYmd(prevStart, 6) };
}

/* 일별 원본 데이터를 (시/군/구 × 관광객유형) 단위로 미리 합쳐둠 —
   날짜 차원은 다시 쓸 일이 없으니 캐시에 저장하기 전에 접어서 용량을 줄인다 */
function aggregateByCodeAndType(items) {
  const totals = new Map();
  items.forEach((item) => {
    const key = `${item.signguCode}|${item.touDivCd}`;
    const entry = totals.get(key) || { code: item.signguCode, name: item.signguNm, touDivCd: item.touDivCd, total: 0 };
    entry.total += Number(item.touNum) || 0;
    totals.set(key, entry);
  });
  return [...totals.values()];
}

/* 이번 주(일~토)의 (시/군/구 × 관광객유형) 합계 — 사이드바 상위 4개, 전체보기
   페이지의 전체/광역자치단체/내국인/외국인 랭킹이 전부 이 결과 하나를 공유한다 */
export async function getWeeklyTotals() {
  // 빅데이터 서비스키는 이제 클라이언트(config.js)에 없다 — Edge Function
  // (datalab-proxy)이 서버 쪽에서 갖고 있으므로, 여기서는 SUPABASE_URL만 있으면 됨
  if (typeof CONFIG === 'undefined' || !CONFIG.SUPABASE_URL) {
    console.error('CONFIG.SUPABASE_URL이 없어 인기 지역을 불러오지 못했어요');
    return [];
  }

  const weekKey = sundayOfWeek(getKoreanYmdDaysAgo(0));

  try {
    const cached = await window.ApiCache.get(WEEKLY_TOTALS_KEY);
    if (cached && cached.weekKey === weekKey) return cached.totals;
  } catch { /* 캐시 손상 시 무시하고 새로 계산 */ }

  const latest = await getLatestAvailableYmd();
  if (!latest) return [];

  const { start, end } = getLatestFullWeekRange(latest);
  const items = await fetchVisitorRange(start, end);
  const totals = aggregateByCodeAndType(items);

  await window.ApiCache.set(WEEKLY_TOTALS_KEY, { weekKey, totals });
  return totals;
}

/* touDivCds/sidoCode로 걸러서 groupBy 기준(시/군/구 또는 광역자치단체)으로 합산 */
function sumByGroup(totals, { touDivCds, sidoCode, groupBy }) {
  const grouped = new Map();
  totals.forEach((t) => {
    if (!touDivCds.includes(t.touDivCd)) return;
    if (sidoCode && !t.code.startsWith(sidoCode)) return;
    const key = groupBy === 'sido' ? t.code.slice(0, 2) : t.code;
    grouped.set(key, (grouped.get(key) || 0) + t.total);
  });
  return [...grouped.entries()]
    .map(([code, total]) => ({ code, total }))
    .sort((a, b) => b.total - a.total);
}

const roundToTenThousand = (n) => Math.round(n / 10000) * 10000;

/* 이 API의 시/도 코드는 법정동코드 기준 시/도 id와 완전히 같지 않음 — 실측해보니
   전북은 개편 전 코드(45) 대신 전북특별자치도 코드(52)로 오고, 광주·전남은 "12"
   하나로 묶여서 온다(둘을 구분해서 주지 않음). 지도가 쓰는 시/도 id로 필터링/표시하려면
   이 API가 실제로 쓰는 코드로 옮겨줘야 한다 */
const SIDO_API_ALIASES = { 29: '12', 46: '12', 45: '52' };
const SIDO_FALLBACK_NAMES = { 12: '광주광역시 · 전라남도', 52: '전북특별자치도' };

/* scope: 'all' | 'sido' | 'domestic' | 'foreign'
   - all/domestic/foreign: 시/군/구 랭킹 (touDivCd 필터만 다름 — 1:현지인 2:외지인 3:외국인)
   - sido: sidoCode 없으면 광역자치단체 랭킹, 있으면 그 시/도 안 시/군/구 랭킹
   sidoCode는 지도가 쓰는 시/도 id를 그대로 받는다(위 별칭 처리는 이 함수 안에서 함).
   반환: [{ code, name, visitorCount(만 단위로 반올림된 값) }] (내림차순, 페이지네이션은 호출부 몫) */
export async function getRegionRanking({ scope = 'all', sidoCode = null } = {}) {
  const totals = await getWeeklyTotals();
  if (!totals.length) return [];
  await bjdCodesReady;

  const apiSidoCode = sidoCode ? (SIDO_API_ALIASES[sidoCode] || sidoCode) : null;
  const touDivCds = scope === 'domestic' ? ['1', '2'] : scope === 'foreign' ? ['3'] : ['1', '2', '3'];
  const groupBy = scope === 'sido' && !apiSidoCode ? 'sido' : 'sigungu';
  const rows = sumByGroup(totals, { touDivCds, sidoCode: apiSidoCode, groupBy });

  const nameOf = (code) => {
    if (groupBy === 'sido') return (bjdCodes && bjdCodes.sido[code]) || SIDO_FALLBACK_NAMES[code] || code;
    return (totals.find((t) => t.code === code) || {}).name || code;
  };

  return rows.map((r) => ({ code: r.code, name: nameOf(r.code), visitorCount: roundToTenThousand(r.total) }));
}

/* 사이드바용 상위 4개 — { sigunguCode, sigunguNm, visitorCount } */
export async function getPopularRegions() {
  const ranking = await getRegionRanking({ scope: 'all' });
  return ranking.slice(0, 4).map((r) => ({ sigunguCode: r.code, sigunguNm: r.name, visitorCount: r.visitorCount }));
}

/* ============================================================
   전체보기 페이지 (popArea.html) 전용 — 탭/아코디언/페이지네이션
   index.html에는 이 페이지의 DOM이 없어 root 엘리먼트를 못 찾고 조용히 빠져나간다
   ============================================================ */
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const PAGE_SIZE = 30;

function initPopAreaPage() {
  const el = {
    tabs: document.getElementById('popAreaTabs'),
    accordion: document.getElementById('popAreaAccordion'),
    sidoRow1: document.getElementById('popAreaSidoRow1'),
    sidoRow2: document.getElementById('popAreaSidoRow2'),
    list: document.getElementById('popAreaList'),
    pagination: document.getElementById('popAreaPagination'),
  };
  if (!el.tabs || !el.list) return;

  const state = { scope: 'all', sidoCode: null, page: 1, ranking: [] };

  function renderSidoButtons() {
    const li = (id) => `
      <li>
        <button type="button" class="chip chip--filter${state.sidoCode === id ? ' is-active' : ''}" data-sido="${id}">
          ${(bjdCodes && bjdCodes.sido[id]) || id}
        </button>
      </li>`;
    el.sidoRow1.innerHTML = MAP_SIDO_IDS.slice(0, 10).map(li).join('');
    el.sidoRow2.innerHTML = MAP_SIDO_IDS.slice(10).map(li).join('');
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) { el.pagination.innerHTML = ''; return; }
    const pageBtn = (label, page, opts = {}) => `
      <button type="button" data-page="${page}"
        class="${opts.active ? 'is-active' : ''}" ${opts.disabled ? 'disabled' : ''}>${label}</button>`;
    let html = pageBtn('‹', state.page - 1, { disabled: state.page === 1 });
    for (let p = 1; p <= totalPages; p++) html += pageBtn(p, p, { active: p === state.page });
    html += pageBtn('›', state.page + 1, { disabled: state.page === totalPages });
    el.pagination.innerHTML = html;
  }

  function renderList() {
    const total = state.ranking.length;
    if (!total) {
      el.list.innerHTML = `<li class="popArea-empty">표시할 인기 지역이 없어요</li>`;
      el.pagination.innerHTML = '';
      return;
    }

    const totalPages = Math.ceil(total / PAGE_SIZE);
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const start = (state.page - 1) * PAGE_SIZE;

    el.list.innerHTML = state.ranking.slice(start, start + PAGE_SIZE).map((r, i) => {
      const rank = start + i + 1;
      const medal = rank === 1 ? ' is-gold' : rank === 2 ? ' is-silver' : rank === 3 ? ' is-bronze' : '';
      return `
        <li>
          <a class="popular__btn popular__btn--page" href="#">
            <span class="popular__rank popular__rank--page${medal}">${rank}</span>
            <span class="popular__body">
              <span class="popular__name">${r.name}</span>
              <span class="popular__desc">주간 방문 ${r.visitorCount / 10000}만 명</span>
            </span>
            <svg class="ico ico--chevron" aria-hidden="true"><use href="#i-chevron-right"></use></svg>
          </a>
        </li>`;
    }).join('');

    renderPagination(totalPages);
  }

  async function loadRanking() {
    el.list.innerHTML = `<li class="popArea-empty">불러오는 중…</li>`;
    el.pagination.innerHTML = '';
    try {
      state.ranking = await getRegionRanking({ scope: state.scope, sidoCode: state.sidoCode });
    } catch (err) {
      console.error('인기 지역 랭킹 로드 실패:', err);
      state.ranking = [];
    }
    state.page = 1;
    renderList();
  }

  el.tabs.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scope]');
    if (!btn) return;
    state.scope = btn.dataset.scope;
    state.sidoCode = null;
    $$('.popArea-tab', el.tabs).forEach((t) => t.classList.toggle('is-active', t === btn));
    el.accordion.hidden = state.scope !== 'sido';
    if (state.scope === 'sido') renderSidoButtons();
    loadRanking();
  });

  el.accordion.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sido]');
    if (!btn) return;
    state.sidoCode = state.sidoCode === btn.dataset.sido ? null : btn.dataset.sido;
    renderSidoButtons();
    loadRanking();
  });

  el.pagination.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-page]');
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    renderList();
  });

  loadRanking();
}

document.addEventListener('DOMContentLoaded', initPopAreaPage);
