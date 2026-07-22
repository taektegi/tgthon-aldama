-- 일정에 과목(작업) 이름 저장
alter table public.events add column if not exists subject text;
