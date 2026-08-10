/* ============================================================
   여행 다이어리 - 공통 상태 관리 + 공통 유틸 + login/mypage 로직

   ⚠️ 이 파일(app.js)은 모든 페이지가 공통으로 불러 씁니다.
      상태 관리(localStorage), toast, escapeHtml 같은 공통 함수와
      "login"/"mypage" 페이지 로직만 여기 있습니다.

      아래 페이지들의 로직은 각자 자기 파일로 분리되어 있습니다:
      - album.html / album-detail.html / album-edit.html -> js/album.js
      - bookmark.html                                     -> js/bookmark.js

      (예전엔 app.js 안에 앨범 관련 코드가 album.js와 중복으로 남아있어서,
       앨범 페이지를 열면 렌더링이 두 번씩 실행되는 문제가 있었습니다.
       지금은 app.js에는 공통 코드만, 나머지는 각 페이지 전용 js에만 있습니다)

      스크립트 로딩 순서: app.js -> topnav.js -> sidebar.js -> (album.js | bookmark.js)
      album.js/bookmark.js는 app.js가 정의하는 state, saveState, toast,
      escapeHtml, fmtDate, dayCount, getQueryParam, on, swatchButtonsHtml,
      fileToDataUrl, page 를 그대로 사용하므로 반드시 app.js보다 나중에 로드됩니다.

      각 페이지는 <body data-page="..."> 로 자기 자신을 표시하고,
      모든 js 파일은 이 값을 읽어서 "지금 이 페이지에 필요한 코드만" 실행합니다.
      (다른 페이지에만 있는 요소를 찾다가 null 이 나와서
       스크립트 전체가 멈추는 사고를 막기 위한 구조입니다)
   ============================================================ */

const STORAGE_KEY = 'travelDiaryState_v1';

// 앨범 카드 / 수정 페이지에서 고를 수 있는 색상 팔레트 (10가지)
const SWATCHES = [
  '#2f92d6', '#e14b46', '#1fc2b0', '#8dc93a', '#eab13a',
  '#8b5cf6', '#ec4899', '#64748b', '#f97316', '#0ea5e9'
];

const page = document.body.dataset.page; // 현재 페이지 이름

/* ---------------- 초기 시드 데이터 ---------------- */
function seedState(){
  return {
    profile: { name: '여행자', email: 'traveler@gmail.com', avatar: null },
    albums: [
      {
        id: 'a1',
        title: '강릉 바다 여행',
        location: '강원도 강릉',
        start: '2026-08-07',
        end: '2026-08-10',
        color: SWATCHES[0],
        entries: [
          {
            id: 'e1',
            photo: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=80',
            diary: '푸른 바다와 커피 향이 가득한 낭만 도시 강릉으로 떠났다. 경포대 해변에서 맞이한 일출은 정말 잊을 수 없는 순간이었고, 강릉 중앙시장에서 먹은 감자옹심이는 너무 맛있었다. 안목 해변 카페 거리에서 커피 한 잔 마시며 바다를 바라보는 그 여유로움이 아직도 생생하다.'
          },
          {
            id: 'e2',
            photo: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&q=80',
            diary: '맛있는 저녁 연어 스테이크의 부드러움. 웨이팅 5시간의 보람이 있던 식사였다.\n나중에 도랑의 등파육도 웨이팅해서 먹어봐야지'
          }
        ]
      },
      { id: 'a2', title: '제주 한달 살기', location: '제주도', start: '2026-10-01', end: '2026-10-31', color: SWATCHES[1], entries: [] },
      { id: 'a3', title: '부산 광안리 주말 여행', location: '부산 광안리', start: '2026-11-07', end: '2026-11-08', color: SWATCHES[2], entries: [] },
      { id: 'a4', title: '전주 한옥마을 투어', location: '전주 한옥마을', start: '2026-11-18', end: '2026-11-24', color: SWATCHES[3], entries: [] },
      { id: 'a5', title: '서울 당일치기 여행', location: '서울', start: '2026-12-25', end: '2026-12-25', color: SWATCHES[4], entries: [] }
    ]
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.warn('state load failed', e); }
  const seeded = seedState();
  saveState(seeded);
  return seeded;
}
function saveState(s){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  catch(e){ console.warn('state save failed', e); }
}

const state = loadState();

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

// 페이지 이동 시 함께 넘어온 쿼리스트링 값을 읽는다 (예: album-detail.html?id=a1 -> "a1")
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
   1) login.html
   ============================================================ */
if(page === 'login'){
  on('login-form', 'submit', (e)=>{
    e.preventDefault();
    toast('로그인 되었습니다');
    setTimeout(()=>{ window.location.href = 'mypage.html'; }, 300);
  });
}


/* ============================================================
   2) mypage.html - 내 정보 관리
   ============================================================ */
if(page === 'mypage'){

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

  function wireEditableField(inputId, editBtnId, onSave){
    const input = document.getElementById(inputId);
    const btn = document.getElementById(editBtnId);
    btn.addEventListener('click', ()=>{
      if(input.disabled){
        input.disabled = false;
        input.focus();
        input.select();
        btn.textContent = '저장';
        btn.classList.add('is-save');
      } else {
        input.disabled = true;
        btn.textContent = '수정';
        btn.classList.remove('is-save');
        onSave(input.value.trim());
        saveState(state);
        toast('저장되었습니다');
      }
    });
  }

  wireEditableField('name-input', 'name-edit-btn', (val)=>{
    if(val) state.profile.name = val;
    document.getElementById('hero-name').textContent = state.profile.name + ' 님,';
    renderSidebarProfile();
  });
  wireEditableField('email-input', 'email-edit-btn', (val)=>{
    if(val) state.profile.email = val;
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
    fileToDataUrl(file, (url)=>{
      state.profile.avatar = url;
      saveState(state);
      applyAvatar();
      toast('프로필 사진이 변경되었습니다');
    });
  });

  renderMyPage();
}
