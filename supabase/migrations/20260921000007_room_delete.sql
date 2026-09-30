-- Migration 7: let administrators delete a room.
--
-- Only a room that has never had a stay can be deleted: stays.room_id is
-- "on delete restrict", so the database refuses otherwise (23503) and the app
-- tells the administrator to take the room out of service instead. History of
-- real stays is therefore never lost.

create policy "rooms: admins delete"
  on public.rooms for delete to authenticated
  using (public.is_admin());
