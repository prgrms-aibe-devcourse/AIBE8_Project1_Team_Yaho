/* ============================================================
   login.js — login.html 전용 (로그인 폼 처리)
   --------------------------------------------------------------
   app.js가 먼저 로드되어 정의해두는 state, saveState, toast, on,
   getAccounts/saveAccounts/findAccountByEmail 을 그대로 사용합니다.
   그래서 <script> 순서는 반드시 app.js -> login.js 여야 합니다.
   ============================================================ */
if(page === 'login'){
  on('login-form', 'submit', (e)=>{
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const account = findAccountByEmail(email);
    if(!account){
      alert('가입되지 않은 이메일입니다.');
      return;
    }
    if(account.password !== password){
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }

    // index.html의 헤더(js/topnav.js)가 "로그인/로그아웃" 버튼 라벨을
    // 판단하는 데 쓰는 공통 플래그. 여기서 로그인 성공 시 켜준다.
    try{ localStorage.setItem('isLoggedIn', 'true'); }catch(err){ /* 무시 */ }

    // 로그인한 계정 정보를 마이페이지에서 보는 프로필에도 반영해준다.
    state.profile.name = account.name;
    state.profile.email = account.email;
    saveState(state);

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
