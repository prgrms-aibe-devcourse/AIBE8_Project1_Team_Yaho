/* ============================================================
   main.js — 화면 렌더링 & 인터랙션
   ============================================================ */
import { initMap } from './map.js';
import { getPopularRegions } from './popArea.js';

(function () {
  'use strict';

  /* ---------- 유틸 ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const icon = (name, cls = 'ico') =>
    `<svg class="${cls}" aria-hidden="true"><use href="#${name}"></use></svg>`;

  /* "이런 여행지 어때요?" 카테고리 칩 → TourAPI 분류체계 대분류(lclsSystm1) 코드
     (lclsSystmCode2 오퍼레이션으로 실측 확인: NA=자연관광, HS=역사관광, EX=체험관광,
      LS=레저스포츠, SH=쇼핑, VE=문화관광, FD=음식). '전체'는 코드 없이 조회 */
  const CATEGORY_LCLS = {
    자연: 'NA', 역사: 'HS', 체험: 'EX', 레저: 'LS', 쇼핑: 'SH', 문화: 'VE', 음식: 'FD',
  };
  const SPOT_GRID_FALLBACK_IMG = 'images/th-hallasan.png';
  const SPOT_PAGE_SIZE = 4;      /* 2x2 그리드 한 페이지 분량 */
  const SPOT_TOTAL_PAGES = 5;
  const SPOT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; /* localStorage 캐시 유효 기간(1일) */

  /* ---------- 상태 ---------- */
  const state = {
    origin: null,
    originId: null, /* 선택한 시/군/구 법정동 코드 — 대표좌표 조회 키로 씀 */
    spotCategory: '전체',
    spotPage: 1,
    popularRegions: null, /* getPopularRegions() 로딩 전까지는 null → 샘플 데이터로 자리 표시 */
  };

  /* ---------- 출발지 드롭업 (시/도 → 시/군/구) ---------- */
  let bjdCodes = null;
  fetch('data/bjd-codes.json')
    .then((res) => res.json())
    .then((data) => { bjdCodes = data; })
    .catch((err) => console.error('법정동 코드 로드 실패:', err));

  let originLevel = 'sido';   /* 'sido' | 'sigungu' */
  let originSidoPick = null;  /* 시군구 목록 조회 중인 시/도 코드 */
  let mapApi = null;          /* initMap()이 반환하는 { selectSigunguCode } — 인기 지역 클릭 시 사용 */

  /* --- 지오코딩 결과 캐시 (localStorage, TTL 10분) — 껐다 켜거나 새로고침해도 재호출 방지 --- */
  const GEO_TTL_MS = 10 * 60 * 1000;
  function getGeoCache() {
    try {
      const cached = JSON.parse(localStorage.getItem('wtg:geo') || 'null');
      if (!cached || Date.now() - cached.ts > GEO_TTL_MS) return null;
      return cached;
    } catch { return null; }
  }
  function setGeoCache(origin, originId) {
    localStorage.setItem('wtg:geo', JSON.stringify({ origin, originId, ts: Date.now() }));
  }

  /* --- 지역선택 라벨 갱신 + 지도에서 그 시/군/구로 확대·강조·미리보기 ---
     selectSigunguCode()가 아직 그 시/도로 확대 안 된 상태면 내부에서 zoomToRegion()을
     먼저 돌리는데, zoomToRegion()이 끝나면서 미리보기 패널을 닫아버림 — 확대가 끝난 뒤에
     showRegionPreview()를 불러야 뜬 패널이 곧바로 닫히지 않음 */
  async function goToMyRegion(origin, originId) {
    state.origin = origin;
    state.originId = originId;
    el.originLabel.textContent = origin;
    if (!mapApi) return;
    await mapApi.selectSigunguCode(originId);
    mapApi.showRegionPreview(originId.slice(0, 2), originId);
  }

  /* ---------- DOM ---------- */
  const el = {
    popularList:   $('#popularList'),
    spotGrid:      $('#spotGrid'),
    categoryFilter: $('#categoryFilter'),
    spotPagerPrev:  $('#spotPagerPrev'),
    spotPagerNext:  $('#spotPagerNext'),
    spotPagerLabel: $('#spotPagerLabel'),
    markers:       $('#markers'),
    mapTip:        $('#mapTip'),

    draw:      $('.draw'),
    btnDraw:   $('#btnDraw'),
    myRecord:  $('#myRecord'),
    btnGeo:    $('#btnGeo'),
    geoLabel:  $('#geoLabel'),

    originSelect: $('#originSelect'),
    originLabel:  $('#originLabel'),
    originList:   $('#originList'),

    toast:     $('#toast'),
  };

  /* ============================================================
     렌더링
     ============================================================ */

  /* --- 인기 지역 (TourAPI 주간 방문자 수 기준 상위 4곳) --- */
  function renderPopular() {
    const list = state.popularRegions
      || Array.from({ length: 4 }, () => ({ title: '불러오는 중…', desc: '', sigunguCode: null }));
    el.popularList.innerHTML = list.map((p, i) => `
      <li>
        <button class="popular__btn" type="button" ${p.sigunguCode ? `data-sigungu="${p.sigunguCode}"` : ''}>
          <span class="popular__rank">${i + 1}</span>
          <span class="popular__body">
            <span class="popular__name">${p.title}</span>
            <span class="popular__desc">${p.desc}</span>
          </span>
          ${icon('i-chevron-right', 'ico ico--chevron')}
        </button>
      </li>`).join('');
  }

  /* TourAPI 인기 지역 데이터 로딩 — 실패해도 샘플 자리표시 그대로 유지 */
  async function loadPopularRegions() {
    try {
      const regions = await getPopularRegions();
      if (!regions.length) return;
      state.popularRegions = regions.map((r) => ({
        title: r.sigunguNm,
        desc: `주간 방문 ${r.visitorCount / 10000}만 명`,
        sigunguCode: r.sigunguCode,
      }));
      renderPopular();
    } catch (err) {
      console.error('인기 지역 로드 실패:', err);
    }
  }

  /* --- "이런 여행지 어때요?" 그리드 (좌측) — TourAPI 분류체계(lclsSystm1) 기준, 카테고리별 5페이지 --- */

  /* 호출 결과 localStorage 캐시 (카테고리+페이지 단위, 1일 TTL) — 페이지/카테고리를
     오갈 때마다 매번 API를 다시 부르지 않도록 함 */
  /* v2: contentTypeId 고정을 풀어 결과가 달라져 기존 v1 캐시를 무효화 */
  const spotCacheKey = (category, page) => `wtg:spotGrid:v2:${category}:${page}`;
  function getSpotCache(category, page) {
    try {
      const cached = JSON.parse(localStorage.getItem(spotCacheKey(category, page)) || 'null');
      if (!cached || Date.now() - cached.ts > SPOT_CACHE_TTL_MS) return null;
      return cached.items;
    } catch { return null; }
  }
  function setSpotCache(category, page, items) {
    try {
      localStorage.setItem(spotCacheKey(category, page), JSON.stringify({ items, ts: Date.now() }));
    } catch { /* 저장 실패(용량 초과 등) 무시 */ }
  }

  function renderSpotPager() {
    if (!el.spotPagerLabel) return;
    el.spotPagerLabel.textContent = `${state.spotPage}/${SPOT_TOTAL_PAGES}`;
    el.spotPagerPrev.disabled = state.spotPage <= 1;
    el.spotPagerNext.disabled = state.spotPage >= SPOT_TOTAL_PAGES;
  }

  function renderSpotItems(items) {
    if (!items.length) {
      el.spotGrid.innerHTML = `<li class="spot-grid__empty">표시할 여행지가 없어요</li>`;
      return;
    }
    el.spotGrid.innerHTML = items.map((it) => `
      <li>
        <a class="spot-grid__btn" href="detail.html?id=${it.contentid}&type=${it.contenttypeid}">
          <img class="spot-grid__img" src="${it.firstimage || it.firstimage2 || SPOT_GRID_FALLBACK_IMG}" alt="" loading="lazy" />
          <span class="spot-grid__name" title="${it.title.replace(/"/g, '&quot;')}">${it.title}</span>
        </a>
      </li>`).join('');
  }

  let spotGridReqId = 0;
  async function loadSpotGrid(category, page) {
    state.spotCategory = category;
    state.spotPage = page;
    renderSpotPager();

    const reqId = ++spotGridReqId;
    const cached = getSpotCache(category, page);
    if (cached) { renderSpotItems(cached); return; }

    el.spotGrid.innerHTML = `<li class="spot-grid__empty">불러오는 중…</li>`;
    try {
      /* arrange:'Q' — 대표이미지가 반드시 있는 수정일순(최신순) 정렬. 매번 같은
         순서로 오는 결정적 목록이라, 페이지를 넘겨야 서로 다른 여행지가 나옴.
         contentTypeId는 비워서 관광지(12)로만 좁히지 않고 문화시설·음식점·쇼핑 등
         분류체계(lclsSystm1)에 걸리는 모든 타입이 나오게 함 */
      const items = await TourAPI.getTravelList({
        numOfRows: SPOT_PAGE_SIZE, pageNo: page, arrange: 'Q', lclsSystm1: CATEGORY_LCLS[category],
        contentTypeId: null,
      });
      if (reqId !== spotGridReqId) return; /* 응답 오는 사이 다른 카테고리/페이지가 선택됨 */
      setSpotCache(category, page, items);
      renderSpotItems(items);
    } catch (err) {
      console.error('여행지 목록 로드 실패:', err);
      if (reqId === spotGridReqId) el.spotGrid.innerHTML = `<li class="spot-grid__empty">여행지를 불러오지 못했어요</li>`;
    }
  }

  /* --- 출발지 드롭업 (시/도 목록 또는 선택된 시/도의 시/군/구 목록) --- */
  function renderOriginDropup() {
    if (!el.originList || !bjdCodes) return;

    const items = originLevel === 'sigungu'
      ? Object.keys(bjdCodes.sigungu)
          .filter((id) => id.startsWith(originSidoPick))
          .map((id) => ({ id, name: bjdCodes.sigungu[id] }))
      : Object.keys(bjdCodes.sido).map((id) => ({ id, name: bjdCodes.sido[id] }));
    items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

    const back = originLevel === 'sigungu'
      ? '<li><button type="button" class="origin__list-back" data-back="1">‹ 시/도 다시 선택</button></li>'
      : '';
    el.originList.innerHTML = back + items
      .map((it) => `<li role="option"><button type="button" data-id="${it.id}">${it.name}</button></li>`)
      .join('');
  }

  function openOriginDropup() {
    originLevel = 'sido';
    originSidoPick = null;
    renderOriginDropup();
    const rect = el.originSelect.getBoundingClientRect();
    el.originList.style.left = `${rect.right + 10}px`;
    el.originList.style.top  = `${rect.top}px`;
    el.originSelect.setAttribute('aria-expanded', 'true');
    el.originList.hidden = false;
  }

  function closeOriginDropup() {
    el.originSelect.setAttribute('aria-expanded', 'false');
    el.originList.hidden = true;
  }

  /* --- 좌표 → 시/도·시/군/구 (네이버 리버스 지오코딩 + bjd-codes 매칭) --- */
  function resolveOriginFromCoords(lat, lng) {
    if (!window.naver || !naver.maps.Service) {
      showToast('지도 API 로드에 실패했어요');
      el.geoLabel.textContent = '내 위치로 이동';
      return;
    }
    naver.maps.Service.reverseGeocode(
      {
        coords: new naver.maps.LatLng(lat, lng),
        orders: [naver.maps.Service.OrderType.ADDR].join(','),
      },
      (status, res) => {
        el.geoLabel.textContent = '내 위치로 이동';
        if (status !== naver.maps.Service.Status.OK) {
          showToast('위치를 주소로 변환하지 못했어요');
          return;
        }
        const region = res.v2.results[0]?.region;
        const sidoName = region?.area1?.name;
        const sigunguName = region?.area2?.name;
        if (!sidoName || !bjdCodes) {
          showToast('지역을 특정하지 못했어요');
          return;
        }
        const sidoId = Object.keys(bjdCodes.sido).find((id) => bjdCodes.sido[id] === sidoName);
        const sigunguId = sidoId && sigunguName
          ? Object.keys(bjdCodes.sigungu).find((id) => id.startsWith(sidoId) && bjdCodes.sigungu[id] === sigunguName)
          : null;

        if (!sigunguId) {
          showToast('지역을 특정하지 못했어요');
          return;
        }
        const origin = `${sidoName} ${sigunguName}`;
        setGeoCache(origin, sigunguId);
        goToMyRegion(origin, sigunguId);
      }
    );
  }

  /* --- 내 여행 기록 ---
     로그인 여부는 js/authState.js가 Supabase 세션을 보고 판단해준다
     (window.isLoggedIn()). */

  function getBookmarkCount() {
    try {
      const list = JSON.parse(localStorage.getItem('travelBookmarks_v1') || '[]');
      return Array.isArray(list) ? list.length : 0;
    } catch (e) { return 0; }
  }

  function getJournalCount() {
    try {
      const s = JSON.parse(localStorage.getItem('travelDiaryState_v1') || 'null');
      if (!s || !Array.isArray(s.albums)) return 0;
      return s.albums.reduce((sum, a) => sum + (a.entries ? a.entries.length : 0), 0);
    } catch (e) { return 0; }
  }

  function renderMyRecord() {
    if (!el.myRecord) return;
    if (window.isLoggedIn()) {
      el.myRecord.innerHTML = `
        <ul>
          <li class="my-record__row">
            <svg class="ico"><use href="#i-bookmark"/></svg>
            <span>북마크 </span>
            <strong class="stat__value">${getBookmarkCount()}개</strong>
          </li>
          <li class="my-record__row">
            <svg class="ico"><use href="#i-notebook"/></svg>
            <span>여행 수첩 </span><strong class="stat__value">${getJournalCount()}개</strong>
          </li>
        </ul>
        <button class="my-record__btn" type="button" id="btnRecordView">기록 보러가기</button>`;
    } else {
      el.myRecord.innerHTML = `
        <p class="my-record__msg">북마크와 여행 수첩을 남겨보세요</p>
        <button class="my-record__btn" type="button" id="btnRecordLogin">로그인하고 시작하기</button>`;
    }
  }

  /* 토스트 */
  let toastTimer;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 2200);
  }

  /* ============================================================
     이벤트 바인딩
     ============================================================ */
  function bindEvents() {
    /* 카테고리 필터 칩 → TourAPI 분류체계로 spotGrid 재조회 (1페이지부터) */
    if (el.categoryFilter) {
      el.categoryFilter.addEventListener('click', (e) => {
        const chip = e.target.closest('[data-cat]');
        if (!chip) return;
        $$('.chip--filter', el.categoryFilter).forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        loadSpotGrid(chip.dataset.cat, 1);
      });
    }

    /* spotGrid 페이지네이션 ("< 1/5 >") */
    if (el.spotPagerPrev) {
      el.spotPagerPrev.addEventListener('click', () => loadSpotGrid(state.spotCategory, state.spotPage - 1));
    }
    if (el.spotPagerNext) {
      el.spotPagerNext.addEventListener('click', () => loadSpotGrid(state.spotCategory, state.spotPage + 1));
    }

    /* 인기 지역 — 클릭하면 오늘의 여행지 대신 지도에서 해당 시/군/구를 선택 상태로 표시 */
    if (el.popularList) {
      el.popularList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sigungu]');
        if (btn && mapApi) mapApi.selectSigunguCode(btn.dataset.sigungu);
      });
    }

    /* 마커 호버 툴팁 — 핀(마커) 기능 보류로 주석 처리
    el.markers.addEventListener('mouseover', (e) => {
      const m = e.target.closest('.marker');
      if (m) showTip(m);
    });
    el.markers.addEventListener('mouseout', (e) => {
      if (!e.relatedTarget || !e.relatedTarget.closest('.marker')) el.mapTip.hidden = true;
    });
    el.markers.addEventListener('focusin', (e) => {
      const m = e.target.closest('.marker');
      if (m) showTip(m);
    });
    el.markers.addEventListener('focusout', () => { el.mapTip.hidden = true; });
    */

    /* 헤더 로그인/로그아웃 시 내 여행 기록 갱신 */
    window.addEventListener('wtg:auth-changed', renderMyRecord);

    /* 내 여행 기록 */
    if (el.myRecord) {
      el.myRecord.addEventListener('click', (e) => {
        if (e.target.closest('#btnRecordLogin')) {
          try { sessionStorage.setItem('postLoginRedirect', location.href); }
          catch (err) { /* 저장 실패해도 로그인 자체는 진행 */ }
          location.href = 'login.html';
        } else if (e.target.closest('#btnRecordView')) {
          location.href = 'album.html';
        }
      });
    }

    /* 출발지 드롭업 (시/도 → 시/군/구) */
    el.originSelect.addEventListener('click', () => {
      const open = el.originSelect.getAttribute('aria-expanded') === 'true';
      if (open) closeOriginDropup();
      else openOriginDropup();
    });

    el.originList.addEventListener('click', (e) => {
      /* renderOriginDropup()이 innerHTML을 통째로 새로 그려서 클릭된 버튼이 DOM에서
         떨어져 나감 — 이 클릭이 document의 "바깥 클릭 감지" 리스너까지 버블링되면
         e.target.closest('.origin')이 null이 되어 방금 고른 시/도 목록이 그 자리에서
         바로 닫혀버림. 여기서 막아서 바깥 클릭 리스너가 이 클릭을 보지 못하게 함 */
      e.stopPropagation();

      const backBtn = e.target.closest('[data-back]');
      if (backBtn) {
        originLevel = 'sido';
        originSidoPick = null;
        renderOriginDropup();
        return;
      }

      const btn = e.target.closest('button[data-id]');
      if (!btn || !bjdCodes) return;

      if (originLevel === 'sido') {
        originSidoPick = btn.dataset.id;
        originLevel = 'sigungu';
        renderOriginDropup();
        return;
      }

      const sidoName = bjdCodes.sido[originSidoPick] || '';
      const sigunguName = bjdCodes.sigungu[btn.dataset.id] || '';
      state.origin = `${sidoName} ${sigunguName}`;
      state.originId = btn.dataset.id;
      el.originLabel.textContent = state.origin;
      closeOriginDropup();
      showToast(`${state.origin} 여행지를 살펴보세요`);
      if (mapApi) mapApi.showRegionPreview(originSidoPick, btn.dataset.id);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.origin')) closeOriginDropup();
    });

    /* 내 위치로 이동 — 누를 때마다 geolocation → 네이버 리버스 지오코딩으로 시/군/구 특정해서
       바로 그 지역으로 지도 확대 + 강조 (토글 아님, 매번 한 번씩 실행되는 동작).
       - localStorage 캐시(TTL 10분): 짧은 시간 안에 다시 누르면 API 재호출 없이 캐시로 바로 이동
       - maximumAge: 브라우저가 최근 측위 결과 있으면 GPS 재측위 자체를 스킵 */
    el.btnGeo.addEventListener('click', () => {
      const cached = getGeoCache();
      if (cached) {
        goToMyRegion(cached.origin, cached.originId);
        return;
      }
      if (!navigator.geolocation) {
        showToast('이 브라우저는 위치 정보를 지원하지 않아요');
        return;
      }
      el.geoLabel.textContent = '위치 확인 중…';
      navigator.geolocation.getCurrentPosition(
        (pos) => resolveOriginFromCoords(pos.coords.latitude, pos.coords.longitude),
        () => {
          showToast('위치 권한이 거부됐어요');
          el.geoLabel.textContent = '내 위치로 이동';
        },
        { maximumAge: GEO_TTL_MS }
      );
    });

    /* ESC — 열린 것 닫기 */
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      closeOriginDropup();
      el.mapTip.hidden = true;
    });
  }

  /* ============================================================
     시작
     ============================================================ */
  function init() {
    renderPopular();
    loadSpotGrid('전체', 1);

    renderMyRecord();
    mapApi = initMap({ showToast, drawEl: el.draw, drawBtnEl: el.btnDraw });
    bindEvents();
    loadPopularRegions();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
