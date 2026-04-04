-- When the first track is added to an empty queue (playback pointer was null),
-- start in playing state so the host does not need to tap Play.

create or replace function public.queue_items_set_default_pointer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms r
  set
    playback_current_item_id = new.id,
    playback_paused = false
  where r.id = new.room_id
    and r.playback_current_item_id is null;
  return new;
end;
$$;
