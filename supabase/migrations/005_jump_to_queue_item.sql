-- Jump to / play a specific queue item: move it to the front; others keep order after it.
-- Unpauses playback. Same permission model as advance_queue (any room member).

create or replace function public.jump_to_queue_item(p_item_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_id uuid;
  ok boolean;
  base_ts timestamptz;
begin
  select room_id into r_id from public.queue_items where id = p_item_id;
  if r_id is null then
    return;
  end if;

  ok := exists (
    select 1 from public.rooms r
    where r.id = r_id and r.host_token = p_host_token
  ) or exists (
    select 1 from public.room_members m
    where m.room_id = r_id and m.user_id = auth.uid()
  );

  if not ok then
    raise exception 'Not allowed';
  end if;

  update public.rooms
  set playback_paused = false
  where id = r_id;

  base_ts := clock_timestamp();

  update public.queue_items q
  set created_at = base_ts + r.new_rn * interval '1 microsecond'
  from (
    with
    ordered as (
      select
        qi.id,
        row_number() over (order by qi.created_at asc, qi.id asc) as rn
      from public.queue_items qi
      where qi.room_id = r_id
    ),
    tgt as (
      select o.rn from ordered o where o.id = p_item_id
    ),
    ranked as (
      select
        o.id,
        row_number() over (
          order by
            case
              when o.id = p_item_id then 0
              when o.rn < (select t.rn from tgt t) then 1
              else 2
            end,
            o.rn
        ) as new_rn
      from ordered o
    )
    select id, new_rn from ranked
  ) r
  where q.id = r.id;
end;
$$;

grant execute on function public.jump_to_queue_item(uuid, text) to authenticated;
