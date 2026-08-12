-- ============================================================
-- schema.sql — Supabase 대시보드 SQL Editor에서 실행한 테이블 생성 SQL
-- (2단계: DB 스키마 설계 및 테이블 생성)
--
-- 실행 순서: 이 파일 -> rls_policies.sql
-- ============================================================

-- 1) uuid 생성 함수 확장 (안전하게 명시적으로 켜둠)
create extension if not exists pgcrypto;

-- 2) profiles: auth.users 1:1 확장 (이름, 아바타)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 3) albums: 여행 앨범
create table public.albums (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  location text,
  start_date date,
  end_date date,
  color text,
  created_at timestamptz not null default now()
);

-- 4) album_entries: 앨범 안의 사진+일기 엔트리
create table public.album_entries (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums(id) on delete cascade,
  photo_url text,
  diary text,
  created_at timestamptz not null default now()
);

-- 5) bookmarks: 찜한 여행지
create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_id text not null,   -- TourAPI contentId
  name text,
  image text,
  link text,
  created_at timestamptz not null default now(),
  unique (user_id, content_id)
);

-- 6) 회원가입 시 profiles 행을 자동으로 만들어주는 트리거
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 7) RLS 켜기 (정책은 rls_policies.sql에서 추가 — 지금은 "누구도 접근 불가"가 기본값이라 안전함)
alter table public.profiles enable row level security;
alter table public.albums enable row level security;
alter table public.album_entries enable row level security;
alter table public.bookmarks enable row level security;
