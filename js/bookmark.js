/* ============================================================
   bookmark.html - 북마크 (대표 사진 그리드)
   --------------------------------------------------------------
   detail.html의 "🔖 저장" 버튼을 누르면 detail.js가
   localStorage(BOOKMARK_KEY)에 { id, image, link } 형태로 저장한다.
   이 파일은 그 목록을 그대로 읽어서 그려주기만 한다.
   (detail.js와 키 이름이 정확히 같아야 하므로 'travelBookmarks_v1'을
    임의로 바꾸지 않도록 주의)
   카드를 클릭하면 저장된 link(=detail.html?id=...&type=...)로 이동하고,
   카드 우상단 ✕ 버튼으로 개별 삭제도 가능하다.
   ============================================================ */
/* ============================================================
   헤더 찜(북마크) 버튼 (#btnSaved, topnav.js가 그려줌)
   --------------------------------------------------------------
   모든 페이지에 이 스크립트가 포함되어 있어야 동작한다.
   더 이상 찜한 개수를 세지 않는다 — 그냥 "로그인 상태면
   마이페이지의 북마크 탭(bookmark.html)으로 이동"하는 바로가기 버튼.
   비로그인 상태면 토스트로 로그인 안내만 띄운다.
   ============================================================ */
(function(){
  const btn = document.getElementById('btnSaved');
  if(!btn) return; // 헤더가 없는 페이지에서는 조용히 무시

  // 외곽선 색으로 아이콘을 채워서 보여준다 (icon-btn.is-on .ico { fill: currentColor })
  btn.classList.add('is-on');

  function isLoggedIn(){
    try{ return localStorage.getItem('isLoggedIn') === 'true'; }
    catch(e){ return false; }
  }

  // app.js의 전역 toast()가 없는 페이지(index.html)에서도 동작하도록 자체 구현
  function headerToast(msg){
    let el = document.getElementById('toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show', 'is-on');
    clearTimeout(headerToast._t);
    headerToast._t = setTimeout(()=> el.classList.remove('show', 'is-on'), 2200);
  }

  btn.addEventListener('click', () => {
    if(isLoggedIn()) location.href = 'bookmark.html';
    else headerToast('로그인이 필요합니다');
  });
})();

if(typeof page !== 'undefined' && page === 'bookmark'){

  const BOOKMARK_KEY = 'travelBookmarks_v1';

  function getBookmarks(){
    try{
      const raw = localStorage.getItem(BOOKMARK_KEY);
      return raw ? JSON.parse(raw) : [];
    }catch(e){ return []; }
  }

  function setBookmarks(list){
    try{ localStorage.setItem(BOOKMARK_KEY, JSON.stringify(list)); }
    catch(e){ /* 저장 실패는 무시 */ }
  }

  function removeBookmark(id){
    setBookmarks(getBookmarks().filter(b => String(b.id) !== String(id)));
    renderBookmarkGrid(getBookmarks());
    toast('북마크에서 제거했습니다');
  }

  function renderBookmarkGrid(items){
    const grid = document.getElementById('bookmark-grid');
    const empty = document.getElementById('bookmark-empty');
    grid.innerHTML = '';

    if(!items.length){
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    items.forEach(item=>{
      const card = document.createElement('a');
      card.className = 'bookmark-card';
      card.href = item.link || '#';
      card.style.position = 'relative';
      card.innerHTML = `
        <img src="${item.image}" alt="${item.name || '북마크한 장소'} 사진" loading="lazy">
        <span class="bookmark-card__name">${item.name || ''}</span>
        <button type="button" class="bookmark-remove-btn" title="북마크 삭제"
          style="position:absolute; top:6px; right:6px; width:24px; height:24px;
                 border-radius:50%; background:rgba(0,0,0,0.55); color:#fff;
                 font-size:13px; line-height:1; border:none; cursor:pointer;
                 display:flex; align-items:center; justify-content:center;">✕</button>
      `;
      card.querySelector('.bookmark-remove-btn').addEventListener('click', (e)=>{
        e.preventDefault();   // <a> 이동 막기
        e.stopPropagation();
        removeBookmark(item.id);
      });
      grid.appendChild(card);
    });
  }

  renderBookmarkGrid(getBookmarks());
}
