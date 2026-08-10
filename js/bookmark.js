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
if(page === 'bookmark'){

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
        <img src="${item.image}" alt="북마크한 장소 사진" loading="lazy">
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
