/* ============================================================
   popArea.js — 인기 지역(좌측 사이드바) 데이터
   ------------------------------------------------------------
   TourAPI 데이터랩 "지역별 방문자 수" API로 최근 완결된 한 주(일~토)의
   시/군/구별 방문자 수를 합산해 상위 4곳을 뽑는다.
   - 데이터가 존재하는 최신 일자는 localStorage에 캐시하고 하루 한 번만 갱신 확인.
   - 인기 지역 리스트도 localStorage에 캐시하고 주(일요일)가 바뀔 때만 재호출.
   ============================================================ */
const baseUrl = "https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList";

/* v2: totalCount>0만으로 최신일자 판단하던 v1 캐시에 API가 데이터 없는 날에도
   가장 가까운 과거 데이터를 돌려준 탓에 오늘 날짜가 잘못 저장되는 문제가 있어
   키를 올려 기존 캐시를 무시하도록 함 */
const LATEST_DATE_KEY = 'wtg:tourApiLatestYmd:v2';
const POPULAR_CACHE_KEY = 'wtg:popularRegions:v2';

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
  const queryParams = {
    MobileOS: "ETC",
    MobileApp: "project1",
    serviceKey: decodeURIComponent(CONFIG.TOURAPI_BIGDATA_KEY), // CONFIG는 config.js에서 가져온 전역 객체
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
  try { cached = JSON.parse(localStorage.getItem(LATEST_DATE_KEY) || 'null'); } catch { /* 캐시 손상 시 무시 */ }
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

  localStorage.setItem(LATEST_DATE_KEY, JSON.stringify({ latestYmd: latest, checkedYmd: today }));
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

function rankBySigungu(items) {
  const totals = new Map();
  items.forEach((item) => {
    const entry = totals.get(item.signguCode) || {
      sigunguCode: item.signguCode,
      sigunguNm: item.signguNm,
      total: 0,
    };
    entry.total += Number(item.touNum) || 0;
    totals.set(item.signguCode, entry);
  });
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

const roundToTenThousand = (n) => Math.round(n / 10000) * 10000;

/* 상위 4개 인기 지역: { sigunguCode, sigunguNm, visitorCount(만 단위로 반올림된 값) } */
export async function getPopularRegions() {
  if (typeof CONFIG === 'undefined' || !CONFIG.TOURAPI_BIGDATA_KEY) {
    console.error('CONFIG.TOURAPI_BIGDATA_KEY가 없어 인기 지역을 불러오지 못했어요');
    return [];
  }

  const today = getKoreanYmdDaysAgo(0);
  const weekKey = sundayOfWeek(today);

  try {
    const cached = JSON.parse(localStorage.getItem(POPULAR_CACHE_KEY) || 'null');
    if (cached && cached.weekKey === weekKey) return cached.regions;
  } catch { /* 캐시 손상 시 무시하고 새로 계산 */ }

  const latest = await getLatestAvailableYmd();
  if (!latest) return [];

  const { start, end } = getLatestFullWeekRange(latest);
  const items = await fetchVisitorRange(start, end);
  const regions = rankBySigungu(items).slice(0, 4).map((r) => ({
    sigunguCode: r.sigunguCode,
    sigunguNm: r.sigunguNm,
    visitorCount: roundToTenThousand(r.total),
  }));

  localStorage.setItem(POPULAR_CACHE_KEY, JSON.stringify({ weekKey, regions }));
  return regions;
}
