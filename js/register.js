/* ============================================================
   register.js — register.html 전용 (회원가입 폼 처리)
   --------------------------------------------------------------
   Supabase Auth(signUp)로 회원가입합니다. 가입한 이메일/이름은
   auth.users(id, email)로 들어가고, DB에 만들어둔
   on_auth_user_created 트리거가 그 즉시 profiles 테이블에
   { id, name } 행을 자동으로 하나 만들어줍니다(공홈 SQL Editor에서
   실행한 handle_new_user() 함수).

   ⚠️ Supabase 프로젝트의 Authentication > Providers > Email 설정에서
   "Confirm email"이 켜져 있으면, 가입 직후 이메일 인증 전까지는
   로그인 세션이 생기지 않습니다(data.session === null). 아래 코드는
   두 경우(즉시 로그인 / 이메일 인증 필요) 모두를 처리합니다.

   app.js가 먼저 로드되어 정의해두는 on 을 그대로 사용하고,
   window.supabaseClient(js/supabaseClient.js)도 필요합니다.
   그래서 <script> 순서는 반드시
   supabaseClient.js -> authState.js -> app.js -> register.js 여야 합니다.
   ============================================================ */
if(page === 'register'){
  on('register-form', 'submit', async (e)=>{
    e.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    if(!name){ alert('닉네임을 입력해주세요.'); return; }
    if(!email){ alert('이메일을 입력해주세요.'); return; }
    if(!password || password.length < 4){ alert('비밀번호는 4자 이상 입력해주세요.'); return; }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const { data, error } = await window.supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { name } } // profiles 테이블 트리거가 이 값을 이름으로 사용
    });

    if (submitBtn) submitBtn.disabled = false;

    if (error) {
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        alert('이미 가입된 이메일입니다.');
      } else {
        alert('회원가입에 실패했습니다: ' + error.message);
      }
      return;
    }

    if (data.session) {
      // "Confirm email"이 꺼져 있으면 가입 즉시 로그인 상태가 됨
      alert('가입이 완료되었습니다.');
      location.href = 'mypage.html';
    } else {
      // "Confirm email"이 켜져 있으면 이메일 인증 전까지 세션이 생기지 않음
      alert('가입이 완료되었습니다. 이메일의 인증 링크를 확인한 뒤 로그인해주세요.');
      location.href = 'login.html';
    }
  });
}
