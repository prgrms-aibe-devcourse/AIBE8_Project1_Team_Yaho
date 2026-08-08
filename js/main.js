/* ============================================================
   main.js — 화면 렌더링 & 인터랙션
   ============================================================ */
import { ORIGINS, TRANSPORTS, DESTINATIONS, POPULAR, THEMES } from './data.js';
import { initMap } from './map.js';

(function () {
  'use strict';

  /* ---------- 유틸 ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const won = (n) => '약 ' + n.toLocaleString('ko-KR') + '원';
  const byId = (id) => DESTINATIONS.find((d) => d.id === id);

  const icon = (name, cls = 'ico') =>
    `<svg class="${cls}" aria-hidden="true"><use href="#${name}"></use></svg>`;

  /* ---------- 상태 ---------- */
  const state = {
    destId: 'gangneung',
    transport: 'car',
    origin: ORIGINS[0],
    useGeo: true,
    /* 첫 방문 시엔 시안과 동일하게 강릉이 찜된 상태로 시작 */
    liked: new Set(JSON.parse(localStorage.getItem('wtg:liked') || '["gangneung"]')),
    themeIndex: 0,
  };

  /* ---------- DOM ---------- */
  const el = {
    transportList: $('#transportList'),
    popularList:   $('#popularList'),
    spotGrid:      $('#spotGrid'),
    markers:       $('#markers'),
    mapTip:        $('#mapTip'),
    fareList:      $('#fareList'),
    themeTrack:    $('#themeTrack'),

    todayImg:    $('#todayImg'),
    todayRegion: $('#todayRegion'),
    todayName:   $('#todayName'),
    todayDesc:   $('#todayDesc'),
    statTime:    $('#statTime'),
    statDist:    $('#statDist'),

    draw:      $('.draw'),
    btnDraw:   $('#btnDraw'),
    btnLike:   $('#btnLike'),
    btnGo:     $('#btnGo'),
    btnGeo:    $('#btnGeo'),
    geoLabel:  $('#geoLabel'),
    btnSaved:  $('#btnSaved'),
    savedCount:$('#savedCount'),

    originSelect: $('#originSelect'),
    originLabel:  $('#originLabel'),
    originList:   $('#originList'),

    themePrev: $('#themePrev'),
    themeNext: $('#themeNext'),
    toast:     $('#toast'),
  };

  /* ============================================================
     렌더링
     ============================================================ */

  /* --- 교통수단 목록 --- */
  function renderTransports() {
    if (!el.transportList) return;
    const dest = byId(state.destId);
    el.transportList.innerHTML = TRANSPORTS.map((t) => {
      const info = dest.fares[t.key];
      return `
        <li>
          <button class="transport__btn${state.transport === t.key ? ' is-active' : ''}${info ? '' : ' is-unavailable'}"
                  type="button" data-transport="${t.key}" ${info ? '' : 'disabled'}>
            ${icon(t.icon)}<span>${t.label}</span>
            ${info ? '' : '<span class="transport__na">운행 없음</span>'}
          </button>
        </li>`;
    }).join('');
  }

  /* --- 인기 지역 --- */
  function renderPopular() {
    el.popularList.innerHTML = POPULAR.map((p, i) => `
      <li>
        <button class="popular__btn" type="button" data-dest="${p.destId}">
          <img class="popular__thumb" src="${p.thumb}" alt="" />
          <span class="popular__rank">${i + 1}</span>
          <span class="popular__body">
            <span class="popular__name">${p.title}</span>
            <span class="popular__desc">${p.desc}</span>
          </span>
          ${icon('i-chevron-right', 'ico ico--chevron')}
        </button>
      </li>`).join('');
  }

  /* --- 인기 여행지 그리드 (좌측) --- */
  function renderSpotGrid() {
    el.spotGrid.innerHTML = THEMES.map((t) => `
      <li>
        <button class="spot-grid__btn" type="button" data-dest="${t.destId}">
          <img class="spot-grid__img" src="${t.img}" alt="" loading="lazy" />
          <span class="spot-grid__name">${t.name}</span>
        </button>
      </li>`).join('');
  }

  /* --- 테마별 추천 --- */
  function renderThemes() {
    if (!el.themeTrack) return;
    el.themeTrack.innerHTML = THEMES.map((t) => `
      <li>
        <button class="theme-card" type="button" data-dest="${t.destId}">
          <span class="theme-card__tag">
            <span class="theme-card__dot" style="--tone:${t.tone}">${t.glyph}</span>#${t.tag}
          </span>
          <span class="theme-card__name">${t.name}</span>
          <img class="theme-card__img" src="${t.img}" alt="" loading="lazy" />
        </button>
      </li>`).join('');
  }

  /* --- 출발지 목록 --- */
  function renderOrigins() {
    el.originList.innerHTML = ORIGINS.map((o) => `
      <li role="option" data-origin="${o}" aria-selected="${o === state.origin}">${o}</li>`).join('');
  }

  /* --- 교통 정보 (해당 여행지에서 이용 가능한 수단만) --- */
  function renderFares() {
    if (!el.fareList) return;
    const dest = byId(state.destId);
    const rows = TRANSPORTS.filter((t) => dest.fares[t.key]);

    el.fareList.innerHTML = rows.map((t) => {
      const info = dest.fares[t.key];
      return `
        <li class="fare${state.transport === t.key ? ' is-active' : ''}" data-transport="${t.key}">
          <span class="fare__icon" aria-hidden="true">${t.emoji}</span>
          <span class="fare__body">
            <span class="fare__label">${t.fareLabel}</span>
            <span class="fare__time">약 ${info.time}</span>
          </span>
          <span class="fare__cost">${won(info.cost)}</span>
        </li>`;
    }).join('');
  }

  /* --- 오늘의 여행지 카드 --- */
  function renderToday() {
    const dest = byId(state.destId);
    const info = dest.fares[state.transport];

    el.todayImg.src        = dest.photo;
    el.todayImg.alt        = `${dest.region} ${dest.name}`;
    el.todayRegion.textContent = dest.region;
    el.todayName.textContent   = dest.name;
    el.todayDesc.innerHTML     = dest.desc;
    el.statTime.textContent    = info ? info.time : '이용 불가';
    el.statDist.textContent    = dest.distance;

    const liked = state.liked.has(dest.id);
    el.btnLike.setAttribute('aria-pressed', String(liked));
    el.btnLike.setAttribute('aria-label', liked ? '찜 해제' : '찜하기');
  }

  /* --- 찜 카운트 --- */
  function renderSavedCount() {
    const n = state.liked.size;
    el.savedCount.textContent = n;
    el.savedCount.hidden = n === 0;
    el.btnSaved.classList.toggle('is-on', n > 0);
  }

  /* --- 활성 표시 동기화 --- */
  function syncActive() {
    $$('.marker', el.markers).forEach((m) =>
      m.classList.toggle('is-active', m.dataset.dest === state.destId));
    $$('.popular__btn', el.popularList).forEach((b) =>
      b.classList.toggle('is-active', b.dataset.dest === state.destId));
  }

  /* ============================================================
     동작
     ============================================================ */

  /* 여행지 선택 */
  function selectDestination(id, opts = {}) {
    const dest = byId(id);
    if (!dest) return;
    state.destId = id;

    /* 현재 교통수단을 못 쓰면 이용 가능한 첫 수단으로 자동 전환 */
    if (!dest.fares[state.transport]) {
      const first = TRANSPORTS.find((t) => dest.fares[t.key]);
      if (first) state.transport = first.key;
    }

    renderTransports();
    renderFares();
    renderToday();
    syncActive();

    if (opts.toast !== false) showToast(`📍 ${dest.region} ${dest.name}`);
  }

  /* 교통수단 선택 */
  function selectTransport(key) {
    const dest = byId(state.destId);
    if (!dest.fares[key]) return;
    state.transport = key;
    renderTransports();
    renderFares();
    renderToday();
  }

  /* 토스트 */
  let toastTimer;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 2200);
  }

  /* 캐러셀 */
  function themeStep() {
    const card = $('.theme-card', el.themeTrack);
    if (!card) return 145;
    const gap = parseFloat(getComputedStyle(el.themeTrack).columnGap) || 18;
    return card.getBoundingClientRect().width + gap;
  }

  function themeMaxIndex() {
    const viewport = $('.themes__viewport').clientWidth;
    const step = themeStep();
    const visible = Math.max(1, Math.floor((viewport + 18) / step));
    return Math.max(0, THEMES.length - visible);
  }

  function moveThemes(delta) {
    if (!el.themeTrack || !el.themePrev || !el.themeNext) return;
    const max = themeMaxIndex();
    state.themeIndex = Math.min(max, Math.max(0, state.themeIndex + delta));
    el.themeTrack.style.transform = `translateX(${-state.themeIndex * themeStep()}px)`;
    el.themePrev.disabled = state.themeIndex === 0;
    el.themeNext.disabled = state.themeIndex >= max;
  }

  /* 마커 툴팁 */
  function showTip(marker) {
    const dest = byId(marker.dataset.dest);
    const info = dest.fares[state.transport];
    const rect = el.markers.getBoundingClientRect();
    const x = parseFloat(marker.style.left) / 100 * rect.width;
    const y = parseFloat(marker.style.top) / 100 * rect.height;

    el.mapTip.innerHTML = `${dest.name}<small>${dest.region} · ${info ? info.time : '이용 불가'}</small>`;
    el.mapTip.style.left = `${x}px`;
    el.mapTip.style.top  = `${y - marker.offsetHeight / 2 - 10}px`;
    el.mapTip.hidden = false;
  }

  /* ============================================================
     이벤트 바인딩
     ============================================================ */
  function bindEvents() {
    /* GNB */
    $$('.gnb__item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        $$('.gnb__item').forEach((i) => {
          i.classList.remove('is-active');
          i.removeAttribute('aria-current');
        });
        item.classList.add('is-active');
        item.setAttribute('aria-current', 'page');
      });
    });

    /* 교통수단 */
    if (el.transportList) {
      el.transportList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-transport]');
        if (btn) selectTransport(btn.dataset.transport);
      });
    }

    /* 교통 정보 행 클릭 → 해당 수단 선택 */
    if (el.fareList) {
      el.fareList.addEventListener('click', (e) => {
        const row = e.target.closest('[data-transport]');
        if (row) selectTransport(row.dataset.transport);
      });
    }

    /* 인기 지역 · 인기 여행지 그리드 · 테마 카드 · 지도 마커 */
    [el.popularList, el.spotGrid, el.themeTrack, el.markers].filter(Boolean).forEach((root) => {
      root.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-dest]');
        if (btn) selectDestination(btn.dataset.dest);
      });
    });

    /* 마커 호버 툴팁 */
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

    /* 찜하기 */
    el.btnLike.addEventListener('click', () => {
      const id = state.destId;
      const nowLiked = !state.liked.has(id);
      nowLiked ? state.liked.add(id) : state.liked.delete(id);
      localStorage.setItem('wtg:liked', JSON.stringify([...state.liked]));

      el.btnLike.classList.remove('is-beat');
      void el.btnLike.offsetWidth;          /* 애니메이션 리셋 */
      el.btnLike.classList.add('is-beat');

      renderToday();
      renderSavedCount();
      showToast(nowLiked ? '💗 찜 목록에 담았어요' : '찜을 해제했어요');
    });

    /* 떠나기 CTA */
    el.btnGo.addEventListener('click', () => {
      const d = byId(state.destId);
      const t = TRANSPORTS.find((x) => x.key === state.transport);
      showToast(`${t.emoji} ${state.origin} → ${d.name} · ${t.label} 경로를 준비할게요!`);
    });

    /* 찜 목록 버튼 */
    el.btnSaved.addEventListener('click', () => {
      const n = state.liked.size;
      showToast(n ? `🔖 찜한 여행지 ${n}곳` : '아직 찜한 여행지가 없어요');
    });

    /* 출발지 드롭다운 */
    el.originSelect.addEventListener('click', () => {
      const open = el.originSelect.getAttribute('aria-expanded') === 'true';
      el.originSelect.setAttribute('aria-expanded', String(!open));
      el.originList.hidden = open;
    });

    el.originList.addEventListener('click', (e) => {
      const li = e.target.closest('[data-origin]');
      if (!li) return;
      state.origin = li.dataset.origin;
      el.originLabel.textContent = state.origin;
      renderOrigins();
      el.originSelect.setAttribute('aria-expanded', 'false');
      el.originList.hidden = true;
      showToast(`출발지를 ${state.origin}로 변경했어요`);
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.origin')) {
        el.originSelect.setAttribute('aria-expanded', 'false');
        el.originList.hidden = true;
      }
    });

    /* 내 위치 사용 */
    el.btnGeo.addEventListener('click', () => {
      state.useGeo = !state.useGeo;
      el.btnGeo.classList.toggle('is-off', !state.useGeo);
      el.geoLabel.textContent = state.useGeo ? '내 위치 사용 중' : '내 위치 사용 안 함';
    });

    /* 캐러셀 */
    if (el.themePrev) el.themePrev.addEventListener('click', () => moveThemes(-1));
    if (el.themeNext) el.themeNext.addEventListener('click', () => moveThemes(1));

    /* 리사이즈 대응 */
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => moveThemes(0), 120);
    });

    /* ESC — 열린 것 닫기 */
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      el.originSelect.setAttribute('aria-expanded', 'false');
      el.originList.hidden = true;
      el.mapTip.hidden = true;
    });
  }

  /* ============================================================
     시작
     ============================================================ */
  function init() {
    renderPopular();
    renderSpotGrid();
    renderThemes();
    renderOrigins();
    el.originLabel.textContent = state.origin;

    selectDestination(state.destId, { toast: false });
    renderSavedCount();
    moveThemes(0);
    bindEvents();
    initMap({ selectDestination, showToast, drawEl: el.draw, drawBtnEl: el.btnDraw });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
