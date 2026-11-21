-- Apply ONLY to a new dedicated Pacífica Hair Supabase project.
create table if not exists public.pacifica_customer_details (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null check(char_length(full_name) between 2 and 100),
 phone text not null check(phone ~ '^[0-9]{10,11}$'),
 postal_code text not null check(postal_code ~ '^[0-9]{8}$'),
 street text not null check(char_length(street) between 1 and 160),
 house_number text not null check(char_length(house_number) between 1 and 30),
 complement text not null default '' check(char_length(complement)<=100),
 neighborhood text not null check(char_length(neighborhood) between 1 and 100),
 city text not null check(char_length(city) between 1 and 100),
 state text not null check(state ~ '^[A-Z]{2}$')
);
alter table public.pacifica_customer_details enable row level security;
revoke all on public.pacifica_customer_details from public,anon,authenticated;
grant select,insert,update on public.pacifica_customer_details to authenticated;
create policy "Read own delivery details" on public.pacifica_customer_details for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own delivery details" on public.pacifica_customer_details for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own delivery details" on public.pacifica_customer_details for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
