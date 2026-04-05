-- So Realtime postgres_changes with filter `room_id=eq...` receives DELETE
-- (pruned guests). Default replica identity only has PK; filter needs full row.

alter table public.room_members replica identity full;
