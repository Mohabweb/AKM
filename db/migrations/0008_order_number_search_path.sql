-- 0008_order_number_search_path.sql
-- create_order runs with search_path = public. On hosted Supabase, pgcrypto
-- (gen_random_bytes) lives in schema `extensions`, so gen_order_number() failed
-- with "function gen_random_bytes(integer) does not exist" and checkout showed
-- a generic error. Pin the function's search_path so it can find pgcrypto.
-- Also re-assert service_role execute grants used by the API.

create or replace function public.gen_order_number() returns text
language plpgsql volatile set search_path = public, extensions, pg_catalog as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  bytes bytea;
  out text := 'AKM-';
  i int;
begin
  bytes := gen_random_bytes(6);
  for i in 0..5 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return out;
end $$;

grant execute on function public.gen_order_number() to service_role;
grant execute on function public.create_order(jsonb) to service_role;
grant execute on function public.quote_cart(jsonb) to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.attach_receipt(uuid, text) to service_role;
