-- 4단계 마감 알림(24h/6h/3h/1h)을 위한 단계 기록.
-- 0 = 아직 안 보냄, 1~4 = 해당 단계까지 보냄.
alter table public.events add column reminder_stage smallint not null default 0;

-- 기존에 (구)단일 알림을 이미 받은 카드는 1단계(24시간 전)를 받은 것으로 이관해
-- 같은 알림이 또 가지 않게 한다.
update public.events set reminder_stage = 1 where reminder_sent_at is not null;

-- 구 방식 칼럼 제거
alter table public.events drop column reminder_sent_at;
