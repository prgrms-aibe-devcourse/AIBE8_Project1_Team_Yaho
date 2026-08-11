// ── list.js — 여행지 · 축제 목록 페이지 (TourAPI 연동) ────────────────────

(function () {
  // ── 상태 ──────────────────────────────────────────────────────────────
  var activeAreaCode = 'all'; // '전체' 또는 lDongRegnCd (예: '11')
  var activeTab       = 'travel';

  var areas         = [{ code: 'all', name: '전체' }]; // TourAPI.getAreaCodes() 결과로 채워짐
  var travelPosts   = [];
  var festivalPosts = [];
  var loaded        = false;
  var loadError     = null;

  var ITEMS_PER_AREA = 10; // 지역당 최소 보장 개수

  var FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800&h=600&fit=crop&auto=format';

  // URL 파라미터로 초기 탭 설정
  var params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'festival') activeTab = 'festival';

  // ── TourAPI 원본 → 카드용 데이터로 변환 ─────────────────────────────
  function mapTravelItem(item) {
    return {
      id: item.contentid,
      type: 'travel',
      contentTypeId: TourAPI.CONTENT_TYPE.TRAVEL,
      title: item.title || '',
      addr: [item.addr1, item.addr2].filter(Boolean).join(' ').trim(),
      areaCode: item.lDongRegnCd || '', // 지역 필터링 기준
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
      areaCode: item.lDongRegnCd || '',
      mainImage: item.firstimage || item.firstimage2 || FALLBACK_IMAGE,
      thumbImage: item.firstimage2 || item.firstimage || FALLBACK_IMAGE,
      eventStartDate: item.eventstartdate || '',
      eventEndDate: item.eventenddate || '',
    };
  }

  // ── 같은 contentid가 여러 지역 호출에서 중복으로 잡힐 수 있어 제거 ──
  function dedupeById(list) {
    var seen = {};
    return list.filter(function (item) {
      if (seen[item.contentid]) return false;
      seen[item.contentid] = true;
      return true;
    });
  }

  function formatDateRange(start, end) {
    var fmt = function (d) {
      if (!d || d.length !== 8) return d || '';
      return d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6, 8);
    };
    if (!start) return '-';
    if (!end || end === start) return fmt(start);
    return fmt(start) + ' – ' + fmt(end).slice(5); // "2025.10.01 – 10.12" 형태
  }

  // ── 데이터 로드 ───────────────────────────────────────────────────────
  async function loadData() {
    var container = document.getElementById('posts-container');
    container.innerHTML =
      '<div style="text-align:center; padding:80px 0; color:#9ca3af;">' +
        '<div style="font-size:32px; margin-bottom:12px;">⏳</div>' +
        '<p>여행 정보를 불러오는 중...</p>' +
      '</div>';

    try {
      var areaCodes = await TourAPI.getAreaCodes(); // 공식 시도 17개
      areas = [{ code: 'all', name: '전체' }].concat(
        areaCodes.map(function (a) { return { code: a.code, name: a.name }; })
      );

      var results = await Promise.all([
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
    var list = activeTab === 'travel' ? travelPosts : festivalPosts;
    if (activeAreaCode === 'all') return list;
    return list.filter(function (p) {
      return p.areaCode === activeAreaCode;
    });
  }

  // ── 지역 필터 렌더 (TourAPI 공식 시도 코드 기준) ─────────────────────
  function renderCityFilter() {
    var bar = document.getElementById('city-filter');
    bar.innerHTML = areas.map(function (area) {
      return '<button class="city-pill' + (area.code === activeAreaCode ? ' active' : '') +
        '" data-code="' + area.code + '">' + escHtml(area.name) + '</button>';
    }).join('');

    bar.querySelectorAll('.city-pill').forEach(function (btn) {
      btn.addEventListener('click', function () {
        activeAreaCode = btn.dataset.code;
        render();
        document.querySelector('.tabs').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    var url = 'detail.html?id=' + post.id + '&type=' + post.contentTypeId;
    if (post.type === 'festival') {
      url += '&start=' + encodeURIComponent(post.eventStartDate) +
             '&end=' + encodeURIComponent(post.eventEndDate);
    }
    return url;
  }

  function featuredCardHTML(post) {
    var metaHTML = '';
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
      var descEl = document.getElementById('featured-desc');
      // 그 사이에 사용자가 지역/탭을 바꿔서 다른 카드가 대표로 떠 있으면 무시
      if (!descEl || descEl.dataset.postId !== String(post.id)) return;

      var overview = common && common.overview ? cleanText(common.overview) : '';
      descEl.textContent = overview ? truncate(overview, 90) : '소개 정보가 없습니다.';
    }).catch(function () {
      var descEl = document.getElementById('featured-desc');
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
    var container = document.getElementById('posts-container');

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

    var filtered = getFiltered();

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
          '<div class="empty-icon">🔍</div>' +
          '<p>해당 지역의 ' + (activeTab === 'travel' ? '여행지' : '축제') + ' 정보가 없습니다</p>' +
          '<button id="reset-btn">전체 보기</button>' +
        '</div>';
      document.getElementById('reset-btn').addEventListener('click', function () {
        activeAreaCode = 'all';
        render();
      });
      return;
    }

    var featured = filtered[0];
    var rest     = filtered.slice(1);

    var activeAreaName = 'all';
    for (var i = 0; i < areas.length; i++) {
      if (areas[i].code === activeAreaCode) { activeAreaName = areas[i].name; break; }
    }
    var sectionLabel = (activeAreaCode === 'all' ? '전국 ' : activeAreaName + ' ') +
      (activeTab === 'travel' ? '여행지 모음' : '축제 일정');

    var gridHTML = rest.length > 0
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
