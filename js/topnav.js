/**
 * ==================================================
 * topnav.js
 * --------------------------------------------------
 * index.html(메인 지도 페이지)의 <header class="header">와,
 * 페이지 전체에서 <use href="#i-...">로 쓰는 SVG 아이콘
 * 스프라이트(<svg class="sprite">)를 함께 그려주는 파일.
 *
 * ⚠️ 스프라이트는 헤더 전용이 아니라 좌측 패널 칩, 지도, 우측
 *    패널(길찾기/좋아요) 등 페이지 곳곳에서 참조한다. 여기서
 *    함께 그려주는 이유는 "헤더와 함께 모듈화"해달라는 요청에
 *    따른 것이고, 실제로는 페이지 전체가 이 스프라이트에 의존한다.
 *    (같은 문서 안의 #i-xxx 참조라서 나중에 추가돼도 브라우저가
 *     자동으로 연결해주므로 렌더링 순서 자체는 문제되지 않는다)
 *
 * 사용법: index.html의 <div id="app-topnav"></div> 안에
 *        자기 자신을 채워 넣는다.
 *
 * ⚠️ 스크립트 로딩 순서 주의 + DOMContentLoaded 쓰지 말 것:
 *    main.js(type="module")는 #btnSaved / #savedCount를 querySelector로
 *    캐싱해서 쓰는데, 이 요소들은 이 파일이 렌더링해야 생긴다.
 *    module 스크립트는 "문서 파싱이 끝난 직후" 실행되며, 이 시점은
 *    DOMContentLoaded 이벤트보다 "먼저"다. 그래서 예전에 이 파일의
 *    render()를 DOMContentLoaded 리스너 안에 넣어뒀을 때는, main.js가
 *    #btnSaved를 미리 캐싱하는 시점에 헤더가 아직 안 그려져 있어 null이
 *    캐싱됐고, 이후 el.btnSaved.addEventListener(...)에서 에러가 나면서
 *    그 뒤에 있는 initMap() 호출까지 못 가서 지도가 안 그려지는 버그가
 *    있었다. 그래서 render()는 DOMContentLoaded를 기다리지 않고 스크립트가
 *    실행되는 즉시(파일 맨 아래 `Topnav.render();`) 호출한다 — 이 스크립트가
 *    <div id="app-topnav">보다 뒤, main.js보다 앞에 있기만 하면 항상 안전하다.
 *    (순서를 바꾸지 말 것)
 *
 * 로그인 상태:
 *    localStorage('isLoggedIn')로 유지되어 새로고침해도 안 풀린다.
 *    "로그인" 버튼을 누르면 지금 페이지 주소를
 *    sessionStorage('postLoginRedirect')에 저장해두고 login.html로
 *    이동하고, login.html에서 로그인에 성공하면 그 주소로 다시
 *    돌려보내준다 (js/app.js의 로그인 처리 부분 참고).
 * ==================================================
 */

const Topnav = {
  // gnb 메뉴 정의: href = 실제 이동할 페이지, match = 이 페이지들에 있을 때 active로 표시
  // ⚠️ "여행 추천"은 postList.html/detail.html, "여행 수첩"은 album 계열 페이지로
  //    연결해뒀습니다. 실제 파일명이 다르면 이 배열만 고치면 됩니다.
  MENU_ITEMS: [
    { icon: 'i-home',     label: '여행 지도', href: 'index.html',    match: ['index.html', ''] },
    { icon: 'i-sparkles', label: '여행 정보', href: 'postList.html', match: ['postList.html', 'detail.html'] },
    { icon: 'i-notebook', label: '여행 수첩', href: 'album.html',    match: ['album.html', 'album-detail.html', 'album-edit.html'] },
    { icon: 'i-user',     label: '마이페이지', href: 'mypage.html',  match: ['mypage.html'] },
  ],

  // 지금 열려있는 파일명만 뽑아냄 (예: '/app/mypage.html' -> 'mypage.html')
  getCurrentFile() {
    const file = location.pathname.split('/').pop();
    return file || 'index.html'; // 루트('/')로 접속한 경우 index.html로 취급
  },

  buildGnbHtml() {
    const currentFile = this.getCurrentFile();
    return this.MENU_ITEMS.map((item) => {
      const isActive = item.match.indexOf(currentFile) > -1;
      return '<li>' +
        '<a class="gnb__item' + (isActive ? ' is-active' : '') + '"' +
          ' href="' + item.href + '"' +
          (isActive ? ' aria-current="page"' : '') + '>' +
          '<svg class="ico"><use href="#' + item.icon + '"/></svg>' + item.label +
        '</a>' +
      '</li>';
    }).join('');
  },

  render() {
    const host = document.getElementById('app-topnav');
    if (!host) return; // 헤더가 없는 페이지에서 잘못 불러도 조용히 무시

    host.innerHTML = `
      <svg class="sprite" aria-hidden="true" focusable="false">
        <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 9.7 12 3l9 6.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.7Z"/></symbol>
        <symbol id="i-sparkles" viewBox="0 0 24 24">
          <path d="m11.5 3 1.7 4.3 4.3 1.7-4.3 1.7L11.5 15 9.8 10.7 5.5 9l4.3-1.7L11.5 3Z"/>
          <path d="m18.5 14.5.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/>
        </symbol>
        <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.2-4.2"/></symbol>
        <symbol id="i-map" viewBox="0 0 24 24"><path d="M9 4 3.6 6.3v13.4L9 17.4l6 2.3 5.4-2.3V4L15 6.3 9 4Z"/><path d="M9 4v13.4M15 6.3v13.4"/></symbol>
        <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/></symbol>
        <symbol id="i-bookmark" viewBox="0 0 24 24"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16.2l-6.5-4-6.5 4V4.5a1 1 0 0 1 1-1Z"/></symbol>
        <symbol id="i-notebook" viewBox="0 0 24 24">
          <rect x="5" y="3" width="14" height="18" rx="2"/>
          <path d="M9 3v18M12.5 8h4M12.5 12h4M12.5 16h2.5"/>
        </symbol>
        <symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21.5s7-6.4 7-11.3a7 7 0 1 0-14 0c0 4.9 7 11.3 7 11.3Z"/><circle cx="12" cy="10" r="2.4"/></symbol>
        <symbol id="i-gear" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.1"/><path d="M12 2.6v2.6M12 18.8v2.6M4.4 4.4l1.9 1.9M17.7 17.7l1.9 1.9M2.6 12h2.6M18.8 12h2.6M4.4 19.6l1.9-1.9M17.7 6.3l1.9-1.9"/></symbol>
        <symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="m9.5 5.5 6.5 6.5-6.5 6.5"/></symbol>
        <symbol id="i-chevron-left" viewBox="0 0 24 24"><path d="M14.5 5.5 8 12l6.5 6.5"/></symbol>
        <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></symbol>
        <symbol id="i-car" viewBox="0 0 24 24">
          <path d="M4 16.5v-4l1.9-4.2a1 1 0 0 1 .9-.6h10.4a1 1 0 0 1 .9.6L20 12.5v4H4Z"/>
          <path d="M4 12.5h16M5 16.5v2.2h3v-2.2M16 16.5v2.2h3v-2.2M6.6 14.5h1.6M15.8 14.5h1.6"/>
        </symbol>
        <symbol id="i-train" viewBox="0 0 24 24">
          <rect x="5.5" y="3" width="13" height="13" rx="4"/>
          <path d="M5.5 10h13M8 16l-2.2 3.6M16 16l2.2 3.6"/>
          <circle cx="9.2" cy="13.2" r=".9"/><circle cx="14.8" cy="13.2" r=".9"/>
        </symbol>
        <symbol id="i-bus" viewBox="0 0 24 24">
          <rect x="4" y="3.5" width="16" height="13" rx="2.6"/>
          <path d="M4 11h16M7.5 16.5v2.2M16.5 16.5v2.2M8 6.8h8"/>
          <circle cx="8" cy="13.7" r=".9"/><circle cx="16" cy="13.7" r=".9"/>
        </symbol>
        <symbol id="i-plane" viewBox="0 0 24 24"><path d="M17.9 19.4 16 11.2l3.4-3.4a2.1 2.1 0 1 0-3-3L13 8.2 4.8 6.3a.5.5 0 0 0-.5.8l4.1 4.1-2 2-2.4-.4a.5.5 0 0 0-.4.9l3.4 1.9 1.9 3.4a.5.5 0 0 0 .9-.4l-.4-2.4 2-2 4.1 4.1a.5.5 0 0 0 .8-.5Z"/></symbol>
        <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5.2l3.2 1.9"/></symbol>
        <symbol id="i-route" viewBox="0 0 24 24">
          <circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="6" r="2.6"/>
          <path d="M15.4 6H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H8.6"/>
        </symbol>
        <symbol id="i-send" viewBox="0 0 24 24"><path d="M21.5 2.5 2.8 9.9a.5.5 0 0 0 0 .9l7.6 2.8 2.8 7.6a.5.5 0 0 0 .9 0l7.4-18.7Z"/><path d="M10.4 13.6 21.5 2.5"/></symbol>
        <symbol id="i-heart" viewBox="0 0 24 24"><path d="M12 20.6S3.4 15.1 3.4 9.3A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.6 2.9c0 5.8-8.6 11.3-8.6 11.3Z"/></symbol>
        <symbol id="i-mouse" viewBox="0 0 24 24"><rect x="7.5" y="2.8" width="9" height="18.4" rx="4.5"/><path d="M12 6.8v3.4"/></symbol>
        <symbol id="i-dice" viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.3"/><circle cx="15.5" cy="15.5" r="1.3"/><circle cx="12" cy="12" r="1.3"/></symbol>
      </svg>

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
            <ul class="gnb__list">${this.buildGnbHtml()}</ul>
          </nav>

          <div class="header__actions">
            <button class="icon-btn" type="button" id="btnSaved" aria-label="찜한 여행지">
              <svg class="ico"><use href="#i-bookmark"/></svg>
            </button>
            <button class="btn btn--primary btn--login" type="button" id="btnLogin"></button>
          </div>
        </div>
      </header>
    `;

    this.wireLoginButton();
  },

  /* ---------------- 로그인 상태 ---------------- */
  isLoggedIn() {
    try { return localStorage.getItem('isLoggedIn') === 'true'; }
    catch (e) { return false; }
  },

  setLoggedIn(value) {
    try { localStorage.setItem('isLoggedIn', value ? 'true' : 'false'); }
    catch (e) { /* 저장 실패는 무시 */ }
    window.dispatchEvent(new CustomEvent('wtg:login-changed'));
  },

  updateLoginButtonLabel() {
    const btn = document.getElementById('btnLogin');
    if (!btn) return;
    btn.textContent = this.isLoggedIn() ? '로그아웃' : '로그인';
  },

  wireLoginButton() {
    this.updateLoginButtonLabel();

    const btn = document.getElementById('btnLogin');
    if (!btn) return;

    btn.addEventListener('click', () => {
      if (this.isLoggedIn()) {
        // 로그아웃: 페이지 이동 없이 바로 상태만 변경
        this.setLoggedIn(false);
        this.updateLoginButtonLabel();
        this.showToast('로그아웃 되었습니다');
      } else {
        // 로그인 하러 이동. 로그인 성공 후 지금 페이지로 되돌아오도록 주소를 저장해둔다.
        try { sessionStorage.setItem('postLoginRedirect', location.href); }
        catch (e) { /* 저장 실패해도 로그인 자체는 진행 */ }
        location.href = 'login.html';
      }
    });
  },

  // index.html에는 이미 <div id="toast" class="toast">가 있으므로 그걸 그대로 사용
  showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
};

Topnav.render();
