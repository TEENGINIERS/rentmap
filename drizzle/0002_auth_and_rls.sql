-- ---------------------------------------------------------------------------
-- Supabase auth integration: auto-create a `profile` row when a user signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profile (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------
alter table locality  enable row level security;
alter table building  enable row level security;
alter table listing   enable row level security;
alter table profile   enable row level security;
alter table favorite  enable row level security;

-- Public read on listings/localities/buildings (anon + authenticated).
drop policy if exists "locality_public_read" on locality;
create policy "locality_public_read" on locality for select to anon, authenticated using (true);

drop policy if exists "building_public_read" on building;
create policy "building_public_read" on building for select to anon, authenticated using (true);

drop policy if exists "listing_public_read" on listing;
create policy "listing_public_read" on listing for select to anon, authenticated using (is_active = true);

-- Profile: users see and update only their own row.
drop policy if exists "profile_self_read" on profile;
create policy "profile_self_read" on profile for select to authenticated using (auth.uid() = id);

drop policy if exists "profile_self_update" on profile;
create policy "profile_self_update" on profile for update to authenticated using (auth.uid() = id);

-- Favorites: CRUD only on own rows.
drop policy if exists "favorite_self_read" on favorite;
create policy "favorite_self_read" on favorite for select to authenticated using (auth.uid() = user_id);

drop policy if exists "favorite_self_insert" on favorite;
create policy "favorite_self_insert" on favorite for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "favorite_self_delete" on favorite;
create policy "favorite_self_delete" on favorite for delete to authenticated using (auth.uid() = user_id);

-- Service role (used by seed script) bypasses RLS by default — no policy needed.
