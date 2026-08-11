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
    labelBtn:      $('#mapLabelBtn'),
    labelSido:     $('#mapLabelSido'),
    labelSigungu:  $('#mapLabelSigungu'),
    dropup:        $('#mapLabelDropup'),
    sigunguDraw:         $('#sigunguDraw'),
    sigunguDrawEyebrow:  $('#sigunguDrawEyebrow'),
    sigunguDrawQuestion: $('#sigunguDrawQuestion'),
    sigunguDrawText:     $('#sigunguDrawText'),
    sigunguDrawStart:    $('#sigunguDrawStart'),
    sigunguDrawConfirm:  $('#sigunguDrawConfirm'),
    sigunguDrawClose:    $('#sigunguDrawClose'),
    preview:       $('#regionPreview'),
    previewClose:  $('#regionPreviewClose'),
    previewTitle:  $('#regionPreviewTitle'),
    previewGrid:   $('#regionPreviewGrid'),
    previewMore:   $('#regionPreviewMore'),
  };

  const DEFAULT_LABEL_TEXT = '클릭하여 지역 선택';
  const state = { rolling: false, zoomedRegion: null, selectedId: null, sigunguIds: null };
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
  }

  /* 구가 여러 개인 시(수원시 장안구/권선구/…)는 지도·API 어디서 id가 들어와도
     "시" 하나로 묶어서 다룬다 — repId: 대표 id(부모 시 코드, 없으면 자기 자신),
     memberIds: 실제로 지도에 강조해야 하는 leaf id 목록(구가 없으면 자기 자신뿐) */
  function resolveRegionGroup(id) {
    if (!bjdCodes) return { repId: id, memberIds: [id] };
    const name = bjdCodes.sigungu[id] || id;
    const cityName = name.includes(' ') ? name.split(' ')[0] : name;
    const memberIds = Object.keys(bjdCodes.sigungu).filter((k) => bjdCodes.sigungu[k].startsWith(`${cityName} `));
    if (!memberIds.length) return { repId: id, memberIds: [id] };
    const repEntry = Object.entries(bjdCodes.sigungu).find(([, n]) => n === cityName);
    return { repId: repEntry ? repEntry[0] : id, memberIds };
  }

  /* 호버가 끝나면 지명 대신 기본 안내 텍스트로 복귀 (선택 고정 중엔 유지) */
  function hideLabel(force) {
    if (!el.label || (state.selectedId && !force)) return;
    el.labelSido.textContent = '';
    el.labelSigungu.textContent = DEFAULT_LABEL_TEXT;
  }

  /* --- 라벨 클릭 → 드롭업으로 시/도(전체 지도) 또는 시/군/구(확대 중) 목록 표시 --- */
  function closeDropup() {
    if (!el.dropup) return;
    el.dropup.classList.remove('is-open');
    if (el.labelBtn) el.labelBtn.setAttribute('aria-expanded', 'false');
  }

  function renderDropup() {
    if (!el.dropup) return;
    const items = state.zoomedRegion
      ? (state.sigunguIds || []).map((id) => ({ id, name: (bjdCodes && bjdCodes.sigungu[id]) || id, key: 'sigungu' }))
      : REGIONS.map((r) => ({ id: r.id, name: r.label, key: 'sido' }));
    items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    el.dropup.innerHTML = items
      .map((it) => `<li role="option"><button type="button" data-key="${it.key}" data-id="${it.id}">${it.name}</button></li>`)
      .join('');
  }

  function openDropup() {
    if (!el.dropup) return;
    renderDropup();
    el.dropup.classList.add('is-open');
    if (el.labelBtn) el.labelBtn.setAttribute('aria-expanded', 'true');
  }

  /* 선택 상태를 지도 위에 그리기 — ids 여러 개면 한꺼번에 하이라이트(구가 여러 개인 시 전체 선택용) */
  function paintSelectedRegions(ids) {
    $$('.region.is-selected', el.mapBg).forEach((r) => r.classList.remove('is-selected'));
    ids.forEach((id) => {
      const region = el.mapBg.querySelector(`[id="${id}"]`);
      if (region) region.classList.add('is-selected');
    });
  }

  /* 드롭업/지도 클릭/랜덤뽑기에서 공통으로 쓰는 선택 고정 처리 —
     구가 여러 개인 시는 resolveRegionGroup이 그 구들을 한꺼번에 묶어 하이라이트한다 */
  function selectRegionInDropup(id) {
    const group = resolveRegionGroup(id);
    paintSelectedRegions(group.memberIds);
    state.selectedId = group.repId;
    showLabel(group.repId);
  }

  const PREVIEW_FALLBACK_IMG = 'images/th-hallasan.png';
  /* TourAPI(ldongCode2/areaBasedList2)는 광주(29)·전남(46)을 실제로는 하나의 시도코드('12')로만
     조회 가능함 — 법정동 원래 코드로 요청하면 0건 반환 (실측 확인). 미리보기 조회 시에만 변환 */
  const MERGED_SIDO_BASE = { 29: '12', 46: '12' };

  function hideRegionPreview() {
    if (el.preview) el.preview.hidden = true;
  }

  /* 드롭다운/랜덤뽑기/지도 클릭으로 시/군/구가 확정됐을 때 공통으로 띄우는 미리보기 —
     지도 밖으로 이동하는 대신, 지도 컨테이너 안에서 그 지역 여행지 4개를 먼저 보여준다 */
  async function showRegionPreview(sidoId, sigunguId) {
    if (!el.preview) return;
    const sidoName = (bjdCodes && bjdCodes.sido[sidoId]) || '';
    const sigunguName = (bjdCodes && bjdCodes.sigungu[sigunguId]) || '';
    const fullName = sigunguName ? `${sidoName} ${sigunguName}` : sidoName;

    // 구가 여러 개인 시는 TourAPI에 "시" 자체 코드로 등록된 여행지가 없으므로
    // (모든 주소가 하위 구 코드로만 태깅됨) 그 구들 각각으로 나눠서 조회 후 합침
    const group = resolveRegionGroup(sigunguId);

    el.previewTitle.textContent = fullName;
    el.previewMore.textContent = `${sigunguName || sidoName} 살펴보기`;
    el.previewMore.onclick = () => {
      location.href = `postList.html?area=${sidoId}&sigungu=${group.memberIds.join(',')}`;
    };
    el.previewGrid.innerHTML = '<li class="region-preview__empty">불러오는 중…</li>';
    el.preview.hidden = false;

    let items = [];
    try {
      // TourAPI 시군구 코드는 5자리 법정동코드가 아니라 시도코드를 뺀 3자리 코드로만 조회됨
      const baseSidoId = MERGED_SIDO_BASE[sidoId] || sidoId;
      const lists = await Promise.all(group.memberIds.map((id) => {
        const suffix = id && id.length > 2 ? id.slice(2) : id;
        return TourAPI.getTravelListByArea(baseSidoId, 4, suffix).catch(() => []);
      }));
      const seen = new Set();
      items = lists.flat().filter((it) => {
        if (seen.has(it.contentid)) return false;
        seen.add(it.contentid);
        return true;
      });
    } catch (err) {
      console.error('지역 미리보기 여행지 조회 실패:', err);
    }

    if (!items.length) {
      el.previewGrid.innerHTML = '<li class="region-preview__empty">등록된 여행지가 없어요</li>';
      return;
    }

    el.previewGrid.innerHTML = items.slice(0, 4).map((it) => {
      const img = it.firstimage || it.firstimage2 || PREVIEW_FALLBACK_IMG;
      const name = it.title || '이름 없음';
      return `
        <li class="region-preview__card" data-id="${it.contentid}" data-type="${it.contenttypeid || TourAPI.CONTENT_TYPE.TRAVEL}">
          <img class="region-preview__card-img" src="${img}" alt="" loading="lazy" onerror="this.src='${PREVIEW_FALLBACK_IMG}'" />
          <span class="region-preview__card-name">${name}</span>
        </li>`;
    }).join('');
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
    /* 구가 여러 개인 시는 그 구들을 하나로 묶어 대표 id 하나만 남김
       (드롭업 목록·랜덤뽑기 모두 "시" 단위로 한 번씩만 나오게) */
    state.sigunguIds = [...new Set(matched.map((g) => resolveRegionGroup(g.id).repId))];
    hideLabel(true);
    closeDropup();
    hideRegionPreview();

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
    // 핀(마커) 표시 보류 — 랜덤 뽑기에도 미적용, 폐기 보류 상태라 전부 주석 처리
    // el.markers.style.transform = '';
    // el.markers.innerHTML = `
    //   <button class="marker" type="button" ${dest ? `data-dest="${dest.id}"` : ''}
    //           style="left:50%; top:50%" aria-label="${info.label}">
    //     ${dest && (dest.marker || dest.photo) ? `<img class="marker__img" src="${dest.marker || dest.photo}" alt="" />` : ''}
    //   </button>`;

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
    // el.markers.style.transform = '';
    // el.markers.innerHTML = '';
    el.map.classList.remove('is-zoomed');
    state.zoomedRegion = null;
    state.selectedId = null;
    state.sigunguIds = null;
    hideLabel(true);
    closeDropup();
    hideRegionPreview();
    mapScale = 1;
    if (el.mapBack) el.mapBack.hidden = true;
    if (el.sigunguDraw) el.sigunguDraw.hidden = true;
  }

  /* --- 시/군/구 랜덤 뽑기 모달 ---
     zoomToRegion()이 채워둔 state.sigunguIds 중 하나를 미리 뽑아두고,
     3초 동안 텍스트를 빠르게 랜덤 교체하는 스피너를 보여주다가 최종 시/군/구에서
     멈추고 "여행지 확인하기" 버튼을 띄운다. 모달은 버튼을 눌러야 닫힌다.
     ask:true면 스피너 전에 "시/군/구도 뽑아볼까요?" 질문 + "한 번 더 뽑기" 버튼을
     먼저 보여주고, 그 버튼을 눌러야 스피너가 시작된다 (전체 지도에서 시/도를 막
     새로 뽑은 직후에만 사용 — 이미 확대된 상태에서 다시 뽑을 땐 안 씀). */
  async function runSigunguDraw({ ask = false } = {}) {
    const ids = state.sigunguIds;
    if (!ids || !ids.length || !el.sigunguDraw) return;

    /* 우측 상단 x — 어느 단계에서 눌러도 그 자리에서 중단하고 모달만 닫음
       (지도 확대 상태는 그대로 유지, 시/군/구 뽑기만 취소) */
    let cancelled = false;
    let resolveAsk = () => {};
    if (el.sigunguDrawClose) {
      el.sigunguDrawClose.onclick = () => {
        cancelled = true;
        el.sigunguDraw.hidden = true;
        resolveAsk();
      };
    }

    if (ask) {
      const info = REGIONS.find((r) => r.id === state.zoomedRegion);
      el.sigunguDrawEyebrow.textContent = `✦ ${info ? info.label : '지역'} 도착!`;
      el.sigunguDrawQuestion.hidden = false;
      el.sigunguDrawText.hidden = true;
      el.sigunguDrawConfirm.hidden = true;
      el.sigunguDrawStart.hidden = false;
      el.sigunguDraw.hidden = false;
      await new Promise((resolve) => {
        resolveAsk = resolve;
        el.sigunguDrawStart.onclick = resolve;
      });
      if (cancelled) return;
    }

    const finalId = ids[Math.floor(Math.random() * ids.length)];
    const nameOf = (id) => (bjdCodes && bjdCodes.sigungu[id]) || id;

    el.sigunguDrawEyebrow.textContent = '✦ 시/군/구 뽑는 중';
    el.sigunguDrawQuestion.hidden = true;
    el.sigunguDrawText.hidden = false;
    el.sigunguDrawStart.hidden = true;
    el.sigunguDrawConfirm.hidden = true;
    el.sigunguDrawConfirm.onclick = null;
    el.sigunguDrawText.innerHTML = `<span>${nameOf(finalId)}</span>`;
    el.sigunguDraw.hidden = false;

    if (!reduceMotion) {
      const TICK_MS = 120;
      const STEPS = Math.round(3000 / TICK_MS);
      for (let step = 0; step < STEPS; step++) {
        if (cancelled) return;
        const id = step === STEPS - 1 ? finalId : ids[Math.floor(Math.random() * ids.length)];
        el.sigunguDrawText.innerHTML = `<span>${nameOf(id)}</span>`;
        await sleep(TICK_MS);
      }
    }
    if (cancelled) return;

    el.sigunguDrawConfirm.hidden = false;
    el.sigunguDrawConfirm.onclick = () => {
      el.sigunguDraw.hidden = true;
      selectRegionInDropup(finalId);
      showRegionPreview(state.zoomedRegion, finalId);
    };
  }

  /* --- 랜덤 뽑기 (시/도 영역 기준) ---
     클릭 즉시 시작/최종 시/도를 미리 뽑아두고, 2초 동안 0.2초 간격으로
     "밝아짐 + 외곽선 발광" 강조를 완전 랜덤한 시/도에 옮겨가며 보여주다가
     마지막에 미리 정해둔 최종 시/도에서 멈추고 그 시/군/구 영역으로 확대한다. */
  async function runDraw() {
    if (state.rolling) return;

    /* 이미 시/군/구까지 확대된 상태면 시/도를 새로 뽑지 않고
       지금 지역의 시/군/구 뽑기 모달을 바로 스피너부터 진행한다 */
    if (state.zoomedRegion) {
      state.rolling = true;
      drawBtnEl.disabled = true;
      await runSigunguDraw();
      drawBtnEl.disabled = false;
      state.rolling = false;
      return;
    }

    /* regionEls는 반드시 resetMapView() 이후에 조회해야 함 —
       resetMapView()가 mapBg.innerHTML을 통째로 교체해서 그 전에 잡아둔
       엘리먼트 참조는 DOM에서 떨어져 나가 강조 클래스를 줘도 화면에 안 보임 */
    resetMapView();
    const regionEls = $$('.sido', el.mapBg);
    if (!regionEls.length) return;

    state.rolling = true;
    drawEl.classList.add('is-rolling');
    drawBtnEl.disabled = true;

    const startIndex = Math.floor(Math.random() * regionEls.length);
    const finalIndex = Math.floor(Math.random() * regionEls.length);

    if (!reduceMotion) {
      const TICK_MS = 300;
      const STEPS = 3000 / TICK_MS;
      let current = null;
      for (let step = 0; step < STEPS; step++) {
        if (current) current.classList.remove('is-rolling');
        const idx = step === 0 ? startIndex
          : step === STEPS - 1 ? finalIndex
          : Math.floor(Math.random() * regionEls.length);
        current = regionEls[idx];
        current.classList.add('is-rolling');
        await sleep(TICK_MS);
      }
      current.classList.remove('is-rolling');
      regionEls[finalIndex].classList.add('is-won');
      setTimeout(() => regionEls[finalIndex].classList.remove('is-won'), 750);
    }

    const landedId = regionEls[finalIndex].id;
    const info = REGIONS.find((r) => r.id === landedId);
    const dest = info && info.destId ? byId(info.destId) : null;

    await zoomToRegion(landedId);
    showToast(`🎉 오늘의 여행지는 「${dest ? dest.name : info.label}」!`);
    await runSigunguDraw({ ask: true });

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

      /* 시군구 클릭 — 지명 고정 + 배경 강조, 같은 시/군/구를 다시 클릭하면 해제.
         새로 선택한 경우엔 강조만 하지 않고 그 지역 여행지 목록 페이지로 이동시킨다. */
      el.mapBg.addEventListener('click', (e) => {
        const region = e.target.closest('.region');
        if (!region) return;
        const group = resolveRegionGroup(region.id);
        if (state.selectedId === group.repId) {
          paintSelectedRegions([]);
          state.selectedId = null;
          showLabel(region.id);
        } else {
          selectRegionInDropup(region.id);
          showRegionPreview(group.repId.slice(0, 2), group.repId);
        }
      });
    }

    /* 라벨 클릭 → 드롭업 열고 닫기 (전체 지도: 시/도 목록, 확대 중: 시/군/구 목록) */
    if (el.labelBtn) {
      el.labelBtn.addEventListener('click', () => {
        if (el.dropup.classList.contains('is-open')) closeDropup();
        else openDropup();
      });
    }
    if (el.dropup) {
      el.dropup.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-id]');
        if (!btn) return;
        if (btn.dataset.key === 'sido') {
          zoomToRegion(btn.dataset.id);
        } else {
          const group = resolveRegionGroup(btn.dataset.id);
          selectRegionInDropup(btn.dataset.id);
          showRegionPreview(group.repId.slice(0, 2), group.repId);
        }
        closeDropup();
      });
    }
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#mapLabel')) closeDropup();
    });

    /* 지도 휠 확대/축소 (마우스 커서 기준, 시/도 확대 중엔 비활성) */
    if (el.map) {
      const zoomTargets = [$('.map__bg', el.map), el.markers].filter(Boolean);
      el.map.addEventListener('wheel', (e) => {
        if (state.zoomedRegion || e.target.closest('#mapLabel')) return;
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

    /* 지역 미리보기 패널 — 닫기 버튼 / 카드 클릭 시 해당 여행지 상세로 이동 */
    if (el.previewClose) el.previewClose.addEventListener('click', hideRegionPreview);
    if (el.previewGrid) {
      el.previewGrid.addEventListener('click', (e) => {
        const card = e.target.closest('.region-preview__card');
        if (!card) return;
        location.href = `detail.html?id=${card.dataset.id}&type=${card.dataset.type}`;
      });
    }
  }

  /* 인기 지역 리스트 클릭 → 해당 시/군/구로 확대 + 선택 고정 (main.js에서 호출).
     구가 여러 개인 시를 하나로 묶는 처리는 selectRegionInDropup 안 resolveRegionGroup이
     공통으로 담당 — 지도 클릭이든 API에서 받은 코드든 동일하게 동작한다 */
  async function selectSigunguCode(sigunguId) {
    const sidoId = sigunguId.slice(0, 2);
    if (state.zoomedRegion !== sidoId) await zoomToRegion(sidoId);
    selectRegionInDropup(sigunguId);
  }

  loadMapSvg();
  bindMapEvents();

  return { selectSigunguCode, showRegionPreview };
}
