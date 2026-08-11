// ── postList.js — 여행지 · 축제 목록 페이지 (TourAPI 연동) ────────────────────

(function () {
  // ── 상태 ──────────────────────────────────────────────────────────────
  let activeAreaCode    = 'all'; // '전체' 또는 lDongRegnCd (예: '11')
  let activeSigunguCode = 'all'; // '전체' 또는 lDongSignguCd (예: '11110')
  let sigunguPanelOpen  = false; // 시도 하위의 시군구 필터 행 노출 여부 (토글)
  let activeTab         = 'travel';

  let areas         = [{ code: 'all', name: '전체' }]; // TourAPI.getAreaCodes() 결과로 채워짐
  let travelPosts   = [];
  let festivalPosts = [];
  let loaded        = false;
  let loadError     = null;

  let sigunguCache        = {}; // { [시도코드]: [{code, name}, ...] } — 시도별 시군구 목록, 클릭 시에만 로드
  let sigunguListLoading  = false;

  let sigunguPostsCache   = {}; // { '시도_시군구': { travel: [...], festival: [...] } } — 시군구 클릭 시에만 로드
  let sigunguPostsLoading = false;

  let ITEMS_PER_AREA    = 20; // 지역(시도)당 최소 보장 개수
  let ITEMS_PER_SIGUNGU = 20; // 시군구당 최대 개수 (부족하면 있는 만큼만)

  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&h=600&fit=crop&auto=format';

  // ── TourAPI가 하나의 시도로 통합해서 내려주는 지역을 화면에서는 분리해서 표시 ──
  // (예: '전남광주통합특별시' → '광주광역시' + '전라남도')
  // matchSuffix로 시군구 이름을 나눔 — null인 항목은 나머지 전부를 받는 catch-all
  const AREA_SPLITS = {
    '12': [
      { code: '12-gj', name: '광주광역시', matchSuffix: '구' },
      { code: '12-jn', name: '전라남도',   matchSuffix: null },
    ],
  };

  let splitCodeToBase   = {}; // { '12-gj': '12', '12-jn': '12' } — 분리 pill 코드 → 실제 API 시도코드
  let mergedSignguSplit  = {}; // { [실제시도코드]: { [시군구코드]: 분리pill코드 } }

  function pickSplitBySuffix(splits, name) {
    let matched = splits.find(function (sp) { return sp.matchSuffix && name.endsWith(sp.matchSuffix); });
    return matched || splits[splits.length - 1];
  }

  // ── 통합 시도 항목을 실제 API 요청용 시도코드로 되돌림 ───────────────
  function resolveBaseAreaCode(pillCode) {
    return splitCodeToBase[pillCode] || pillCode;
  }

  // ── 여행지/축제 아이템의 실제 필터링 기준 지역코드 계산 ──────────────
  // 통합 시도에 속한 아이템이면 시군구코드로 광주/전남 분리 코드를 반환, 아니면 원래 시도코드 그대로
  function resolveAreaCode(item) {
    let raw = item.lDongRegnCd || '';
    let map = mergedSignguSplit[raw];
    if (map && map[item.lDongSignguCd]) return map[item.lDongSignguCd];
    return raw;
  }

  // URL 파라미터로 초기 탭 설정
  let params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'festival') activeTab = 'festival';

  // ── TourAPI 원본 → 카드용 데이터로 변환 ─────────────────────────────
  function mapTravelItem(item) {
    return {
      id: item.contentid,
      type: 'travel',
      contentTypeId: TourAPI.CONTENT_TYPE.TRAVEL,
      title: item.title || '',
      addr: [item.addr1, item.addr2].filter(Boolean).join(' ').trim(),
      areaCode: resolveAreaCode(item), // 지역 필터링 기준 (통합 시도는 광주/전남 분리 코드로)
      mainImage: item.firstimage || item.firstimage2 || FALLBACK_IMAGE,
      thumbImage: item.firstimage2 || item.firstimage || FALLBACK_IMAGE,
    };
  }

  function mapFestivalItem(item) {
    return {
      id: item.contentid,
      type: 'festival',
      contentTypeId: TourAPI.CONTENT_TYPE.FESTIVAL,
      title: item.title || '',
      addr: [item.addr1, item.addr2].filter(Boolean).join(' ').trim(),
      areaCode: resolveAreaCode(item),
      mainImage: item.firstimage || item.firstimage2 || FALLBACK_IMAGE,
      thumbImage: item.firstimage2 || item.firstimage || FALLBACK_IMAGE,
      eventStartDate: item.eventstartdate || '',
      eventEndDate: item.eventenddate || '',
    };
  }

  // ── 같은 contentid가 여러 지역 호출에서 중복으로 잡힐 수 있어 제거 ──
  function dedupeById(list) {
    let seen = {};
    return list.filter(function (item) {
      if (seen[item.contentid]) return false;
      seen[item.contentid] = true;
      return true;
    });
  }

  function formatDateRange(start, end) {
    let fmt = function (d) {
      if (!d || d.length !== 8) return d || '';
      return d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6, 8);
    };
    if (!start) return '-';
    if (!end || end === start) return fmt(start);
    return fmt(start) + ' – ' + fmt(end).slice(5); // "2025.10.01 – 10.12" 형태
  }

  // ── 데이터 로드 ───────────────────────────────────────────────────────
  async function loadData() {
    let container = document.getElementById('posts-container');
    container.innerHTML =
      '<div style="text-align:center; padding:80px 0; color:#9ca3af;">' +
        '<div style="font-size:32px; margin-bottom:12px;">⏳</div>' +
        '<p>여행 정보를 불러오는 중...</p>' +
      '</div>';

    try {
      let areaCodes = await TourAPI.getAreaCodes(); // 공식 시도 목록 (일부는 통합 시도로 내려옴)
      let expandedAreas = [];

      for (let i = 0; i < areaCodes.length; i++) {
        let a = areaCodes[i];
        let splits = AREA_SPLITS[a.code];

        if (!splits) {
          expandedAreas.push({ code: a.code, name: a.name });
          continue;
        }

        // 통합 시도 → 화면용 분리 pill 등록 + 시군구코드로 분리 매핑 미리 생성
        splits.forEach(function (sp) {
          expandedAreas.push({ code: sp.code, name: sp.name });
          splitCodeToBase[sp.code] = a.code;
        });

        let signguList = await TourAPI.getSigunguCodes(a.code).catch(function () { return []; });
        let map = {};
        signguList.forEach(function (s) {
          map[s.code] = pickSplitBySuffix(splits, s.name).code;
        });
        mergedSignguSplit[a.code] = map;
      }

      areas = [{ code: 'all', name: '전체' }].concat(expandedAreas);

      let results = await Promise.all([
        TourAPI.getTravelListAllAreas(ITEMS_PER_AREA),   // 지역당 최소 10개씩 보장
        TourAPI.getFestivalListAllAreas(ITEMS_PER_AREA),
      ]);
      travelPosts   = dedupeById(results[0]).map(mapTravelItem);
      festivalPosts = dedupeById(results[1]).map(mapFestivalItem);
      loaded = true;
      loadError = null;
    } catch (err) {
      console.error(err);
      loadError = err.message || '데이터를 불러오지 못했습니다.';
    }

    render();
  }

  // ── 필터 ──────────────────────────────────────────────────────────────
  function getFiltered() {
    // 시군구까지 선택된 상태면 시군구 전용 캐시에서 가져옴 (없으면 아직 로딩 전/실패)
    if (activeAreaCode !== 'all' && activeSigunguCode !== 'all') {
      let cached = sigunguPostsCache[activeAreaCode + '_' + activeSigunguCode];
      if (!cached) return [];
      return activeTab === 'travel' ? cached.travel : cached.festival;
    }

    let list = activeTab === 'travel' ? travelPosts : festivalPosts;
    if (activeAreaCode === 'all') return list;
    return list.filter(function (p) {
      return p.areaCode === activeAreaCode;
    });
  }

  // ── 시군구 목록/데이터를 필요할 때만 불러오기 ────────────────────────
  // pillCode: 화면에 보이는 시도 pill 코드 (통합 시도면 '12-gj' 같은 분리 코드)
  function ensureSigunguList(pillCode) {
    if (sigunguCache[pillCode]) return Promise.resolve(sigunguCache[pillCode]);

    let baseCode = resolveBaseAreaCode(pillCode);

    sigunguListLoading = true;
    render();

    return TourAPI.getSigunguCodes(baseCode).then(function (codes) {
      let list = codes.map(function (c) { return { code: c.code, name: c.name }; });
      if (splitCodeToBase[pillCode]) {
        // 통합 시도의 시군구 전체 중 이 분리 구역에 속하는 것만 남김
        let splitMap = mergedSignguSplit[baseCode] || {};
        list = list.filter(function (s) { return splitMap[s.code] === pillCode; });
      }
      sigunguCache[pillCode] = list;
      return list;
    }).catch(function () {
      sigunguCache[pillCode] = [];
      return [];
    }).then(function (list) {
      sigunguListLoading = false;
      render();
      return list;
    });
  }

  function ensureSigunguPosts(pillCode, sigunguCode) {
    let key = pillCode + '_' + sigunguCode;
    if (sigunguPostsCache[key]) return;

    let baseCode = resolveBaseAreaCode(pillCode);

    sigunguPostsLoading = true;
    render();

    Promise.all([
      TourAPI.getTravelListByArea(baseCode, ITEMS_PER_SIGUNGU, sigunguCode).catch(function () { return []; }),
      TourAPI.getFestivalListByArea(baseCode, ITEMS_PER_SIGUNGU, sigunguCode).catch(function () { return []; }),
    ]).then(function (results) {
      sigunguPostsCache[key] = {
        travel:   dedupeById(results[0]).map(mapTravelItem),
        festival: dedupeById(results[1]).map(mapFestivalItem),
      };
    }).catch(function () {
      sigunguPostsCache[key] = { travel: [], festival: [] };
    }).then(function () {
      sigunguPostsLoading = false;
      render();
    });
  }

  // ── 시도 클릭 ─────────────────────────────────────────────────────────
  function handleAreaClick(code) {
    if (code === 'all') {
      activeAreaCode    = 'all';
      activeSigunguCode = 'all';
      sigunguPanelOpen  = false;
    } else if (code === activeAreaCode && sigunguPanelOpen) {
      // 같은 시도를 다시 클릭 → 하위 시군구 필터만 접기 (시도 선택은 유지)
      sigunguPanelOpen  = false;
      activeSigunguCode = 'all';
    } else {
      activeAreaCode    = code;
      activeSigunguCode = 'all';
      sigunguPanelOpen  = true;
      ensureSigunguList(code);
    }
    render();
    document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── 시군구 클릭 ───────────────────────────────────────────────────────
  function handleSigunguClick(code) {
    if (code === 'all') {
      activeSigunguCode = 'all';
    } else {
      activeSigunguCode = code;
      ensureSigunguPosts(activeAreaCode, code);
    }
    render();
    document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── 지역 필터 렌더 (TourAPI 공식 시도 코드 기준) ─────────────────────
  function renderCityFilter() {
    let bar = document.getElementById('city-filter');
    bar.innerHTML = areas.map(function (area) {
      return '<button class="city-pill' + (area.code === activeAreaCode ? ' active' : '') +
        '" data-code="' + area.code + '">' + escHtml(area.name) + '</button>';
    }).join('');

    bar.querySelectorAll('.city-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleAreaClick(btn.dataset.code);
      });
    });

    renderSigunguFilter();
  }

  // ── 시군구 필터 렌더 (시도 선택 시에만 노출, 토글) ────────────────────
  function renderSigunguFilter() {
    let row = document.getElementById('sigungu-filter');
    if (!row) return;

    if (activeAreaCode === 'all' || !sigunguPanelOpen) {
      row.classList.remove('open');
      row.innerHTML = '';
      return;
    }
    row.classList.add('open');

    if (sigunguListLoading) {
      row.innerHTML = '<span class="sigungu-loading">시군구 불러오는 중...</span>';
      return;
    }

    let list  = sigunguCache[activeAreaCode] || [];
    let pills = [{ code: 'all', name: '전체' }].concat(list);

    row.innerHTML = pills.map(function (s) {
      return '<button class="sigungu-pill' + (s.code === activeSigunguCode ? ' active' : '') +
        '" data-code="' + s.code + '">' + escHtml(s.name) + '</button>';
    }).join('');

    row.querySelectorAll('.sigungu-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        handleSigunguClick(btn.dataset.code);
      });
    });
  }

  // ── 탭 활성화 ─────────────────────────────────────────────────────────
  function renderTabs() {
    document.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.tab === activeTab);
    });
  }

  // ── 포스트 HTML 생성 ──────────────────────────────────────────────────
  function detailLink(post) {
    let url = 'detail.html?id=' + post.id + '&type=' + post.contentTypeId;
    if (post.type === 'festival') {
      url += '&start=' + encodeURIComponent(post.eventStartDate) +
             '&end=' + encodeURIComponent(post.eventEndDate);
    }
    return url;
  }

  function featuredCardHTML(post) {
    let metaHTML = '';
    if (post.type === 'festival') {
      metaHTML = '<div class="meta-box">' +
        metaItem('📅', '기간', formatDateRange(post.eventStartDate, post.eventEndDate)) +
        '</div>';
    }

    return '<div class="featured-label">✦ FEATURED</div>' +
      '<div class="featured-card" data-post-id="' + post.id + '" data-href="' + detailLink(post) + '">' +
        '<div class="featured-img-wrap">' +
          '<img class="featured-img" src="' + post.mainImage + '" alt="' + escHtml(post.title) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMAGE + '\'">' +
        '</div>' +
        '<div class="featured-body">' +
          '<div>' +
            '<h2 class="featured-title">' + escHtml(post.title) + '</h2>' +
            '<p class="featured-subtitle">📍 ' + escHtml(post.addr || '주소 정보 없음') + '</p>' +
            '<p class="featured-desc" id="featured-desc" data-post-id="' + post.id + '">설명을 불러오는 중...</p>' +
          '</div>' +
          '<div>' +
            metaHTML +
            '<button class="btn-primary" style="margin-top:14px">자세히 보기 →</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  // ── 대표 카드 전용: overview(소개글) 추가 로드 ───────────────────────
  // 목록 API(areaBasedList2/searchFestival2)에는 소개글이 없어서,
  // 대표 카드 1건에 대해서만 detailCommon2를 추가로 호출해 앞부분만 잘라 보여줍니다.
  // (목록 전체에 다 걸면 항목 수만큼 API가 나가서 대표 1건으로 한정)
  function loadFeaturedOverview(post) {
    TourAPI.getDetailCommon(post.id).then(function (common) {
      let descEl = document.getElementById('featured-desc');
      // 그 사이에 사용자가 지역/탭을 바꿔서 다른 카드가 대표로 떠 있으면 무시
      if (!descEl || descEl.dataset.postId !== String(post.id)) return;

      let overview = common && common.overview ? cleanText(common.overview) : '';
      descEl.textContent = overview ? truncate(overview, 90) : '소개 정보가 없습니다.';
    }).catch(function () {
      let descEl = document.getElementById('featured-desc');
      if (descEl && descEl.dataset.postId === String(post.id)) {
        descEl.textContent = '소개 정보가 없습니다.';
      }
    });
  }

  function cleanText(raw) {
    return String(raw).replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '');
  }

  function truncate(str, maxLen) {
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen).trim() + '…';
  }

  function postCardHTML(post) {
    return '<div class="post-card" data-post-id="' + post.id + '" data-href="' + detailLink(post) + '">' +
      '<div class="post-thumb"><img src="' + post.thumbImage + '" alt="' + escHtml(post.title) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMAGE + '\'"></div>' +
      '<div class="post-title">' + escHtml(post.title) + '</div>' +
      '<div class="post-subtitle">📍 ' + escHtml(post.addr || '주소 정보 없음') + '</div>' +
      (post.type === 'festival'
        ? '<div class="post-tags"><span class="tag-chip gray">📅 ' + escHtml(formatDateRange(post.eventStartDate, post.eventEndDate)) + '</span></div>'
        : '') +
    '</div>';
  }

  function metaItem(icon, label, value) {
    return '<div>' +
      '<div class="meta-item-label">' + icon + ' ' + label + '</div>' +
      '<div class="meta-item-value">' + escHtml(value) + '</div>' +
    '</div>';
  }

  // ── 포스트 컨테이너 렌더 ──────────────────────────────────────────────
  function renderPosts() {
    let container = document.getElementById('posts-container');

    if (loadError) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">⚠️</div>' +
          '<p>' + escHtml(loadError) + '</p>' +
          '<p style="font-size:12px; color:#9ca3af; margin-top:8px;">config.js에 발급받은 서비스키가 올바르게 들어있는지 확인해주세요.</p>' +
          '<button id="retry-btn">다시 시도</button>' +
        '</div>';
      document.getElementById('retry-btn').addEventListener('click', loadData);
      return;
    }

    if (activeAreaCode !== 'all' && activeSigunguCode !== 'all' && sigunguPostsLoading) {
      container.innerHTML =
        '<div style="text-align:center; padding:80px 0; color:#9ca3af;">' +
          '<div style="font-size:32px; margin-bottom:12px;">⏳</div>' +
          '<p>지역 정보를 불러오는 중...</p>' +
        '</div>';
      return;
    }

    let filtered = getFiltered();

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">🔍</div>' +
          '<p>해당 지역의 ' + (activeTab === 'travel' ? '여행지' : '축제') + ' 정보가 없습니다</p>' +
          '<button id="reset-btn">전체 보기</button>' +
        '</div>';
      document.getElementById('reset-btn').addEventListener('click', function () {
        activeAreaCode    = 'all';
        activeSigunguCode = 'all';
        sigunguPanelOpen  = false;
        render();
      });
      return;
    }

    let featured = filtered[0];
    let rest     = filtered.slice(1);

    let activeAreaName = 'all';
    for (let i = 0; i < areas.length; i++) {
      if (areas[i].code === activeAreaCode) { activeAreaName = areas[i].name; break; }
    }
    let activeSigunguName = '';
    if (activeSigunguCode !== 'all') {
      let list = sigunguCache[activeAreaCode] || [];
      for (let i = 0; i < list.length; i++) {
        if (list[i].code === activeSigunguCode) { activeSigunguName = list[i].name; break; }
      }
    }
    let regionLabel = activeAreaCode === 'all' ? '전국' : activeAreaName + (activeSigunguName ? ' ' + activeSigunguName : '');
    let sectionLabel = regionLabel + ' ' + (activeTab === 'travel' ? '여행지 모음' : '축제 일정');

    let gridHTML = rest.length > 0
      ? '<h2 class="section-title">' + escHtml(sectionLabel) + '</h2>' +
        '<div class="post-grid">' + rest.map(postCardHTML).join('') + '</div>'
      : '';

    container.innerHTML = featuredCardHTML(featured) + gridHTML;
    loadFeaturedOverview(featured);

    container.querySelectorAll('[data-href]').forEach(function (el) {
      el.addEventListener('click', function () {
        window.location.href = el.dataset.href;
      });
    });
  }

  // ── 전체 렌더 ────────────────────────────────────────────────────────
  function render() {
    renderCityFilter();
    renderTabs();
    renderPosts();
  }

  // ── 탭 이벤트 ────────────────────────────────────────────────────────
  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  // ── 초기 로드 ────────────────────────────────────────────────────────
  loadData();

  // ── 유틸 ─────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
