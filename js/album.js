/* ============================================================
   3) album.html - 여행 앨범 목록 (+ 카드별 색상 선택)
   ============================================================ */
if(page === 'album-list'){

  function closeAllColorPopovers(){
    document.querySelectorAll('.color-popover').forEach(p => p.hidden = true);
  }
  // 팝오버 바깥을 클릭하면 항상 닫히도록. 색상 버튼 클릭은 stopPropagation 되어있어
  // 여기로 전파되지 않으므로 "열자마자 바로 닫히는" 문제는 생기지 않는다.
  document.addEventListener('click', closeAllColorPopovers);

  function renderAlbumGrid(){
    const grid = document.getElementById('album-grid');
    const empty = document.getElementById('album-empty');
    grid.innerHTML = '';

    if(state.albums.length === 0){
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    state.albums.forEach(album=>{
      const wrap = document.createElement('div');
      wrap.className = 'album-card-wrap';
      wrap.innerHTML = `
        <div class="album-card">
          <button type="button" class="album-color-btn" title="색상 변경" style="background:${album.color}"></button>
          <button type="button" class="album-delete-x" title="앨범 삭제">✕</button>
          <div class="album-band-top" style="background:${album.color}"></div>
          <div class="album-band-mid">
            <div class="album-planner-title">Travel Planner</div>
            <div class="album-planner-sub">${escapeHtml(album.title)}</div>
          </div>
          <div class="album-band-bot" style="background:${album.color}"></div>
        </div>
        <div class="album-date-caption">${fmtDate(album.start)} ~${fmtDate(album.end)}</div>

        <div class="color-popover pos-below" hidden>
          ${swatchButtonsHtml(album.color)}
          <div class="custom-color-wrap">
            <input type="color" value="${album.color}">
            <span>직접 선택</span>
          </div>
        </div>
      `;

      const cardEl = wrap.querySelector('.album-card');
      const popoverEl = wrap.querySelector('.color-popover');
      const colorBtn = wrap.querySelector('.album-color-btn');
      const deleteBtn = wrap.querySelector('.album-delete-x');
      const customColorInput = wrap.querySelector('input[type="color"]');

      // 카드 클릭 -> 상세 페이지로 실제 이동 (다른 버튼을 눌렀을 때는 제외)
      cardEl.addEventListener('click', (e)=>{
        if(e.target.closest('.album-delete-x') || e.target.closest('.album-color-btn') || e.target.closest('.color-popover')) return;
        location.href = `album-detail.html?id=${album.id}`;
      });

      // 색상 버튼 -> 팝오버 열기/닫기
      colorBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        const willOpen = popoverEl.hidden;
        closeAllColorPopovers();
        popoverEl.hidden = !willOpen;
      });

      // 프리셋 색상 스와치 클릭
      popoverEl.querySelectorAll('.color-swatch').forEach(sw=>{
        sw.addEventListener('click', (e)=>{
          e.stopPropagation();
          album.color = sw.dataset.color;
          saveState(state);
          renderAlbumGrid();
          toast('색상이 변경되었습니다');
        });
      });

      // 커스텀 색상(input[type=color]) 선택
      customColorInput.addEventListener('input', (e)=>{
        e.stopPropagation();
        album.color = e.target.value;
        // 드래그 중에도 바로 반영되도록 색을 즉시 갱신 (전체 다시 그리기는 change 시점에만)
        wrap.querySelectorAll('.album-band-top, .album-band-bot').forEach(b => b.style.background = album.color);
        colorBtn.style.background = album.color;
      });
      customColorInput.addEventListener('change', ()=>{
        saveState(state);
        toast('색상이 변경되었습니다');
        closeAllColorPopovers();
      });

      // 앨범 삭제
      deleteBtn.addEventListener('click', (e)=>{
        e.stopPropagation();
        if(confirm(`"${album.title}" 앨범을 삭제할까요?`)){
          state.albums = state.albums.filter(a => a.id !== album.id);
          saveState(state);
          renderAlbumGrid();
          toast('앨범이 삭제되었습니다');
        }
      });

      grid.appendChild(wrap);
    });
  }

  renderAlbumGrid();
}


/* ============================================================
   4) album-detail.html - 앨범 상세 (읽기 전용, 삭제 버튼 없음)
   ============================================================ */
if(page === 'album-detail'){

  const albumId = getQueryParam('id');
  const album = state.albums.find(a => a.id === albumId);

  if(!album){
    // 잘못된 id로 들어왔으면 목록으로 돌려보낸다
    location.href = 'album.html';
  } else {
    document.getElementById('detail-title').textContent = album.title;

    const days = dayCount(album.start, album.end);
    document.getElementById('detail-days').textContent = days ? `${days}일 여행` : '일정 미정';

    const today = new Date().toISOString().slice(0, 10);
    const stampEl = document.getElementById('detail-stamp');
    const isDone = album.end && album.end < today;
    stampEl.textContent = isDone ? 'COMPLETED' : 'IN PROGRESS';
    stampEl.classList.toggle('in-progress', !isDone);

    // 수정 버튼은 현재 앨범 id를 붙여서 album-edit.html 로 연결
    document.getElementById('detail-edit-link').href = `album-edit.html?id=${album.id}`;

    const list = document.getElementById('entries-list');
    const emptyMsg = document.getElementById('entries-empty');
    list.innerHTML = '';

    if(!album.entries.length){
      emptyMsg.hidden = false;
    } else {
      emptyMsg.hidden = true;
      album.entries.forEach((entry, idx)=>{
        const row = document.createElement('div');
        row.className = 'entry-row';

        const metaCardHtml = idx === 0 ? `
          <div class="meta-card">
            <div class="loc">${escapeHtml(album.location || '위치 미정')}</div>
            <div class="date-line">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>
              ${fmtDate(album.start)} ~ ${fmtDate(album.end)}
            </div>
          </div>
        ` : '';

        // 읽기 전용: 삭제 버튼 없음
        row.innerHTML = `
          <div class="entry-photo">
            ${entry.photo ? `<img src="${entry.photo}" alt="여행 사진">` : ''}
          </div>
          <div class="entry-right-col">
            ${metaCardHtml}
            <div class="diary-card">
              <span class="diary-title">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                여행 일기
              </span>
              <p>${escapeHtml(entry.diary || '작성된 일기가 없어요.')}</p>
            </div>
          </div>
        `;
        list.appendChild(row);
      });
    }
  }
}


/* ============================================================
   5) album-edit.html - 새 앨범 만들기 / 기존 앨범 수정·삭제
      (?id=xxx 가 있으면 수정 모드, 없으면 생성 모드)
   ============================================================ */
if(page === 'album-edit'){

  const editId = getQueryParam('id');
  let editingAlbum = editId ? state.albums.find(a => a.id === editId) : null;
  let editSelectedColor = editingAlbum ? editingAlbum.color : SWATCHES[state.albums.length % SWATCHES.length];
  let editDraftPhoto = null;

  function enterEditMode(){
    document.getElementById('edit-page-title').textContent = '앨범 수정하기';
    document.getElementById('existing-entries-block').hidden = false;
    document.getElementById('edit-delete-album-btn').hidden = false;
  }

  if(editingAlbum){
    document.getElementById('edit-title').value = editingAlbum.title;
    document.getElementById('edit-date-start').value = editingAlbum.start || '';
    document.getElementById('edit-date-end').value = editingAlbum.end || '';
    document.getElementById('edit-location').value = editingAlbum.location || '';
    enterEditMode();
  }

  /* ---------------- 색상 선택 ---------------- */
  function renderEditColorSwatches(){
    const box = document.getElementById('edit-color-swatches');
    box.innerHTML = swatchButtonsHtml(editSelectedColor) + `
      <div class="custom-color-wrap">
        <input type="color" id="edit-custom-color" value="${editSelectedColor}">
        <span>직접 선택</span>
      </div>
    `;
    box.querySelectorAll('.color-swatch').forEach(sw=>{
      sw.addEventListener('click', ()=>{
        editSelectedColor = sw.dataset.color;
        box.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-selected'));
        sw.classList.add('is-selected');
        document.getElementById('edit-custom-color').value = editSelectedColor;
      });
    });
    document.getElementById('edit-custom-color').addEventListener('input', (e)=>{
      editSelectedColor = e.target.value;
      box.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-selected'));
    });
  }
  renderEditColorSwatches();

  /* ---------------- 기존 기록 목록 (수정/삭제) ---------------- */
  function renderExistingEntries(){
    const box = document.getElementById('existing-entries');
    box.innerHTML = '';
    if(!editingAlbum || !editingAlbum.entries.length){
      box.innerHTML = '<p class="empty-state">아직 등록된 기록이 없어요.</p>';
      return;
    }
    editingAlbum.entries.forEach(entry=>{
      const row = document.createElement('div');
      row.className = 'existing-entry-row';
      row.innerHTML = `
        ${entry.photo
          ? `<img src="${entry.photo}" alt="기록 사진">`
          : `<div style="width:72px;height:72px;border-radius:10px;background:#eef2f6;flex-shrink:0;"></div>`}
        <textarea placeholder="여행 일기">${escapeHtml(entry.diary)}</textarea>
        <button type="button" class="delete-btn">삭제</button>
      `;
      // 텍스트 수정은 포커스를 벗어날 때(change) 자동 저장
      row.querySelector('textarea').addEventListener('change', (e)=>{
        entry.diary = e.target.value.trim();
        saveState(state);
        toast('기록이 수정되었습니다');
      });
      row.querySelector('.delete-btn').addEventListener('click', ()=>{
        if(confirm('이 기록을 삭제할까요?')){
          editingAlbum.entries = editingAlbum.entries.filter(en => en.id !== entry.id);
          saveState(state);
          renderExistingEntries();
          toast('기록이 삭제되었습니다');
        }
      });
      box.appendChild(row);
    });
  }
  if(editingAlbum) renderExistingEntries();

  /* ---------------- 새 기록(사진+일기) 추가 ---------------- */
  on('edit-photo-drop', 'click', ()=> document.getElementById('edit-photo-input').click());
  on('edit-photo-input', 'change', (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    fileToDataUrl(file, (url)=>{
      editDraftPhoto = url;
      document.getElementById('edit-photo-content').innerHTML = `<img src="${url}" alt="업로드한 사진">`;
    });
  });

  function resetNewEntryForm(){
    editDraftPhoto = null;
    document.getElementById('edit-diary').value = '';
    document.getElementById('edit-photo-content').innerHTML = `
      <span class="dz-plus">+</span>
      <span>사진을 올려주세요</span>
    `;
  }

  on('edit-add-content-btn', 'click', ()=>{
    const diaryText = document.getElementById('edit-diary').value.trim();
    if(!editDraftPhoto && !diaryText){
      alert('사진 또는 여행 일기를 입력해주세요.');
      return;
    }

    // 생성 모드에서 처음으로 기록을 추가하면, 그 순간 앨범을 실제로 만든다
    if(!editingAlbum){
      const title = document.getElementById('edit-title').value.trim();
      if(!title){
        alert('여행 제목을 먼저 입력해주세요.');
        return;
      }
      editingAlbum = {
        id: 'a' + Date.now(),
        title,
        location: document.getElementById('edit-location').value.trim() || '미정',
        start: document.getElementById('edit-date-start').value || '',
        end: document.getElementById('edit-date-end').value || '',
        color: editSelectedColor,
        entries: []
      };
      state.albums.unshift(editingAlbum);
      enterEditMode();
      // 새로고침해도 같은 앨범을 계속 수정할 수 있도록 주소를 수정 모드로 바꿔준다
      history.replaceState(null, '', `album-edit.html?id=${editingAlbum.id}`);
    }

    editingAlbum.entries.push({ id: 'e' + Date.now(), photo: editDraftPhoto, diary: diaryText });
    saveState(state);
    toast('내용이 추가되었습니다');

    resetNewEntryForm();
    renderExistingEntries();
  });

  /* ---------------- 저장하기 (제목/기간/장소/색상) ---------------- */
  on('edit-save-btn', 'click', ()=>{
    const title = document.getElementById('edit-title').value.trim();
    if(!title){
      alert('여행 제목을 입력해주세요.');
      return;
    }

    if(!editingAlbum){
      editingAlbum = { id: 'a' + Date.now(), title: '', location: '', start: '', end: '', color: editSelectedColor, entries: [] };
      state.albums.unshift(editingAlbum);
    }

    editingAlbum.title = title;
    editingAlbum.location = document.getElementById('edit-location').value.trim() || '미정';
    editingAlbum.start = document.getElementById('edit-date-start').value || '';
    editingAlbum.end = document.getElementById('edit-date-end').value || '';
    editingAlbum.color = editSelectedColor;

    saveState(state);
    toast('저장되었습니다');
    location.href = `album-detail.html?id=${editingAlbum.id}`;
  });

  /* ---------------- 앨범 전체 삭제 (수정 모드에서만 노출) ---------------- */
  on('edit-delete-album-btn', 'click', ()=>{
    if(!editingAlbum) return;
    if(confirm(`"${editingAlbum.title}" 앨범을 완전히 삭제할까요? 되돌릴 수 없습니다.`)){
      state.albums = state.albums.filter(a => a.id !== editingAlbum.id);
      saveState(state);
      toast('앨범이 삭제되었습니다');
      location.href = 'album.html';
    }
  });
}
