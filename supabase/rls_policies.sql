-- ============================================================
-- rls_policies.sql — Supabase 대시보드 SQL Editor에서 실행한 RLS 정책
-- (3단계: RLS 정책 설정. schema.sql 실행 이후에 적용)
--
-- "로그인한 사용자는 자기 데이터만 읽고 쓸 수 있다"는 규칙.
-- album_entries는 자체 user_id가 없어서, 부모 albums의 user_id를
-- 참조해서 검사한다.
-- ============================================================

-- profiles: 본인 것만 조회/수정
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- albums: 본인 것만 CRUD
create policy "albums_select_own" on public.albums
  for select using (auth.uid() = user_id);

create policy "albums_insert_own" on public.albums
  for insert with check (auth.uid() = user_id);

create policy "albums_update_own" on public.albums
  for update using (auth.uid() = user_id);

create policy "albums_delete_own" on public.albums
  for delete using (auth.uid() = user_id);

-- album_entries: 부모 album의 소유자인지 확인해서 CRUD
create policy "album_entries_select_own" on public.album_entries
  for select using (
    exists (select 1 from public.albums a where a.id = album_entries.album_id and a.user_id = auth.uid())
  );

create policy "album_entries_insert_own" on public.album_entries
  for insert with check (
    exists (select 1 from public.albums a where a.id = album_entries.album_id and a.user_id = auth.uid())
  );

create policy "album_entries_update_own" on public.album_entries
  for update using (
    exists (select 1 from public.albums a where a.id = album_entries.album_id and a.user_id = auth.uid())
  );

create policy "album_entries_delete_own" on public.album_entries
  for delete using (
    exists (select 1 from public.albums a where a.id = album_entries.album_id and a.user_id = auth.uid())
  );

-- bookmarks: 본인 것만 조회/추가/삭제 (수정은 필요 없음, 토글 방식이라)
create policy "bookmarks_select_own" on public.bookmarks
  for select using (auth.uid() = user_id);

create policy "bookmarks_insert_own" on public.bookmarks
  for insert with check (auth.uid() = user_id);

create policy "bookmarks_delete_own" on public.bookmarks
  for delete using (auth.uid() = user_id);
