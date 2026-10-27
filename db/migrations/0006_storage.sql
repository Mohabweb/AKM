-- 0006_storage.sql — buckets and storage policies
-- product-images: PUBLIC read (so next/image can serve it), writes by admins only.
-- instapay-receipts: PRIVATE. Customers never touch storage directly: uploads go through a validated server
-- endpoint using the service role. Admins read via short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('instapay-receipts', 'instapay-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy product_images_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin())
  with check (bucket_id = 'product-images' and public.is_admin());
create policy product_images_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- receipts: admins may read (needed to create signed URLs); nobody else, no client writes at all.
create policy receipts_admin_read on storage.objects for select to authenticated
  using (bucket_id = 'instapay-receipts' and public.is_admin());
