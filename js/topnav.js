/**
 * ==================================================
 * topnav.js
 * --------------------------------------------------
 * 상단 네비게이션을 그려주는 파일. 페이지의 <div id="app-topnav"></div> 안에
 * 자기 자신을 채워 넣는다.
 *
 * 두 가지 스킨을 지원한다 (호스트 div의 data-variant 속성으로 선택):
 *  - variant 없음(기본): mypage / album / album-detail / album-edit 등
 *    "앱" 계열 페이지가 쓰는 스킨 (style_mp.css의 .topnav/.brand/.menu-item)
 *  - variant="home": index.html(랜딩/지도 페이지)이 쓰는 스킨
 *    (style.css의 .header/.gnb, SVG 스프라이트 아이콘 사용 — 스프라이트
 *    <symbol> 정의는 호출부 HTML에 이미 있어야 함)
 *
 * 주의:
 * - app.js 가 정의하는 toast() 함수를 사용하므로(있으면), 앱 계열 페이지는
 *   <script> 순서가 app.js -> topnav.js 여야 한다.
 * - render()는 DOMContentLoaded를 기다리지 않고 스크립트가 실행되는 즉시
 *   그린다. <div id="app-topnav">보다 뒤에 <script src="js/topnav.js">를
 *   두면(관례상 항상 그렇다) 이 시점에 해당 div는 이미 파싱되어 있다.
 *   즉시 렌더링해야 하는 이유: index.html의 main.js가 모듈 스크립트라
 *   DOMContentLoaded보다 먼저(문서 파싱 완료 시점에) 실행되면서
 *   #btnSaved 등을 querySelector로 미리 캐싱해 두는데, topnav.js가
 *   DOMContentLoaded까지 렌더링을 미루면 그 시점엔 헤더가 아직 없어
 *   캐싱된 값이 null이 되고, 이후 el.btnSaved.addEventListener(...)에서
 *   에러가 나 initMap() 호출까지 도달하지 못해 지도가 안 그려졌다.
 * ==================================================
 */

const HOME_MENU = [
  { href: 'index.html',  icon: 'i-home',     label: '여행 지도' },
  { href: 'detail.html', icon: 'i-sparkles', label: '여행 정보' },
  { href: 'album.html',  icon: 'i-notebook', label: '여행 수첩' },
  { href: 'mypage.html', icon: 'i-user',     label: '마이페이지' },
];

const Topnav = {
  render(){
    const host = document.getElementById('app-topnav');
    if(!host) return; // 로그인 페이지처럼 상단바가 없는 페이지는 조용히 무시

    if(host.dataset.variant === 'home'){
      this.renderHome(host);
    } else {
      this.renderApp(host);
    }
  },

  renderApp(host){
    host.innerHTML = `
      <header class="topnav">
        <a href="album.html" class="brand">
          <span class="brand-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12L22 3L15 22L11 13L2 12Z" fill="white" stroke="white" stroke-width="1.2" stroke-linejoin="round"/></svg>
          </span>
          <div class="brand-text">
            <strong>사이트 이름</strong>
            <span>간단한 설명</span>
          </div>
        </a>

        <nav class="main-menu">
          <a href="#" class="menu-item soon">여행 지도</a>
          <a href="#" class="menu-item soon">여행 추천</a>
          <a href="#" class="menu-item soon">지역 탐색</a>
          <a href="#" class="menu-item soon">여행 수첩</a>
          <!-- 마이페이지/앨범 목록/상세/수정 페이지는 모두 "마이페이지" 섹션에 속하므로 항상 active -->
          <a href="mypage.html" class="menu-item active">마이페이지</a>
        </nav>

        <!-- 로그아웃 버튼. 실제 페이지 이동이라 별도 JS 불필요 -->
        <a href="login.html" class="pill-btn">로그아웃</a>
      </header>
    `;

    // "준비 중" 메뉴 클릭 시 안내 토스트 (app.js 의 전역 toast() 재사용)
    host.querySelectorAll('.menu-item.soon').forEach(el=>{
      el.addEventListener('click', (e)=>{
        e.preventDefault();
        if(typeof toast === 'function') toast('준비 중인 기능입니다');
      });
    });
  },

  renderHome(host){
    const current = location.pathname.split('/').pop() || 'index.html';

    const menuHtml = HOME_MENU.map(item => {
      const active = item.href === current;
      return `
        <li>
          <a class="gnb__item${active ? ' is-active' : ''}" href="${item.href}"${active ? ' aria-current="page"' : ''}>
            <svg class="ico"><use href="#${item.icon}"/></svg>${item.label}
          </a>
        </li>`;
    }).join('');

    host.innerHTML = `
      <header class="header">
        <div class="header__inner">
          <a class="logo" href="index.html">
            <img class="logo__mark" src="images/ui-logo.png" alt="" />
            <span class="logo__text">
              <strong class="logo__title">어디갈까?</strong>
              <span class="logo__sub">국내여행 랜덤 추천 서비스</span>
            </span>
          </a>

          <nav class="gnb" aria-label="주 메뉴">
            <ul class="gnb__list">${menuHtml}</ul>
          </nav>

          <div class="header__actions">
            <button class="icon-btn" type="button" id="btnSaved" aria-label="찜한 여행지">
              <svg class="ico"><use href="#i-bookmark"/></svg>
              <span class="icon-btn__badge" id="savedCount" hidden>0</span>
            </button>
            <button class="btn btn--primary btn--login" type="button">로그인</button>
          </div>
        </div>
      </header>
    `;

    // "준비 중" 메뉴(예: 여행 정보) 클릭 시 안내 토스트
    HOME_MENU.filter(item => item.soon).forEach(item => {
      const el = host.querySelector(`.gnb__item[href="${item.href}"]`);
      if(!el) return;
      el.addEventListener('click', (e)=>{
        e.preventDefault();
        if(typeof toast === 'function') toast('준비 중인 기능입니다');
      });
    });
  }
};

Topnav.render();
