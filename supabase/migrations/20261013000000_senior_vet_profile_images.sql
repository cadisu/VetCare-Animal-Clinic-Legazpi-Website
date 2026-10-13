-- Senior Vet profile pictures.
-- Additive only: a nullable avatar path plus a private bucket the owner can manage.
-- Does not change roles, existing profile columns, or other storage policies.

alter table public.profiles
  add column if not exists avatar_path text
  check (avatar_path is null or char_length(avatar_path) <= 255);

comment on column public.profiles.avatar_path is
  'Storage path in the profile-images bucket, shaped as "<user id>/<file>". Null when no picture is set.';

grant update (avatar_path) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "profile_images_select_own" on storage.objects;
create policy "profile_images_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() = 'SENIOR_VET'
  );

drop policy if exists "profile_images_insert_own" on storage.objects;
create policy "profile_images_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() = 'SENIOR_VET'
  );

drop policy if exists "profile_images_delete_own" on storage.objects;
create policy "profile_images_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.current_user_role() = 'SENIOR_VET'
  );
