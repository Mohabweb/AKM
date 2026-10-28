-- Minimal stand-in for the parts of Supabase that the migrations rely on.
-- ONLY for local/CI testing. On real Supabase these already exist.
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text unique);
-- Tests set request.jwt.claim.sub directly; PostgREST (local E2E backend) sets request.jwt.claims as JSON.
create or replace function auth.uid() returns uuid language sql stable as
  $$ select coalesce(
       nullif(current_setting('request.jwt.claim.sub', true), ''),
       nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;

create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(
       nullif(current_setting('request.jwt.claims', true), '')::jsonb,
       jsonb_build_object(
         'sub', nullif(current_setting('request.jwt.claim.sub', true), ''),
         'aal', coalesce(nullif(current_setting('request.jwt.claim.aal', true), ''), 'aal1')
       )
     ) $$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt() to anon, authenticated, service_role;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.buckets, storage.objects to service_role;
grant select, insert, update, delete on storage.objects to authenticated;
