/* ============================================================
   login.js — login.html 전용 (로그인 폼 처리)
   --------------------------------------------------------------
   Supabase Auth(signInWithPassword)로 로그인합니다.
   로그인에 성공하면 js/authState.js가 'wtg:auth-changed'를 자동으로
   발생시켜서 topnav.js의 로그인 버튼 라벨 등이 알아서 갱신됩니다.

   app.js가 먼저 로드되어 정의해두는 toast, on 을 그대로 사용하고,
   window.supabaseClient(js/supabaseClient.js)도 필요합니다.
   그래서 <script> 순서는 반드시
   supabaseClient.js -> authState.js -> app.js -> login.js 여야 합니다.
   ============================================================ */
if(page === 'login'){
  on('login-form', 'submit', async (e)=>{
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

    if (submitBtn) submitBtn.disabled = false;

    if (error) {
      alert('이메일 또는 비밀번호가 일치하지 않습니다.');
      return;
    }

    toast('로그인 되었습니다');

    // index.html에서 "로그인" 버튼을 눌러 넘어온 경우, 로그인 후 원래
    // 있던 페이지로 되돌아간다. 그 값이 없으면(=마이페이지 쪽 흐름) 기존처럼
    // mypage.html로 이동한다.
    var redirectTo = null;
    try{
      redirectTo = sessionStorage.getItem('postLoginRedirect');
      if(redirectTo) sessionStorage.removeItem('postLoginRedirect');
    }catch(err){ /* 무시 */ }

    setTimeout(()=>{ window.location.href = redirectTo || 'mypage.html'; }, 300);
  });
}
