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
    map:           $('.map'),
    mapBg:         $('#mapBg'),
    mapBack:       $('#mapBack'),
    markers:       $('#markers'),
    label:         $('#mapLabel'),
    labelSido:     $('#mapLabelSido'),
    labelSigungu:  $('#mapLabelSigungu'),
  };

  const state = { rolling: false, zoomedRegion: null, selectedId: null };
  let mapScale = 1;
  let overviewSvgHTML = null;
  let sigunguDocPromise = null;
  let bjdCodes = null;
  fetch('data/bjd-codes.json')
    .then((res) => res.json())
    .then((data) => { bjdCodes = data; })
    .catch((err) => console.error('법정동 코드 로드 실패:', err));

  /* --- 호버/선택된 영역 지명 표시 (우측하단) --- */
  function resolveName(id) {
    if (!bjdCodes) return null;
    if (id.length <= 2) return { sido: bjdCodes.sido[id] || '', sigungu: '' };
    return { sido: bjdCodes.sido[id.slice(0, 2)] || '', sigungu: bjdCodes.sigungu[id] || '' };
  }

  function showLabel(id) {
    const names = resolveName(id);
    if (!names || !el.label) return;
    el.labelSido.textContent = names.sigungu ? names.sido : '';
    el.labelSigungu.textContent = names.sigungu || names.sido;
    el.label.hidden = false;
  }

  function hideLabel(force) {
    if (!el.label || (state.selectedId && !force)) return;
    el.label.hidden = true;
  }

  /* --- 지도 SVG 인라인 로드 (지역별 id/path 접근용) --- */
  async function loadMapSvg() {
    if (!el.mapBg) return;
    try {
      const res = await fetch('images/map-korea.svg');
      el.mapBg.innerHTML = await res.text();
      const svg = el.mapBg.querySelector('svg');
      if (svg) svg.classList.add('map__img');
      overviewSvgHTML = el.mapBg.innerHTML;
    } catch (err) {
      console.error('지도 SVG 로드 실패:', err);
    }
  }

  /* --- 시군구 상세 svg는 클릭 시점에 한 번만 불러와 캐시 --- */
  function loadSigunguDoc() {
    if (!sigunguDocPromise) {
      sigunguDocPromise = fetch('images/map-korea-sigungu.svg')
        .then((res) => res.text())
        .then((text) => new DOMParser().parseFromString(text, 'image/svg+xml'));
    }
    return sigunguDocPromise;
  }

  /* --- 시/도 클릭 → 전체 지도를 확대하는 대신, 그 시/도에 속한 시군구만 모아서 표시 --- */
  async function zoomToRegion(regionId) {
    const info = REGIONS.find((r) => r.id === regionId);
    if (!info || !el.map || !el.mapBg) return;

    /* 시군구를 시/도 배경색과 맞추기 위해, 개요 지도가 없어지기 전에 그 색을 미리 읽어둠 */
    const sidoEl = document.getElementById(regionId);
    const sidoColor = sidoEl ? sidoEl.getAttribute('fill') : null;

    const doc = await loadSigunguDoc();
    const matched = Array.from(doc.querySelectorAll('g[id]'))
      .filter((g) => g.id.startsWith(regionId))
      .map((g) => g.cloneNode(true));
    if (!matched.length) return;

    /* 이전 상태(개요 지도 휠줌 등)의 transform 잔여값 제거 */
    el.mapBg.style.transform = '';
    el.mapBg.style.transformOrigin = '';
    mapScale = 1;
    state.selectedId = null;
    hideLabel(true);

    const svgEl = doc.documentElement.cloneNode(false);
    matched.forEach((g) => { g.classList.add('region'); svgEl.appendChild(g); });
    svgEl.classList.add('map__img', 'map__img--detail');
    svgEl.removeAttribute('width');
    svgEl.removeAttribute('height');
    if (sidoColor) svgEl.style.setProperty('--sido-color', sidoColor);

    el.mapBg.innerHTML = '';
    el.mapBg.appendChild(svgEl);

    /* 표시된 시군구들의 실제 좌표 범위로 viewBox를 맞춤 — 전체를 확대하는 게 아니라
       해당 시/도 영역만 그 좌표 그대로 잘라서 컨테이너에 꽉 채우는 방식.
       우측하단은 지명 라벨이 겹치지 않도록 여백을 더 크게 줌 */
    const bbox = svgEl.getBBox();
    const pad = Math.max(bbox.width, bbox.height) * 0.06;
    const labelPad = Math.max(bbox.width, bbox.height) * 0.22;
    svgEl.setAttribute('viewBox', `${bbox.x - pad} ${bbox.y - pad} ${bbox.width + pad + labelPad} ${bbox.height + pad + labelPad}`);

    const dest = info.destId ? byId(info.destId) : null;
    el.markers.style.transform = '';
    el.markers.innerHTML = `
      <button class="marker" type="button" ${dest ? `data-dest="${dest.id}"` : ''}
              style="left:50%; top:50%" aria-label="${info.label}">
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
    if (overviewSvgHTML) el.mapBg.innerHTML = overviewSvgHTML;
    el.mapBg.style.transform = '';
    el.mapBg.style.transformOrigin = '';
    el.markers.style.transform = '';
    el.markers.innerHTML = '';
    el.map.classList.remove('is-zoomed');
    state.zoomedRegion = null;
    state.selectedId = null;
    hideLabel(true);
    mapScale = 1;
    if (el.mapBack) el.mapBack.hidden = true;
  }

  /* --- 랜덤 뽑기 (시/도 영역 기준) --- */
  async function runDraw() {
    if (state.rolling) return;
    const regionEls = $$('.sido', el.mapBg);
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

    await zoomToRegion(landedId);
    showToast(`🎉 오늘의 여행지는 「${dest ? dest.name : info.label}」!`);

    drawEl.classList.remove('is-rolling');
    drawBtnEl.disabled = false;
    state.rolling = false;
  }

  function bindMapEvents() {
    /* 지도 지역 클릭 (이벤트 위임 — svg 비동기 로드와 무관하게 동작) */
    if (el.mapBg) {
      el.mapBg.addEventListener('click', (e) => {
        const sido = e.target.closest('.sido');
        if (sido) zoomToRegion(sido.id);
      });
    }

    /* 돌아가기 — 전체 지도 복귀 */
    if (el.mapBack) el.mapBack.addEventListener('click', resetMapView);

    /* 시/도·시군구 호버 시 지명 표시 (선택 고정 중엔 무시) */
    if (el.mapBg) {
      el.mapBg.addEventListener('mouseover', (e) => {
        if (state.selectedId) return;
        const target = e.target.closest('.sido, .region');
        if (target) showLabel(target.id);
      });
      el.mapBg.addEventListener('mouseout', (e) => {
        const stillInside = e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.sido, .region');
        if (!stillInside) hideLabel();
      });

      /* 시군구 클릭 — 지명 고정 + 배경 강조, 같은 곳 다시 클릭하면 해제 */
      el.mapBg.addEventListener('click', (e) => {
        const region = e.target.closest('.region');
        if (!region) return;
        if (state.selectedId === region.id) {
          region.classList.remove('is-selected');
          state.selectedId = null;
          showLabel(region.id);
        } else {
          $$('.region.is-selected', el.mapBg).forEach((r) => r.classList.remove('is-selected'));
          region.classList.add('is-selected');
          state.selectedId = region.id;
          showLabel(region.id);
        }
      });
    }

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
