-- =============================================================================
-- OPTIONAL: sample rooms so the app is not empty on day one.
--
-- The hotel has two kinds of room: "single" (simple) and "double".
-- Edit the numbers, types and rates to match the real hotel, or skip this file
-- and add rooms from the Rooms page (administrator only).
--
-- NOTE: the short-stay rate column is added by migration 6. If you run this file
-- BEFORE migration 6, drop the price_short_stay column from the lists below and
-- set the short-stay rates later on the Rooms screen.
-- Safe to run more than once.
-- =============================================================================
insert into public.rooms (room_number, room_type, price_per_night, price_short_stay) values
  ('101', 'single',  55, 25),
  ('102', 'single',  55, 25),
  ('103', 'double',  75, 35),
  ('104', 'double',  75, 35),
  ('105', 'double',  75, 35),
  ('201', 'double',  85, 40),
  ('202', 'double',  85, 40),
  ('203', 'single',  60, 30),
  ('204', 'double',  90, 45)
on conflict (room_number) do nothing;
