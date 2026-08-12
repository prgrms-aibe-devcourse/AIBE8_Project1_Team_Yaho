/* ============================================================
   authState.js — Supabase 로그인 상태를 앱 전역에서 "동기적으로" 쓰기 위한 캐시
   --------------------------------------------------------------
   supabaseClient.auth.getSession()은 Promise라서, 예전처럼
   `localStorage.getItem('isLoggedIn') === 'true'`처럼 한 줄로 즉시
   값을 읽을 수 없습니다. 그래서 세션 정보를 한 번 비동기로 받아온 뒤
   메모리에 캐시해두고, 이후에는 다른 스크립트(app.js, topnav.js,
   bookmark.js, main.js ...)가 아래 전역 함수들로 "동기적으로" 꺼내
   쓸 수 있게 만들어주는 파일입니다.

   window.isLoggedIn()     : boolean, 지금까지 확인된 로그인 여부
   window.getCurrentUser() : 로그인 안 했으면 null, 했으면 Supabase user 객체
   window.authReady()      : Promise, 새로고침 시 "기존 세션이 있는지"
                              최초 확인이 끝날 때까지 기다려야 하는 코드
                              (로그인 필요 페이지 가드 등)에서 사용
   'wtg:auth-changed' 이벤트 : 로그인/로그아웃/토큰 갱신 등 상태가
                              바뀔 때마다 window에 발생 (예전의
                              'wtg:login-changed'를 대체)

   로딩 순서: supabase-js CDN -> config.js -> supabaseClient.js
              -> authState.js (이 파일) -> app.js/topnav.js/bookmark.js/...
   ============================================================ */
(function () {
  const state = {
    user: null,    // 로그인 안 했으면 null
    ready: false,  // 최초 세션 확인이 끝났는지
  };

  let resolveReady;
  const readyPromise = new Promise((resolve) => { resolveReady = resolve; });

  function applySession(session) {
    state.user = session ? session.user : null;
    if (!state.ready) {
      state.ready = true;
      resolveReady();
    }
    window.dispatchEvent(new CustomEvent('wtg:auth-changed', { detail: { user: state.user } }));
  }

  // 최초 세션 로드: 새로고침해도 supabase-js가 자체적으로 localStorage에
  // 저장해둔 세션을 복원해서 알려준다.
  window.supabaseClient.auth.getSession().then(({ data }) => applySession(data.session));

  // 이후 로그인/로그아웃/토큰 갱신 등이 생길 때마다 자동으로 다시 호출됨
  window.supabaseClient.auth.onAuthStateChange((_event, session) => applySession(session));

  window.authState = state;
  window.isLoggedIn = function () { return !!state.user; };
  window.getCurrentUser = function () { return state.user; };
  window.authReady = function () { return readyPromise; };
})();
