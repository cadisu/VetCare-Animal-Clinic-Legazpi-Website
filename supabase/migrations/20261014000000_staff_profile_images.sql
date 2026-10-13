-- Allow Staff to manage their own profile pictures in the existing profile-images bucket.
-- Senior Vet policies from 20261013000000 are replaced with role checks that include STAFF.

drop policy if exists "profile_images_select_own" on storage.objects;
create policy "profile_images_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );

drop policy if exists "profile_images_insert_own" on storage.objects;
create policy "profile_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );

drop policy if exists "profile_images_delete_own" on storage.objects;
create policy "profile_images_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() in ('STAFF', 'SENIOR_VET')
  );
