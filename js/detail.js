// ── detail.js — 게시글 상세 페이지 (TourAPI 연동) ──────────────────────

(function () {
  var params        = new URLSearchParams(window.location.search);
  var contentId      = params.get('id');
  var contentTypeId  = parseInt(params.get('type'), 10) || TourAPI.CONTENT_TYPE.TRAVEL;
  var eventStart     = params.get('start') || '';
  var eventEnd       = params.get('end') || '';
  var isFestival     = contentTypeId === TourAPI.CONTENT_TYPE.FESTIVAL;

  var container = document.getElementById('detail-container');

  var FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200&h=700&fit=crop&auto=format';

  if (!contentId) {
    renderNotFound();
    return;
  }

  load();

  // ── 데이터 로드 ───────────────────────────────────────────────────────
  async function load() {
    container.innerHTML =
      '<div style="text-align:center; padding: 80px 0; color: #9ca3af;">' +
        '<div style="font-size:32px; margin-bottom:12px;">⏳</div>' +
        '<p>불러오는 중...</p>' +
      '</div>';

    try {
      var result = await TourAPI.getDetailAll(contentId, contentTypeId);
      if (!result.common) {
        renderNotFound();
        return;
      }
      renderDetail(result.common, result.intro, result.images, result.extraInfo);
    } catch (err) {
      console.error(err);
      container.innerHTML =
        '<div class="empty-state" style="padding:80px 0">' +
          '<div class="empty-icon">⚠️</div>' +
          '<p>' + escHtml(err.message || '정보를 불러오지 못했습니다.') + '</p>' +
          '<button id="retry-btn" style="padding:10px 24px; background:#2563EB; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer">다시 시도</button>' +
        '</div>';
      document.getElementById('retry-btn').addEventListener('click', load);
    }
  }

  function renderNotFound() {
    container.innerHTML =
      '<div class="empty-state" style="padding:80px 0">' +
        '<div class="empty-icon">🔍</div>' +
        '<p>게시글을 찾을 수 없습니다</p>' +
        '<a href="postList.html"><button style="padding:10px 24px; background:#2563EB; color:white; border:none; border-radius:8px; font-size:14px; font-weight:700; cursor:pointer">목록으로 돌아가기</button></a>' +
      '</div>';
  }

  // ── 소개글 텍스트 정리 ────────────────────────────────────────────────
  // TourAPI overview/program 등은 HTML 태그가 섞여 오는 경우가 있어 태그를
  // 제거하고 이스케이프한 뒤 줄바꿈만 살립니다.
  function cleanText(raw) {
    if (!raw) return '';
    var noTags = String(raw)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
    return escHtml(noTags).replace(/\n/g, '<br>');
  }

  // ── 렌더 ─────────────────────────────────────────────────────────────
  function renderDetail(common, intro, images, extraInfo) {
    document.title = (common.title || '상세 보기') + ' — 어디갈까?';

    var addr = [common.addr1, common.addr2].filter(Boolean).join(' ').trim();
    var heroImage = common.firstimage || FALLBACK_IMAGE;

    // ── Info cards ──────────────────────────────────────────────────────
    var infoItems = isFestival ? festivalInfoItems(intro, common) : travelInfoItems(intro, common);
    infoItems = infoItems.filter(function (item) { return item.value; });

    var infoHTML = infoItems.map(function (item) {
      return '<div class="info-card">' +
        '<div class="info-card-icon">' + item.icon + '</div>' +
        '<div class="info-card-label">' + escHtml(item.label) + '</div>' +
        '<div class="info-card-value">' + cleanText(item.value) + '</div>' +
      '</div>';
    }).join('');

    var infoBlockHTML = infoItems.length > 0
      ? '<div class="info-cards" style="grid-template-columns:repeat(' + infoItems.length + ', 1fr)">' + infoHTML + '</div>'
      : '';

    // ── 이용 안내 (반복정보: 입장료, 체험안내 등 이름-값 쌍 여러 개) ──
    // 값이 짧으면(예: "무료", "있음") 카드 그리드로, 길면(가격표 등 텍스트 덩어리)
    // 카드 폭에 욱여넣지 않고 전체 너비 + 접기/펼치기 블록으로 따로 보여줍니다.
    var LONG_TEXT_THRESHOLD = 40; // 이 글자 수를 넘으면 "긴 항목"으로 분류
    var extraInfoHTML = '';
    var extraInfoList = (extraInfo || []).filter(function (item) {
      return item.infoname && item.infotext;
    });

    if (extraInfoList.length > 0) {
      var shortItems = extraInfoList.filter(function (item) {
        return String(item.infotext).length <= LONG_TEXT_THRESHOLD;
      });
      var longItems = extraInfoList.filter(function (item) {
        return String(item.infotext).length > LONG_TEXT_THRESHOLD;
      });

      var shortHTML = shortItems.length > 0
        ? '<div class="info-cards" style="grid-template-columns:repeat(auto-fill, minmax(160px, 1fr))">' +
            shortItems.map(function (item) {
              return '<div class="info-card">' +
                '<div class="info-card-label">' + escHtml(item.infoname) + '</div>' +
                '<div class="info-card-value">' + cleanText(item.infotext) + '</div>' +
              '</div>';
            }).join('') +
          '</div>'
        : '';

      var longHTML = longItems.map(function (item, idx) {
        var valId = 'long-info-' + idx;
        return '<div class="info-long-block">' +
          '<div class="info-long-label">' + escHtml(item.infoname) + '</div>' +
          '<div class="info-long-value" id="' + valId + '">' + cleanText(item.infotext) + '</div>' +
          '<button class="info-long-toggle" data-target="' + valId + '">더 보기</button>' +
        '</div>';
      }).join('');

      extraInfoHTML =
        '<div class="detail-section">' +
          '<h3 class="detail-section-title">이용 안내</h3>' +
          shortHTML + longHTML +
        '</div>';
    }

    // ── Gallery ───────────────────────────────────────────────────────
    var galleryHTML = '';
    if (images && images.length > 0) {
      var galCols = 'repeat(' + Math.min(images.length, 4) + ', 1fr)';
      var imgs = images.map(function (img, i) {
        return '<div class="gallery-img">' +
          '<img src="' + (img.originimgurl || heroImage) + '" alt="' + escHtml(common.title) + ' 사진 ' + (i + 1) + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'">' +
        '</div>';
      }).join('');
      galleryHTML =
        '<div class="detail-section">' +
          '<h3 class="detail-section-title">현장 사진</h3>' +
          '<div class="gallery" style="grid-template-columns:' + galCols + '">' + imgs + '</div>' +
        '</div>';
    }

    // ── 홈페이지 링크 (있으면) ────────────────────────────────────────
    var homepageHTML = '';
    var homepageRaw = isFestival ? intro?.eventhomepage : common.homepage;
    var homepageUrl = extractUrl(homepageRaw);
    if (homepageUrl) {
      homepageHTML =
        '<div class="detail-section">' +
          '<a href="' + escHtml(homepageUrl) + '" target="_blank" rel="noopener noreferrer" class="btn-primary" style="display:inline-block; text-decoration:none;">공식 홈페이지 방문 →</a>' +
        '</div>';
    }

    // ── 전체 페이지 HTML 주입 ─────────────────────────────────────────
    container.innerHTML =
      '<nav class="breadcrumb">' +
        '<a href="postList.html">홈</a>' +
        '<span class="sep">/</span>' +
        '<a href="postList.html?tab=' + (isFestival ? 'festival' : 'travel') + '">' + (isFestival ? '축제' : '여행지') + '</a>' +
        '<span class="sep">/</span>' +
        '<span class="current">' + escHtml(common.title) + '</span>' +
      '</nav>' +

      (addr ? '<div class="detail-province-badge">📍 ' + escHtml(addr) + '</div>' : '') +

      '<h1 class="detail-title">' + escHtml(common.title) + '</h1>' +
      (isFestival && (eventStart || eventEnd)
        ? '<p class="detail-subtitle">📅 ' + escHtml(formatDateRange(eventStart, eventEnd)) + '</p>'
        : '') +

      '<div class="detail-meta-row">' +
        '<div class="detail-tags"></div>' +
        '<div class="detail-actions">' +
          '<button class="action-btn">🔖 저장</button>' +
          '<button class="action-btn">↗️ 공유</button>' +
        '</div>' +
      '</div>' +

      '<div class="detail-hero">' +
        '<img src="' + heroImage + '" alt="' + escHtml(common.title) + '" onerror="this.src=\'' + FALLBACK_IMAGE + '\'">' +
      '</div>' +

      infoBlockHTML +

      (common.overview
        ? '<div class="detail-section">' +
            '<h3 class="detail-section-title">소개</h3>' +
            '<p class="detail-desc">' + cleanText(common.overview) + '</p>' +
          '</div>'
        : '') +

      extraInfoHTML +

      galleryHTML +
      homepageHTML +

      '<div class="cta-banner">' +
        '<h2>✈️ 다음 여행은 어디로 떠나볼까요?</h2>' +
        '<p>랜덤 여행 뽑기로 숨겨진 여행지를 발견해보세요</p>' +
        '<a href="postList.html"><button class="btn-white">🎲 목록으로 돌아가기</button></a>' +
      '</div>';

    container.querySelectorAll('.info-long-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.dataset.target);
        var isExpanded = target.classList.toggle('expanded');
        btn.textContent = isExpanded ? '접기' : '더 보기';
      });
    });
  }

  function travelInfoItems(intro, common) {
    var items = [];
    if (intro) {
      items = items.concat([
        { icon: '🕐', label: '이용시간',   value: intro.usetime },
        { icon: '⏱️', label: '소요시간',   value: intro.spendtime },
        { icon: '🌿', label: '이용 시기',  value: intro.useseason },
        { icon: '🅿️', label: '주차',      value: intro.parking },
        { icon: '📅', label: '쉬는 날',   value: intro.restdate },
      ]);
    }
    if (common && common.tel) {
      items.push({ icon: '☎️', label: '전화번호', value: common.tel });
    }
    return items;
  }

  function festivalInfoItems(intro, common) {
    var items = [
      { icon: '📅', label: '기간',       value: formatDateRange(eventStart, eventEnd) !== '-' ? formatDateRange(eventStart, eventEnd) : '' },
    ];
    if (intro) {
      items = items.concat([
        { icon: '📍', label: '행사 장소',  value: intro.eventplace },
        { icon: '⏰', label: '공연 시간',  value: intro.playtime },
        { icon: '🎟️', label: '이용 요금', value: intro.usetimefestival },
        { icon: '🔞', label: '관람 연령',  value: intro.agelimit },
        { icon: '🎫', label: '예매처',     value: intro.bookingplace },
        { icon: '☎️', label: '문의',      value: intro.sponsor1tel },
      ]);
    }
    // 주최측 문의 전화(sponsor1tel)가 없으면 장소 전화번호(common.tel)로 대체
    if (common && common.tel && !(intro && intro.sponsor1tel)) {
      items.push({ icon: '☎️', label: '전화번호', value: common.tel });
    }
    return items;
  }

  function formatDateRange(start, end) {
    var fmt = function (d) {
      if (!d || d.length !== 8) return d || '';
      return d.slice(0, 4) + '.' + d.slice(4, 6) + '.' + d.slice(6, 8);
    };
    if (!start) return '-';
    if (!end || end === start) return fmt(start);
    return fmt(start) + ' – ' + fmt(end).slice(5);
  }

  function extractUrl(raw) {
    if (!raw) return '';
    var m = String(raw).match(/href="([^"]+)"/i) || String(raw).match(/(https?:\/\/[^\s"<]+)/i);
    return m ? m[1] : '';
  }

  // ── 유틸 ─────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
