-- 러닝엑스(Canvas) 연동을 위한 스키마 변경
-- 1) sources.type에 'canvas' 허용
-- 2) feed_url_ciphertext → credential_ciphertext (URL만이 아니라 토큰도 담으므로 이름 일반화)
-- 3) events.is_hidden: 연동 카드는 삭제하면 다음 동기화 때 되살아나므로 "숨김"으로 처리

alter table public.sources rename column feed_url_ciphertext to credential_ciphertext;

alter table public.sources drop constraint sources_type_check;
alter table public.sources add constraint sources_type_check
  check (type in ('ical', 'school_notice', 'pasted_text', 'canvas'));

alter table public.sources drop constraint sources_feed_url_required_for_ical;
alter table public.sources add constraint sources_credential_required
  check (type not in ('ical', 'canvas') or credential_ciphertext is not null);

alter table public.events add column is_hidden boolean not null default false;
