/* ============================================================
   supabaseClient.js — Supabase 클라이언트 초기화 (전역 1개만 생성)
   --------------------------------------------------------------
   로딩 순서가 반드시 아래 순서를 지켜야 합니다:
   1) https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2  (CDN, 전역 window.supabase 제공)
   2) js/config.js                                          (CONFIG.SUPABASE_URL 등)
   3) js/supabaseClient.js                                  (이 파일)
   4) 그 뒤의 모든 스크립트 (app.js, login.js, topnav.js, ...)

   이후 다른 모든 스크립트에서는 window.supabaseClient 로 접근해서
   로그인/회원가입/DB 조회 등을 수행합니다.
   (CDN이 만들어준 window.supabase는 "라이브러리 자체"라서, 우리가 만든
    "연결된 클라이언트 인스턴스"와 이름이 겹치지 않도록 supabaseClient로 구분합니다)
   ============================================================ */
window.supabaseClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
