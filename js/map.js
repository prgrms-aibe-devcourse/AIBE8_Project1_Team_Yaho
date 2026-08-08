/* ============================================================
   map.js — 지도(시/도 확대 · 핀 · 뽑기) 전용 모듈
   ------------------------------------------------------------
   main.js에서 initMap()으로 초기화. 여행지 카드 갱신/토스트는
   직접 하지 않고 main.js가 넘겨준 콜백(selectDestination, showToast)을
   통해서만 상호작용한다.
   ============================================================ */
import { DESTINATIONS, REGIONS } from './data.js';

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const byId = (id) => DESTINATIONS.find((d) => d.id === id);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function initMap({ selectDestination, showToast, drawEl, drawBtnEl }) {
  const el = {
    map:     $('.map'),
    mapBg:   $('#mapBg'),
    mapBack: $('#mapBack'),
    markers: $('#markers'),
  };

  const state = { rolling: false, zoomedRegion: null };
  let mapScale = 1;

  /* --- 지도 SVG 인라인 로드 (지역별 id/path 접근용) --- */
  async function loadMapSvg() {
    if (!el.mapBg) return;
    try {
      const res = await fetch('images/map-korea.svg');
      el.mapBg.innerHTML = await res.text();
      const svg = el.mapBg.querySelector('svg');
      if (svg) svg.classList.add('map__img');
    } catch (err) {
      console.error('지도 SVG 로드 실패:', err);
    }
  }

  /* --- 지도 지역(시/도) 확대 + 핀 표시 --- */
  function zoomToRegion(regionId) {
    const region = document.getElementById(regionId);
    const info = REGIONS.find((r) => r.id === regionId);
    if (!region || !info || !el.map || !el.mapBg) return;

    /* 기준 좌표 측정을 위해 우선 원상태로 리셋 */
    el.mapBg.style.transform = 'none';
    const mapRect = el.map.getBoundingClientRect();
    const regionRect = region.getBoundingClientRect();
    const cx = regionRect.left + regionRect.width / 2 - mapRect.left;
    const cy = regionRect.top + regionRect.height / 2 - mapRect.top;

    const scale = Math.min(16, Math.max(1.8, Math.min(
      (mapRect.width * 0.6) / regionRect.width,
      (mapRect.height * 0.6) / regionRect.height
    )));

    const scaledW = mapRect.width * scale;
    const scaledH = mapRect.height * scale;
    /* 확대된 지도 바깥 빈 공간이 보이지 않도록 이동 범위를 지도 경계 안쪽으로 고정 */
    const tx = Math.min(0, Math.max(mapRect.width - scaledW, mapRect.width / 2 - cx * scale));
    const ty = Math.min(0, Math.max(mapRect.height - scaledH, mapRect.height / 2 - cy * scale));

    el.mapBg.style.transformOrigin = '0 0';
    el.mapBg.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;

    /* 핀 위치 = 확대된 좌표계 기준 영역 실제 중심 (경계 클램프 시 중앙에서 벗어날 수 있어 재계산) */
    const pinX = ((cx * scale + tx) / mapRect.width) * 100;
    const pinY = ((cy * scale + ty) / mapRect.height) * 100;

    const dest = info.destId ? byId(info.destId) : null;
    el.markers.style.transform = '';
    el.markers.innerHTML = `
      <button class="marker" type="button" ${dest ? `data-dest="${dest.id}"` : ''}
              style="left:${pinX}%; top:${pinY}%" aria-label="${info.label}">
        ${dest && (dest.marker || dest.photo) ? `<img class="marker__img" src="${dest.marker || dest.photo}" alt="" />` : ''}
      </button>`;

    el.map.classList.add('is-zoomed');
    if (el.mapBack) el.mapBack.hidden = false;
    state.zoomedRegion = regionId;
    if (dest) selectDestination(dest.id, { toast: false });
  }

  /* --- 전체 지도로 복귀 --- */
  function resetMapView() {
    if (!el.mapBg) return;
    el.mapBg.style.transform = '';
    el.markers.style.transform = '';
    el.markers.innerHTML = '';
    el.map.classList.remove('is-zoomed');
    state.zoomedRegion = null;
    mapScale = 1;
    if (el.mapBack) el.mapBack.hidden = true;
  }

  /* --- 랜덤 뽑기 (시/도 영역 기준) --- */
  async function runDraw() {
    if (state.rolling) return;
    const regionEls = $$('.region', el.mapBg);
    if (!regionEls.length) return;

    state.rolling = true;
    drawEl.classList.add('is-rolling');
    drawBtnEl.disabled = true;
    resetMapView();

    let index = Math.floor(Math.random() * regionEls.length);

    if (!reduceMotion) {
      let delay = 70;
      while (delay < 250) {
        regionEls.forEach((r) => r.classList.remove('is-rolling'));
        index = (index + 1 + Math.floor(Math.random() * 2)) % regionEls.length;
        regionEls[index].classList.add('is-rolling');
        await sleep(delay);
        delay *= 1.17;
      }
      regionEls.forEach((r) => r.classList.remove('is-rolling'));
      regionEls[index].classList.add('is-won');
      setTimeout(() => regionEls[index].classList.remove('is-won'), 750);
    }

    const landedId = regionEls[index].id;
    const info = REGIONS.find((r) => r.id === landedId);
    const dest = info && info.destId ? byId(info.destId) : null;

    zoomToRegion(landedId);
    showToast(`🎉 오늘의 여행지는 「${dest ? dest.name : info.label}」!`);

    drawEl.classList.remove('is-rolling');
    drawBtnEl.disabled = false;
    state.rolling = false;
  }

  function bindMapEvents() {
    /* 지도 지역 클릭 (이벤트 위임 — svg 비동기 로드와 무관하게 동작) */
    if (el.mapBg) {
      el.mapBg.addEventListener('click', (e) => {
        const region = e.target.closest('.region');
        if (region) zoomToRegion(region.id);
      });
    }

    /* 돌아가기 — 전체 지도 복귀 */
    if (el.mapBack) el.mapBack.addEventListener('click', resetMapView);

    /* 지도 휠 확대/축소 (마우스 커서 기준, 시/도 확대 중엔 비활성) */
    if (el.map) {
      const zoomTargets = [$('.map__bg', el.map), el.markers].filter(Boolean);
      el.map.addEventListener('wheel', (e) => {
        if (state.zoomedRegion) return;
        e.preventDefault();
        const rect = el.map.getBoundingClientRect();
        const originX = ((e.clientX - rect.left) / rect.width) * 100;
        const originY = ((e.clientY - rect.top) / rect.height) * 100;
        mapScale = Math.min(4, Math.max(1, mapScale - e.deltaY * 0.0015 * mapScale));
        zoomTargets.forEach((t) => {
          t.style.transformOrigin = `${originX}% ${originY}%`;
          t.style.transform = `scale(${mapScale})`;
        });
      }, { passive: false });
    }

    if (drawBtnEl) drawBtnEl.addEventListener('click', runDraw);
  }

  loadMapSvg();
  bindMapEvents();
}
