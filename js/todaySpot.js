/**
 * 오늘의 여행지 (todaySpot.js)
 * -----------------------------------------------------------------
 * 우측 패널 "오늘의 여행지" 카드 — TourAPI 여행지 중 랜덤 5개를 뽑아
 * "< 1/5 >" 페이저로 넘겨보는 위젯. main.js/map.js의 "랜덤 뽑기"(주사위)
 * 와는 완전히 독립된 별도 기능이다.
 *
 * - 랜덤 5개는 하루(한국시간 자정 기준) 한 번만 새로 뽑아서, 다른 사람 브라우저와도
 *   같이 쓸 수 있도록 Supabase api_cache 테이블(js/apiCache.js)에 캐시한다.
 * - 찜 아이콘은 헤더 북마크 아이콘(#i-bookmark)과 통일했고, 채워짐 여부는
 *   detail.js/bookmark.js와 동일하게 Supabase의 bookmarks 테이블로 판단한다
 *   (실제 북마크 여부와 항상 일치시키기 위함 — 로그인 안 했으면 항상 미채움).
 * - 길찾기는 여행지 주소를 네이버 지도 검색 딥링크로 새 탭에 연다.
 *   (예상 소요시간/거리는 넣지 않음 — Direction5는 서버 전용 API라 정적
 *    사이트에서 CORS로 막혀 못 붙임, 길찾기 버튼으로 대신함)
 */
(function () {
  'use strict';

  const CACHE_KEY = 'todaySpot'; // 실제 캐시 키는 `${CACHE_KEY}:${todayYmd()}` — 날짜가 곧 캐시 무효화 기준
  const CACHE_TTL_MS = 26 * 60 * 60 * 1000; // 하루보단 넉넉하게 (키 자체가 날짜별이라 TTL은 안전망 정도)
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

  const state = { items: [], index: 0, bookmarkedIds: new Set() };

  const todayYmd = () =>
    new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date()).replaceAll('-', '');

  async function getCachedItems() {
    const items = await window.ApiCache.get(`${CACHE_KEY}:${todayYmd()}`, CACHE_TTL_MS);
    return items && items.length ? items : null;
  }
  async function setCachedItems(items) {
    await window.ApiCache.set(`${CACHE_KEY}:${todayYmd()}`, items);
  }

  // 헤더(topnav.js)의 토스트 마크업(#toast)을 그대로 재사용 — index.html에는 있음
  function showToast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show', 'is-on');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove('show', 'is-on'), 2200);
  }

  // 로그인한 사용자의 북마크 content_id 목록을 통째로 가져와 Set으로 보관
  // (여행지 5개마다 매번 쿼리하지 않고 한 번에 조회 — bookmark.js/detail.js와 같은 테이블)
  async function loadBookmarkedIds() {
    const user = window.getCurrentUser();
    if (!user) return new Set();
    const { data, error } = await window.supabaseClient
      .from('bookmarks')
      .select('content_id')
      .eq('user_id', user.id);
    if (error || !data) return new Set();
    return new Set(data.map((r) => String(r.content_id)));
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
    return state.bookmarkedIds.has(String(id));
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

  async function toggleBookmark(id, image, link, name) {
    const user = window.getCurrentUser();
    if (!user) return; // 클릭 핸들러에서 이미 로그인 체크하지만 안전망으로 한 번 더
    const strId = String(id);
    if (state.bookmarkedIds.has(strId)) {
      const { error } = await window.supabaseClient
        .from('bookmarks').delete().eq('user_id', user.id).eq('content_id', strId);
      if (!error) state.bookmarkedIds.delete(strId);
    } else {
      const { error } = await window.supabaseClient
        .from('bookmarks').insert({ user_id: user.id, content_id: strId, image, link, name });
      if (!error) state.bookmarkedIds.add(strId);
    }
  }

  async function toggleLike() {
    const item = state.items[state.index];
    if (!item) return;

    if (!window.isLoggedIn || !window.isLoggedIn()) {
      showToast('로그인이 필요합니다');
      return;
    }

    const image = item.firstimage || item.firstimage2 || FALLBACK_IMG;
    const link = `detail.html?id=${item.contentid}&type=${item.contenttypeid}`;
    await toggleBookmark(item.contentid, image, link, item.title);

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

    // authState.js가 세션 확인을 끝낼 때까지 기다린 뒤 북마크 여부를 조회
    if (typeof window.authReady === 'function') await window.authReady();
    state.bookmarkedIds = await loadBookmarkedIds();

    const cached = await getCachedItems();
    if (cached) {
      state.items = cached;
      renderSpot();
    } else {
      try {
        const items = await fetchTodaySpots();
        if (items.length) {
          state.items = items;
          await setCachedItems(items);
          renderSpot();
        }
      } catch (err) {
        console.error('오늘의 여행지 로드 실패:', err);
      }
    }

    // 로그인/로그아웃 시(다른 스크립트가 발생시키는 이벤트) 하트 채워짐 상태를 다시 맞춤
    window.addEventListener('wtg:auth-changed', async () => {
      state.bookmarkedIds = await loadBookmarkedIds();
      renderSpot();
    });
  }

  init();
})();
