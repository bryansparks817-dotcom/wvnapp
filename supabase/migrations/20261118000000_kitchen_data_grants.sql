-- Lets phones signed in with the kitchen login read and write the shared
-- data table. The table and its row rules were created, but the signed-in
-- role was never given access to the table itself, so every sync was refused.
-- Safe to run more than once.
grant select, insert, update, delete on table public.kitchen_data to authenticated;
