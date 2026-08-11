/* ============================================================
   register.js — register.html 전용 (회원가입 폼 처리)
   --------------------------------------------------------------
   app.js가 먼저 로드되어 정의해두는 getAccounts/saveAccounts/
   findAccountByEmail 을 그대로 사용합니다.
   그래서 <script> 순서는 반드시 app.js -> register.js 여야 합니다.
   ============================================================ */
if(page === 'register'){
  on('register-form', 'submit', (e)=>{
    e.preventDefault();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;

    if(!name){ alert('닉네임을 입력해주세요.'); return; }
    if(!email){ alert('이메일을 입력해주세요.'); return; }
    if(!password || password.length < 4){ alert('비밀번호는 4자 이상 입력해주세요.'); return; }
    if(findAccountByEmail(email)){ alert('이미 가입된 이메일입니다.'); return; }

    const accounts = getAccounts();
    accounts.push({ id: 'u' + Date.now(), name, email, password });
    saveAccounts(accounts);

    alert('가입이 완료되었습니다. 로그인해주세요.');
    location.href = 'login.html';
  });
}
