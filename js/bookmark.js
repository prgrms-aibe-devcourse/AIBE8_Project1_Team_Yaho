/* ============================================================
   bookmark.html - 북마크 (대표 사진 그리드)
   --------------------------------------------------------------
   지금은 API가 없어서 임시(placeholder) 사진으로 채워둔다.
   나중에 진짜 API가 준비되면:
     1) 아래 BOOKMARK_ITEMS 배열을 지우고
     2) fetch(...) 로 받아온 응답에서 "대표 이미지 URL"과 "이동할 링크"를 뽑아
        같은 모양의 배열( [{ id, image, link }, ...] )로 만들어서
        renderBookmarkGrid(그 배열) 을 호출해주면 된다.
   카드는 <a> 태그로 렌더링되어 클릭하면 link로 이동하고,
   사진만 보여주는 라운드(10px) 정사각형 형태로 통일한다.
   ============================================================ */
if(page === 'bookmark'){

  // 임시 데이터: 실제로는 API에서 대표 사진 URL + 이동 링크를 받아오는 구조를 흉내낸 것
  const BOOKMARK_ITEMS = [
    { id: 'b1', image: 'https://picsum.photos/seed/travel-bookmark-1/400/400', link: '#' },
    { id: 'b2', image: 'https://picsum.photos/seed/travel-bookmark-2/400/400', link: '#' },
    { id: 'b3', image: 'https://picsum.photos/seed/travel-bookmark-3/400/400', link: '#' },
    { id: 'b4', image: 'https://picsum.photos/seed/travel-bookmark-4/400/400', link: '#' },
    { id: 'b5', image: 'https://picsum.photos/seed/travel-bookmark-5/400/400', link: '#' },
    { id: 'b6', image: 'https://picsum.photos/seed/travel-bookmark-6/400/400', link: '#' },
    { id: 'b7', image: 'https://picsum.photos/seed/travel-bookmark-7/400/400', link: '#' },
    { id: 'b8', image: 'https://picsum.photos/seed/travel-bookmark-8/400/400', link: '#' },
    { id: 'b9', image: 'https://picsum.photos/seed/travel-bookmark-6/400/400', link: '#' },
    { id: 'b10', image: 'https://picsum.photos/seed/travel-bookmark-7/400/400', link: '#' },
    { id: 'b11', image: 'https://picsum.photos/seed/travel-bookmark-8/400/400', link: '#' },
  ];

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
      // link가 없으면(임시 데이터 등) 클릭해도 아무 데도 안 가도록 '#' + 새로고침 방지
      card.href = item.link || '#';
      if(!item.link || item.link === '#'){
        card.addEventListener('click', (e)=> e.preventDefault());
      }
      card.innerHTML = `<img src="${item.image}" alt="북마크한 장소 사진" loading="lazy">`;
      grid.appendChild(card);
    });
  }

  renderBookmarkGrid(BOOKMARK_ITEMS);
}
