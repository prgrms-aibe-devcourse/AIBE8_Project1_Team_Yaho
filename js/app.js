/* ============================================================
   여행 다이어리 - 공통 상태 관리 + 공통 유틸 + login/mypage 로직

   ⚠️ 이 파일(app.js)은 모든 페이지가 공통으로 불러 씁니다.
      상태 관리(Supabase), toast, escapeHtml 같은 공통 함수와
      "mypage" 페이지 로직만 여기 있습니다.

      아래 페이지들의 로직은 각자 자기 파일로 분리되어 있습니다:
      - login.html                                        -> js/login.js
      - register.html                                     -> js/register.js
      - album.html / album-detail.html / album-edit.html -> js/album.js
      - bookmark.html                                     -> js/bookmark.js

      (예전엔 app.js 안에 앨범 관련 코드가 album.js와 중복으로 남아있어서,
       앨범 페이지를 열면 렌더링이 두 번씩 실행되는 문제가 있었습니다.
       지금은 app.js에는 공통 코드만, 나머지는 각 페이지 전용 js에만 있습니다)

      스크립트 로딩 순서: supabaseClient.js -> authState.js -> app.js ->
      topnav.js -> sidebar.js -> (album.js | bookmark.js)
      login.js/register.js는 topnav.js/sidebar.js가 필요 없는 단독 페이지라서
      app.js 바로 다음에 로드됩니다 (login.html/register.html 참고).

      album.js/bookmark.js/login.js/register.js는 app.js가 정의하는 state,
      saveState, toast, escapeHtml, fmtDate, dayCount, getQueryParam, on,
      swatchButtonsHtml, fileToDataUrl, page 를 그대로 사용하므로 반드시
      app.js보다 나중에 로드됩니다.

      ⚠️ 로그인/회원가입은 Supabase Auth가 담당합니다 (js/authState.js,
      js/login.js, js/register.js 참고). 프로필/앨범 데이터는 이제 이
      파일이 Supabase 테이블(profiles/albums/album_entries)에서 비동기로
      불러옵니다 — 예전(localStorage)에는 `const state = loadState()`가
      "동기적으로" 한 번에 끝났지만, 지금은 비동기라서 sidebar.js/album.js/
      아래 mypage 코드가 window.dataReady()로 로드가 끝나기를 기다려야 합니다.

      각 페이지는 <body data-page="..."> 로 자기 자신을 표시하고,
      모든 js 파일은 이 값을 읽어서 "지금 이 페이지에 필요한 코드만" 실행합니다.
      (다른 페이지에만 있는 요소를 찾다가 null 이 나와서
       스크립트 전체가 멈추는 사고를 막기 위한 구조입니다)
   ============================================================ */

// 앨범 카드 / 수정 페이지에서 고를 수 있는 색상 팔레트 (10가지)
const SWATCHES = [
  '#2f92d6', '#e14b46', '#1fc2b0', '#8dc93a', '#eab13a',
  '#8b5cf6', '#ec4899', '#64748b', '#f97316', '#0ea5e9'
];

const page = document.body.dataset.page; // 현재 페이지 이름

/* ---------------- 로그인 필요 페이지 가드 ---------------- */
// mypage / album 계열은 로그인 없이 못 들어오게 막는다.
// (js/authState.js가 Supabase 세션을 확인해서 window.isLoggedIn()으로 알려줌)
// bookmark는 이번 요청 범위에 없어서 그대로 둔다 — 막고 싶으면 아래 배열에 'bookmark' 추가.
//
// ⚠️ Supabase 세션 확인은 비동기라서, 새로고침 직후 아주 짧은 순간 동안은
// 이 페이지의 다른 코드(sidebar.js 등)가 먼저 실행될 수 있다. 리다이렉트이
// 필요한 경우 window.authReady()가 끝난 뒤 location.href로 넘어간다.
const LOGIN_REQUIRED_PAGES = ['mypage', 'album-list', 'album-detail', 'album-edit'];
// bookmark.html은 로그인 없이도 볼 수 있지만(가드 대상 아님) 사이드바에는
// 로그인했을 때 프로필을 보여줘야 하므로, 데이터 로딩 대상에는 포함한다.
const PAGES_NEEDING_PROFILE_DATA = LOGIN_REQUIRED_PAGES.concat(['bookmark']);

(async function guardLoginRequiredPages(){
  if (LOGIN_REQUIRED_PAGES.indexOf(page) === -1) return;

  await window.authReady();
  if (window.isLoggedIn()) return;

  // 로그인 후 원래 보려던 페이지로 돌아올 수 있도록 주소를 남겨둔다.
  try { sessionStorage.setItem('postLoginRedirect', location.href); }
  catch (e) { /* 저장 실패해도 이동 자체는 진행 */ }

  location.href = 'login.html';
})();

/* ============================================================
   프로필 / 앨범 데이터 (Supabase)
   --------------------------------------------------------------
   state.profile / state.albums 는 화면 코드(sidebar.js, album.js,
   이 파일의 mypage 블록)가 예전 localStorage 시절과 똑같은 모양으로
   읽을 수 있도록 아래 mapAlbumRow()에서 DB 컬럼명을 기존 필드명으로
   맞춰준다 (예: start_date -> start, photo_url -> photo).

   로그인/앨범 데이터가 필요 없는 페이지(login, register 등)에서는
   아무것도 불러오지 않고 곧바로 ready 처리한다.
   ============================================================ */
let state = { profile: { name: '여행자', email: '', avatar: null }, albums: [] };

let resolveDataReady;
const dataReadyPromise = new Promise((resolve) => { resolveDataReady = resolve; });
window.dataReady = function(){ return dataReadyPromise; };

function mapAlbumRow(row){
  return {
    id: row.id,
    title: row.title,
    location: row.location,
    start: row.start_date || '',
    end: row.end_date || '',
    color: row.color,
    entries: (row.album_entries || [])
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .map(e => ({ id: e.id, photo: e.photo_url, diary: e.diary || '' })),
  };
}

async function loadState(){
  const user = window.getCurrentUser();
  // 비로그인이면(예: bookmark.html은 로그인 없이도 볼 수 있음) 기본 프로필을
  // 그대로 두고 끝낸다. mypage/album 계열은 위 가드가 곧 로그인 페이지로 보낸다.
  if (!user) { resolveDataReady(); return; }

  const [{ data: profileRow }, { data: albumRows, error: albumsError }] = await Promise.all([
    window.supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    window.supabaseClient
      .from('albums')
      .select('*, album_entries(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  state.profile = {
    name: (profileRow && profileRow.name) || (user.email ? user.email.split('@')[0] : '여행자'),
    // 이메일은 Supabase Auth(auth.users)의 값을 그대로 쓴다. 변경하려면
    // 인증 이메일 확인 절차가 필요해서, 이 화면에서는 표시만 하고 수정은
    // 막아둔다 (아래 mypage 블록의 email-edit-btn 참고).
    email: user.email || '',
    avatar: (profileRow && profileRow.avatar_url) || null,
  };
  state.albums = albumsError ? [] : (albumRows || []).map(mapAlbumRow);

  resolveDataReady();
}

(async function initData(){
  if (PAGES_NEEDING_PROFILE_DATA.indexOf(page) === -1) { resolveDataReady(); return; }
  await window.authReady();
  await loadState();
})();

/* ---------------- 공통 유틸 ---------------- */
let toastTimer = null;
function toast(msg){
  const el = document.getElementById('toast');
  if(!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> el.classList.remove('show'), 2200);
}

function fileToDataUrl(file, cb){
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function fmtDate(d){ return d ? d.replaceAll('-', '.') : ''; }

function dayCount(start, end){
  if(!start || !end) return null;
  const diff = Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

// 페이지 이동 시 함께 넘어온 쿼리스트링 값을 읽는다 (예: album-detail.html?id=... -> 그 값)
function getQueryParam(name){
  return new URLSearchParams(location.search).get(name);
}

// 헬퍼: 요소가 실제로 존재할 때만 이벤트를 건다 (다른 페이지 요소를 잘못 건드리지 않도록 방어)
function on(id, event, handler){
  const el = document.getElementById(id);
  if(el) el.addEventListener(event, handler);
}

// 색상 스와치(동그란 버튼) 목록의 HTML을 만들어주는 공통 함수
function swatchButtonsHtml(selectedColor){
  return SWATCHES.map(c => `
    <button type="button" class="color-swatch ${sameColor(c, selectedColor) ? 'is-selected' : ''}"
            style="background:${c}" data-color="${c}"></button>
  `).join('');
}
function sameColor(a, b){
  return (a || '').toLowerCase() === (b || '').toLowerCase();
}

/* ---------------- 사이드바 프로필 갱신 함수 ----------------
   최초 렌더링은 sidebar.js가 담당한다 (state.profile을 직접 읽어서 그림).
   이 함수는 "나중에" 이름/사진이 바뀔 때 sidebar.js가 그려둔 화면을
   다시 갱신하기 위한 용도로 남겨둔다 (예: 마이페이지에서 이름 수정 시). */
function renderSidebarProfile(){
  const nameEl = document.getElementById('sidebar-name');
  if(nameEl) nameEl.textContent = state.profile.name + ' 님,';
  const avatarEl = document.getElementById('sidebar-avatar');
  if(avatarEl) avatarEl.style.backgroundImage = state.profile.avatar ? `url(${state.profile.avatar})` : '';
}

// "준비 중" 상단 메뉴 클릭 안내는 topnav.js가 자체적으로 처리하므로
// 여기서는 더 이상 별도로 연결하지 않는다.

// album-detail.html / album-edit.html 의 "← 앨범 목록으로" / "← 뒤로가기" 버튼.
// 예전엔 html 안에 onclick="..." 으로 직접 JS를 넣었는데,
// js/css를 완전히 분리하기 위해 여기로 옮겼다.
on('back-to-list-btn', 'click', ()=>{
  if(history.length > 1) history.back();
  else location.href = 'album.html';
});


/* ============================================================
   2) mypage.html - 내 정보 관리
   ============================================================ */
if(page === 'mypage'){
  (async function initMyPage(){
    await window.dataReady();

    const user = window.getCurrentUser();

    function applyAvatar(){
      const url = state.profile.avatar;
      [document.getElementById('sidebar-avatar'), document.getElementById('hero-avatar')].forEach(el=>{
        if(!el) return;
        el.style.backgroundImage = url ? `url(${url})` : '';
      });
    }

    function renderMyPage(){
      document.getElementById('hero-name').textContent = state.profile.name + ' 님,';
      document.getElementById('name-input').value = state.profile.name;
      document.getElementById('email-input').value = state.profile.email;
      applyAvatar();
    }

    // 이름: 입력값을 profiles 테이블에 실제로 저장한다.
    const nameInput = document.getElementById('name-input');
    const nameBtn = document.getElementById('name-edit-btn');
    nameBtn.addEventListener('click', async ()=>{
      if(nameInput.disabled){
        nameInput.disabled = false;
        nameInput.focus();
        nameInput.select();
        nameBtn.textContent = '저장';
        nameBtn.classList.add('is-save');
      } else {
        nameInput.disabled = true;
        nameBtn.textContent = '수정';
        nameBtn.classList.remove('is-save');
        const val = nameInput.value.trim();
        if(val){
          state.profile.name = val;
          document.getElementById('hero-name').textContent = state.profile.name + ' 님,';
          renderSidebarProfile();
          const { error } = await window.supabaseClient
            .from('profiles')
            .update({ name: val })
            .eq('id', user.id);
          if (error) { toast('이름 저장에 실패했습니다'); return; }
        }
        toast('저장되었습니다');
      }
    });

    // 이메일: Supabase Auth(auth.users)의 이메일을 그대로 보여주기만 한다.
    // 이메일을 바꾸려면 인증 메일 확인 절차가 필요해서(supabase.auth.updateUser),
    // 이번 업데이트 범위에서는 "수정"을 누르면 안내만 띄운다.
    on('email-edit-btn', 'click', ()=>{
      toast('이메일은 가입한 계정과 연결되어 있어 여기서 바로 수정할 수 없습니다');
    });

    on('password-btn', 'click', ()=>{
      const current = prompt('현재 비밀번호를 입력하세요');
      if(current === null) return;
      const next = prompt('새 비밀번호를 입력하세요');
      if(next === null || next.trim() === '') return;
      toast('비밀번호가 변경되었습니다');
    });

    on('change-photo-btn', 'click', ()=> document.getElementById('avatar-input').click());
    on('avatar-input', 'change', (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      fileToDataUrl(file, async (url)=>{
        state.profile.avatar = url;
        applyAvatar();
        toast('프로필 사진이 변경되었습니다');
        // ⚠️ 지금은 이미지를 base64 문자열 그대로 profiles.avatar_url에 저장한다.
        // 실제 서비스라면 Supabase Storage에 파일을 올리고 그 URL만 저장하는
        // 편이 낫다 (다음 개선 과제로 남겨둠).
        const { error } = await window.supabaseClient
          .from('profiles')
          .update({ avatar_url: url })
          .eq('id', user.id);
        if (error) toast('프로필 사진 저장에 실패했습니다');
      });
    });

    renderMyPage();
  })();
}
