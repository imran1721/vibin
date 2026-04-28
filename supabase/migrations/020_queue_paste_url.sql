-- Allow queue items from sources other than YouTube (e.g. pasted .mp4 / .webm / HLS URLs).
-- Existing rows keep provider='youtube' and continue to use video_id.

alter table public.queue_items
  add column if not exists provider text not null default 'youtube',
  add column if not exists media_url text;

alter table public.queue_items
  drop constraint if exists queue_items_provider_check;

alter table public.queue_items
  add constraint queue_items_provider_check
  check (provider in ('youtube', 'direct', 'embed'));

alter table public.queue_items
  alter column video_id drop not null;

alter table public.queue_items
  drop constraint if exists queue_items_source_present;

alter table public.queue_items
  add constraint queue_items_source_present
  check (
    (provider = 'youtube' and video_id is not null) or
    (provider in ('direct', 'embed') and media_url is not null)
  );
