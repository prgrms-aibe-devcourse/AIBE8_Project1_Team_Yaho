/**
 * ==================================================
 * topnav.js
 * --------------------------------------------------
 * 상단 네비게이션(로고 + 메뉴 + 로그인 버튼)을 그려주는 파일.
 *
 * 사용법: 페이지의 <div id="app-topnav"></div> 안에 자기 자신을 채워 넣는다.
 * 5개 앱 페이지(mypage / album / album-detail / album-edit)가 모두
 * 똑같은 상단바를 쓰기 때문에, 이 파일 하나만 고치면 전체 페이지의
 * 상단바가 한꺼번에 바뀐다. (예전에는 html 파일마다 같은 마크업이
 * 중복돼 있어서 5곳을 일일이 고쳐야 했다)
 *
 * 주의: app.js 가 정의하는 toast() 함수를 사용하므로,
 *      <script> 태그 순서는 app.js -> topnav.js 순서여야 한다.
 * ==================================================
 */

const Topnav = {
  render(){
    const host = document.getElementById('app-topnav');
    if(!host) return; // 로그인 페이지처럼 상단바가 없는 페이지는 조용히 무시

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
  }
};

document.addEventListener('DOMContentLoaded', () => Topnav.render());
