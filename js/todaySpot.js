/**
 * 오늘의 여행지 (todaySpot.js)
 * -----------------------------------------------------------------
 * 우측 패널 "오늘의 여행지" 카드 — TourAPI 여행지 중 랜덤 5개를 뽑아
 * "< 1/5 >" 페이저로 넘겨보는 위젯. main.js/map.js의 "랜덤 뽑기"(주사위)
 * 와는 완전히 독립된 별도 기능이다.
 *
 * - 랜덤 5개는 하루(한국시간 자정 기준) 한 번만 새로 뽑아 localStorage에 캐시.
 * - 찜 아이콘은 헤더 북마크 아이콘(#i-bookmark)과 통일했고, 채워짐 여부는
 *   detail.js/bookmark.js와 공유하는 북마크 목록(localStorage 'travelBookmarks_v1')에
 *   이 여행지 id가 들어있는지로 판단한다 (실제 북마크 여부와 항상 일치시키기 위함).
 * - 길찾기는 여행지 주소를 네이버 지도 검색 딥링크로 새 탭에 연다.
 *   (예상 소요시간/거리는 넣지 않음 — Direction5는 서버 전용 API라 정적
 *    사이트에서 CORS로 막혀 못 붙임, 길찾기 버튼으로 대신함)
 */
(function () {
  'use strict';

  const CACHE_KEY = 'wtg:todaySpot:v1';
  const BOOKMARK_KEY = 'travelBookmarks_v1'; // detail.js/bookmark.js와 공유하는 북마크 목록
  const FALLBACK_IMG = 'images/th-hallasan.png';
  const POOL_PAGES = 30; // 여행지 목록 중 임의의 페이지를 뽑아 그 날의 5개를 정함
  const SPOT_COUNT = 5;

  const el = {
    img:        document.getElementById('todayImg'),
    like:       document.getElementById('btnLike'),
    region:     document.getElementById('todayRegion'),
    name:       document.getElementById('todayName'),
    descTitle:  document.getElementById('todayTitle'),
    descAddr:   document.getElementById('todayAddr'),
    go:         document.getElementById('btnGo'),
    detail:     document.getElementById('linkDetail'),
    pagerPrev:  document.getElementById('todaySpotPrev'),
    pagerNext:  document.getElementById('todaySpotNext'),
    pagerLabel: document.getElementById('todaySpotPagerLabel'),
  };
  if (!el.img) return; // 이 위젯이 없는 페이지에서는 조용히 종료

  const state = { items: [], index: 0 };

  function readJSON(key, fallback) {
    try {
      const raw = JSON.parse(localStorage.getItem(key));
      return raw ?? fallback;
    } catch { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 실패(용량 초과 등) 무시 */ }
  }

  const todayYmd = () =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replaceAll('-', '');

  function getCachedItems() {
    const cached = readJSON(CACHE_KEY, null);
    return cached && cached.ymd === todayYmd() && cached.items?.length ? cached.items : null;
  }
  function setCachedItems(items) {
    writeJSON(CACHE_KEY, { ymd: todayYmd(), items });
  }

  /* arrange:'Q' — 대표이미지가 반드시 있는 정렬. contentTypeId는 비워서
     관광지·문화시설·음식점 등 전체에서 뽑히게 함(spotGrid와 동일한 방식) */
  function fetchTodaySpots() {
    const pageNo = 1 + Math.floor(Math.random() * POOL_PAGES);
    return TourAPI.getTravelList({ numOfRows: SPOT_COUNT, pageNo, arrange: 'Q', contentTypeId: null });
  }

  /* addr1 앞 두 토큰 = 광역자치단체 / 기초자치단체 (예: "강원특별자치도" "평창군") */
  function addrTokens(item) {
    return (item.addr1 || '').split(' ');
  }
  function sidoOf(item) {
    return addrTokens(item)[0] || '주소 정보 없음';
  }
  function sigunguOf(item) {
    return addrTokens(item)[1] || '';
  }
  function addressOf(item) {
    return [item.addr1, item.addr2].filter(Boolean).join(' ').trim() || '주소 정보 없음';
  }

  function isBookmarked(id) {
    return readJSON(BOOKMARK_KEY, []).some((b) => String(b.id) === String(id));
  }

  function renderPager() {
    if (!el.pagerLabel) return;
    const total = state.items.length;
    el.pagerLabel.textContent = `${total ? state.index + 1 : 0}/${total}`;
    if (el.pagerPrev) el.pagerPrev.disabled = state.index <= 0;
    if (el.pagerNext) el.pagerNext.disabled = state.index >= total - 1;
  }

  function renderSpot() {
    const item = state.items[state.index];
    if (!item) return;

    el.img.src = item.firstimage || item.firstimage2 || FALLBACK_IMG;
    el.img.alt = item.title;
    el.region.textContent = sidoOf(item);
    el.name.textContent = sigunguOf(item);
    el.descTitle.textContent = item.title;
    el.descAddr.textContent = addressOf(item);

    const liked = isBookmarked(item.contentid);
    el.like.setAttribute('aria-pressed', String(liked));
    el.like.setAttribute('aria-label', liked ? '찜 해제' : '찜하기');

    el.detail.href = `detail.html?id=${item.contentid}&type=${item.contenttypeid}`;

    renderPager();
  }

  function move(delta) {
    const next = state.index + delta;
    if (next < 0 || next >= state.items.length) return;
    state.index = next;
    renderSpot();
  }

  function toggleBookmark(id, image, link, name) {
    const list = readJSON(BOOKMARK_KEY, []);
    const idx = list.findIndex((b) => String(b.id) === String(id));
    if (idx > -1) list.splice(idx, 1);
    else list.unshift({ id, image, link, name });
    writeJSON(BOOKMARK_KEY, list);
  }

  function toggleLike() {
    const item = state.items[state.index];
    if (!item) return;

    const image = item.firstimage || item.firstimage2 || FALLBACK_IMG;
    const link = `detail.html?id=${item.contentid}&type=${item.contenttypeid}`;
    toggleBookmark(item.contentid, image, link, item.title);

    el.like.classList.remove('is-beat');
    void el.like.offsetWidth; // 애니메이션 리셋
    el.like.classList.add('is-beat');
    renderSpot();
  }

  /* 길찾기 — 주소를 네이버 지도 검색 딥링크로 넘겨 새 탭에서 연다 */
  function openDirections() {
    const item = state.items[state.index];
    if (!item) return;
    const url = `https://map.naver.com/p/search/${encodeURIComponent(addressOf(item))}`;
    window.open(url, '_blank', 'noopener');
  }

  function bindEvents() {
    el.like.addEventListener('click', toggleLike);
    el.go.addEventListener('click', openDirections);
    if (el.pagerPrev) el.pagerPrev.addEventListener('click', () => move(-1));
    if (el.pagerNext) el.pagerNext.addEventListener('click', () => move(1));
  }

  async function init() {
    bindEvents();

    const cached = getCachedItems();
    if (cached) {
      state.items = cached;
      renderSpot();
      return;
    }

    try {
      const items = await fetchTodaySpots();
      if (!items.length) return;
      state.items = items;
      setCachedItems(items);
      renderSpot();
    } catch (err) {
      console.error('오늘의 여행지 로드 실패:', err);
    }
  }

  init();
})();
