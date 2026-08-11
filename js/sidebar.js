/**
 * ==================================================
 * sidebar.js
 * --------------------------------------------------
 * 왼쪽 사이드바(프로필 카드 + My page / Album / 북마크 메뉴)를
 * 그려주는 파일.
 *
 * 사용법: 페이지의 <div id="app-sidebar"></div> 안에 자기 자신을 채워 넣는다.
 *
 * - 프로필 이름/아바타는 app.js 가 전역으로 갖고 있는 state.profile 값을
 *   그대로 읽어온다. (그래서 <script> 순서가 app.js -> sidebar.js 여야 한다)
 * - 어떤 메뉴를 활성 상태로 보여줄지는 <body data-page="..."> 값으로 판단한다.
 *   - data-page="mypage"                                     -> My page 활성
 *   - data-page="album-list" / "album-detail" / "album-edit" -> Album 활성
 *   - data-page="bookmark"                                    -> 북마크 활성
 *   세 메뉴는 서로 배타적인 별도 조건으로 판단하므로, 한 메뉴가 활성일 때
 *   다른 메뉴가 같이 활성되지 않는다.
 * - 프로필 이름/사진을 나중에 마이페이지에서 바꾸면, app.js 쪽에서
 *   renderSidebarProfile() 을 다시 호출해 이 화면도 함께 갱신한다.
 *   (sidebar.js는 "최초 렌더링"만 책임지고, 이후 갱신은 app.js가 담당)
 * ==================================================
 */

const Sidebar = {
  render(){
    const host = document.getElementById('app-sidebar');
    if(!host) return; // 로그인 페이지처럼 사이드바가 없는 페이지는 조용히 무시

    const currentPage = document.body.dataset.page; // mypage / album-list / album-detail / album-edit / bookmark
    const isMyPageActive = currentPage === 'mypage';
    const isAlbumActive = currentPage === 'album-list' || currentPage === 'album-detail' || currentPage === 'album-edit';
    const isBookmarkActive = currentPage === 'bookmark';

    // app.js 가 아직 로드되지 않았거나 오류가 났을 때를 대비한 안전장치
    const profile = (typeof state !== 'undefined' && state.profile) ? state.profile : { name: '여행자', avatar: null };

    host.innerHTML = `
      <aside class="sidebar">
        <div class="profile-card">
          <span class="avatar" id="sidebar-avatar" style="${profile.avatar ? `background-image:url(${profile.avatar})` : ''}"></span>
          <div class="profile-text">
            <strong id="sidebar-name">${profile.name} 님,</strong>
            <span>어서오세요.</span>
          </div>
        </div>

        <a href="mypage.html" class="side-menu-item ${isMyPageActive ? 'is-active' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
          My page
        </a>
        <a href="album.html" class="side-menu-item ${isAlbumActive ? 'is-active' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18M4 8h4"/></svg>
          Album
        </a>
        <a href="bookmark.html" class="side-menu-item ${isBookmarkActive ? 'is-active' : ''}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="4"/>
            <circle cx="8" cy="8.5" r="1.1" fill="currentColor" stroke="none"/>
            <path d="M11 8.5h6"/>
            <circle cx="8" cy="15.5" r="1.1" fill="currentColor" stroke="none"/>
            <path d="M11 15.5h6"/>
          </svg>
          북마크
        </a>
      </aside>
    `;
  }
};

document.addEventListener('DOMContentLoaded', () => Sidebar.render());
