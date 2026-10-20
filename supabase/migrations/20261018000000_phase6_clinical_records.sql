-- =====================================================================
-- Phase 6: clinical records, vaccination records, and weight history
-- Run AFTER the Phase 5 migrations, in the Supabase SQL Editor
-- (or via `supabase db push`).
--
-- Official medical text is insert-only. A correction adds a new revision
-- and retires the previous row's is_current flag. Weight readings are
-- insert-only. Clients can read their own pets. Staff can read and record
-- weight. Only an active Senior Vet can create or revise clinical and
-- vaccination records.
-- =====================================================================

do $$ begin
  create type public.pet_weight_source as enum ('MANUAL', 'IOT');
exception when duplicate_object then null; end $$;

-- ---------- Weight history ----------
create table if not exists public.pet_weight_records (
  id             uuid primary key default gen_random_uuid(),
  pet_id         uuid not null references public.pets (id) on delete restrict,
  appointment_id uuid references public.appointments (id) on delete restrict,
  weight_kg      numeric(6, 2) not null check (weight_kg >= 0.01 and weight_kg <= 200),
  recorded_at    timestamptz not null default now(),
  recorded_by    uuid not null references public.profiles (id) on delete restrict,
  source         public.pet_weight_source not null default 'MANUAL',
  created_at     timestamptz not null default now()
);

comment on table public.pet_weight_records is
  'Confirmed pet weights. A new reading is inserted; older readings are never overwritten. IOT is reserved for a later phase.';

create index if not exists pet_weight_records_pet_recorded_idx
  on public.pet_weight_records (pet_id, recorded_at desc);

create or replace function public.protect_pet_weight_record()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Weight history cannot be modified';
end;
$$;

drop trigger if exists pet_weight_records_no_update on public.pet_weight_records;
create trigger pet_weight_records_no_update
  before update or delete on public.pet_weight_records
  for each row execute function public.protect_pet_weight_record();

-- ---------- Clinical records ----------
create table if not exists public.clinical_records (
  id                uuid primary key default gen_random_uuid(),
  lineage_id        uuid not null,
  revision          int not null check (revision >= 1),
  is_current        boolean not null default true,
  pet_id            uuid not null references public.pets (id) on delete restrict,
  appointment_id    uuid not null references public.appointments (id) on delete restrict,
  visit_date        date not null check (visit_date >= date '1980-01-01'),
  veterinarian_id   uuid not null references public.veterinarians (id) on delete restrict,
  reason_for_visit  text not null check (char_length(reason_for_visit) between 1 and 500),
  clinical_notes    text not null check (char_length(clinical_notes) between 1 and 4000),
  assessment        text not null check (char_length(assessment) between 1 and 4000),
  treatment         text not null check (char_length(treatment) between 1 and 4000),
  follow_up         text check (follow_up is null or char_length(follow_up) between 1 and 2000),
  recorded_by       uuid not null references public.profiles (id) on delete restrict,
  created_at        timestamptz not null default now(),
  unique (lineage_id, revision)
);

comment on table public.clinical_records is
  'Official visit records. Revisions are new rows. is_current marks the latest revision of a lineage.';

create index if not exists clinical_records_pet_idx
  on public.clinical_records (pet_id, visit_date desc);
create unique index if not exists clinical_records_one_current_lineage
  on public.clinical_records (lineage_id) where is_current;
create unique index if not exists clinical_records_one_current_appointment
  on public.clinical_records (appointment_id) where is_current;

create or replace function public.protect_clinical_record()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Clinical records cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    if current_setting('app.clinical_revision', true) is distinct from 'on' then
      raise exception 'Clinical records cannot be modified';
    end if;
    if new.id is distinct from old.id
       or new.lineage_id is distinct from old.lineage_id
       or new.revision is distinct from old.revision
       or new.pet_id is distinct from old.pet_id
       or new.appointment_id is distinct from old.appointment_id
       or new.visit_date is distinct from old.visit_date
       or new.veterinarian_id is distinct from old.veterinarian_id
       or new.reason_for_visit is distinct from old.reason_for_visit
       or new.clinical_notes is distinct from old.clinical_notes
       or new.assessment is distinct from old.assessment
       or new.treatment is distinct from old.treatment
       or new.follow_up is distinct from old.follow_up
       or new.recorded_by is distinct from old.recorded_by
       or new.created_at is distinct from old.created_at
       or old.is_current is not true
       or new.is_current is not false then
      raise exception 'Clinical records cannot be modified';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists clinical_records_protect on public.clinical_records;
create trigger clinical_records_protect
  before update or delete on public.clinical_records
  for each row execute function public.protect_clinical_record();

-- ---------- Vaccination records ----------
create table if not exists public.vaccination_records (
  id               uuid primary key default gen_random_uuid(),
  lineage_id       uuid not null,
  revision         int not null check (revision >= 1),
  is_current       boolean not null default true,
  pet_id           uuid not null references public.pets (id) on delete restrict,
  appointment_id   uuid references public.appointments (id) on delete restrict,
  vaccine_name     text not null check (char_length(vaccine_name) between 1 and 120),
  administered_on  date not null check (administered_on >= date '1980-01-01'),
  dose             text not null check (char_length(dose) between 1 and 80),
  veterinarian_id  uuid not null references public.veterinarians (id) on delete restrict,
  weight_kg        numeric(6, 2) check (weight_kg is null or (weight_kg >= 0.01 and weight_kg <= 200)),
  next_due_on      date check (next_due_on is null or next_due_on >= administered_on),
  notes            text check (notes is null or char_length(notes) between 1 and 2000),
  recorded_by      uuid not null references public.profiles (id) on delete restrict,
  created_at       timestamptz not null default now(),
  unique (lineage_id, revision)
);

comment on table public.vaccination_records is
  'Official vaccination history. Revisions are new rows and previous doses stay readable.';

create index if not exists vaccination_records_pet_idx
  on public.vaccination_records (pet_id, administered_on desc);
create unique index if not exists vaccination_records_one_current_lineage
  on public.vaccination_records (lineage_id) where is_current;

create or replace function public.protect_vaccination_record()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Vaccination records cannot be deleted';
  end if;

  if tg_op = 'UPDATE' then
    if current_setting('app.vaccination_revision', true) is distinct from 'on' then
      raise exception 'Vaccination records cannot be modified';
    end if;
    if new.id is distinct from old.id
       or new.lineage_id is distinct from old.lineage_id
       or new.revision is distinct from old.revision
       or new.pet_id is distinct from old.pet_id
       or new.appointment_id is distinct from old.appointment_id
       or new.vaccine_name is distinct from old.vaccine_name
       or new.administered_on is distinct from old.administered_on
       or new.dose is distinct from old.dose
       or new.veterinarian_id is distinct from old.veterinarian_id
       or new.weight_kg is distinct from old.weight_kg
       or new.next_due_on is distinct from old.next_due_on
       or new.notes is distinct from old.notes
       or new.recorded_by is distinct from old.recorded_by
       or new.created_at is distinct from old.created_at
       or old.is_current is not true
       or new.is_current is not false then
      raise exception 'Vaccination records cannot be modified';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists vaccination_records_protect on public.vaccination_records;
create trigger vaccination_records_protect
  before update or delete on public.vaccination_records
  for each row execute function public.protect_vaccination_record();

-- ---------- Shared checks used by the write RPCs ----------
create or replace function public.phase6_required_text(p_value text, p_max int, p_label text)
returns text
language plpgsql
immutable
as $$
declare
  v text := nullif(btrim(coalesce(p_value, '')), '');
begin
  if v is null or char_length(v) > p_max then
    raise exception '%', p_label;
  end if;
  return v;
end;
$$;

create or replace function public.phase6_optional_text(p_value text, p_max int, p_label text)
returns text
language plpgsql
immutable
as $$
declare
  v text := nullif(btrim(coalesce(p_value, '')), '');
begin
  if v is not null and char_length(v) > p_max then
    raise exception '%', p_label;
  end if;
  return v;
end;
$$;

create or replace function public.phase6_assert_pet_open(p_pet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_archived boolean;
begin
  select is_archived into v_archived from public.pets where id = p_pet_id;
  if not found or v_archived then
    raise exception 'Pet not found';
  end if;
end;
$$;

create or replace function public.phase6_assert_visit_ready(p_appointment_id uuid, p_pet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet uuid;
  v_status public.appointment_status;
begin
  select pet_id, status into v_pet, v_status
  from public.appointments
  where id = p_appointment_id;

  if not found or v_pet is distinct from p_pet_id then
    raise exception 'Appointment not found';
  end if;

  if v_status not in ('CHECKED_IN', 'IN_CONSULTATION', 'COMPLETED') then
    raise exception 'Records can only be saved after check-in';
  end if;
end;
$$;

create or replace function public.phase6_assert_active_vet(p_veterinarian_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.veterinarians
    where id = p_veterinarian_id and is_active
  ) then
    raise exception 'Choose an active veterinarian';
  end if;
end;
$$;

create or replace function public.phase6_assert_weight(p_weight_kg numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  v numeric(6, 2);
begin
  if p_weight_kg is null then
    raise exception 'Enter a weight between 0.01 and 200 kg';
  end if;
  v := round(p_weight_kg, 2);
  if v < 0.01 or v > 200 then
    raise exception 'Enter a weight between 0.01 and 200 kg';
  end if;
  return v;
end;
$$;

create or replace function public.phase6_assert_past_date(p_date date, p_label text)
returns date
language plpgsql
stable
as $$
declare
  -- Match the clinic calendar. current_date is UTC and rejects Manila "today"
  -- in the early morning.
  v_today date := (timezone('Asia/Manila', now()))::date;
begin
  if p_date is null or p_date < date '1980-01-01' or p_date > v_today then
    raise exception '%', p_label;
  end if;
  return p_date;
end;
$$;

-- ---------- record_pet_weight ----------
create or replace function public.record_pet_weight(
  p_pet_id uuid,
  p_weight_kg numeric,
  p_appointment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_id uuid;
  v_weight numeric(6, 2);
  v_pet uuid;
begin
  v_role := public.current_user_role();
  if auth.uid() is null or v_role is null or v_role not in ('STAFF', 'SENIOR_VET') then
    raise exception 'Not authorized';
  end if;

  perform public.phase6_assert_pet_open(p_pet_id);
  v_weight := public.phase6_assert_weight(p_weight_kg);

  if p_appointment_id is not null then
    select pet_id into v_pet from public.appointments where id = p_appointment_id;
    if not found or v_pet is distinct from p_pet_id then
      raise exception 'Appointment not found';
    end if;
  end if;

  insert into public.pet_weight_records (pet_id, appointment_id, weight_kg, recorded_by, source)
  values (p_pet_id, p_appointment_id, v_weight, auth.uid(), 'MANUAL')
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------- Clinical record RPCs ----------
create or replace function public.create_clinical_record(
  p_pet_id uuid,
  p_appointment_id uuid,
  p_visit_date date,
  p_veterinarian_id uuid,
  p_reason_for_visit text,
  p_clinical_notes text,
  p_assessment text,
  p_treatment text,
  p_follow_up text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_reason text;
  v_notes text;
  v_assessment text;
  v_treatment text;
  v_follow_up text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can modify this clinical record';
  end if;

  perform public.phase6_assert_pet_open(p_pet_id);
  perform public.phase6_assert_visit_ready(p_appointment_id, p_pet_id);
  perform public.phase6_assert_active_vet(p_veterinarian_id);
  perform public.phase6_assert_past_date(p_visit_date, 'Enter a valid visit date');

  if exists (select 1 from public.clinical_records where appointment_id = p_appointment_id) then
    raise exception 'A clinical record already exists for this visit';
  end if;

  v_reason := public.phase6_required_text(p_reason_for_visit, 500, 'Enter a reason for the visit');
  v_notes := public.phase6_required_text(p_clinical_notes, 4000, 'Enter the clinical notes');
  v_assessment := public.phase6_required_text(p_assessment, 4000, 'Enter the assessment');
  v_treatment := public.phase6_required_text(p_treatment, 4000, 'Enter the treatment');
  v_follow_up := public.phase6_optional_text(p_follow_up, 2000, 'Follow-up instructions are too long');
  v_id := gen_random_uuid();

  insert into public.clinical_records (
    id, lineage_id, revision, is_current, pet_id, appointment_id, visit_date,
    veterinarian_id, reason_for_visit, clinical_notes, assessment, treatment,
    follow_up, recorded_by
  ) values (
    v_id, v_id, 1, true, p_pet_id, p_appointment_id, p_visit_date,
    p_veterinarian_id, v_reason, v_notes, v_assessment, v_treatment,
    v_follow_up, auth.uid()
  );

  return v_id;
end;
$$;

create or replace function public.revise_clinical_record(
  p_lineage_id uuid,
  p_visit_date date,
  p_veterinarian_id uuid,
  p_reason_for_visit text,
  p_clinical_notes text,
  p_assessment text,
  p_treatment text,
  p_follow_up text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.clinical_records%rowtype;
  v_id uuid;
  v_reason text;
  v_notes text;
  v_assessment text;
  v_treatment text;
  v_follow_up text;
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can modify this clinical record';
  end if;

  select * into v_current
  from public.clinical_records
  where lineage_id = p_lineage_id and is_current
  for update;

  if not found then
    raise exception 'Clinical record not found';
  end if;

  perform public.phase6_assert_pet_open(v_current.pet_id);
  perform public.phase6_assert_visit_ready(v_current.appointment_id, v_current.pet_id);
  perform public.phase6_assert_active_vet(p_veterinarian_id);
  perform public.phase6_assert_past_date(p_visit_date, 'Enter a valid visit date');

  v_reason := public.phase6_required_text(p_reason_for_visit, 500, 'Enter a reason for the visit');
  v_notes := public.phase6_required_text(p_clinical_notes, 4000, 'Enter the clinical notes');
  v_assessment := public.phase6_required_text(p_assessment, 4000, 'Enter the assessment');
  v_treatment := public.phase6_required_text(p_treatment, 4000, 'Enter the treatment');
  v_follow_up := public.phase6_optional_text(p_follow_up, 2000, 'Follow-up instructions are too long');

  perform set_config('app.clinical_revision', 'on', true);
  update public.clinical_records
  set is_current = false
  where id = v_current.id;
  perform set_config('app.clinical_revision', 'off', true);

  v_id := gen_random_uuid();
  insert into public.clinical_records (
    id, lineage_id, revision, is_current, pet_id, appointment_id, visit_date,
    veterinarian_id, reason_for_visit, clinical_notes, assessment, treatment,
    follow_up, recorded_by
  ) values (
    v_id, v_current.lineage_id, v_current.revision + 1, true, v_current.pet_id,
    v_current.appointment_id, p_visit_date, p_veterinarian_id, v_reason, v_notes,
    v_assessment, v_treatment, v_follow_up, auth.uid()
  );

  return v_id;
end;
$$;

-- ---------- Vaccination RPCs ----------
create or replace function public.create_vaccination_record(
  p_pet_id uuid,
  p_appointment_id uuid default null,
  p_vaccine_name text default null,
  p_administered_on date default null,
  p_dose text default null,
  p_veterinarian_id uuid default null,
  p_weight_kg numeric default null,
  p_next_due_on date default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
  v_dose text;
  v_notes text;
  v_weight numeric(6, 2);
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can modify this clinical record';
  end if;

  perform public.phase6_assert_pet_open(p_pet_id);
  if p_appointment_id is not null then
    perform public.phase6_assert_visit_ready(p_appointment_id, p_pet_id);
  end if;
  perform public.phase6_assert_active_vet(p_veterinarian_id);
  perform public.phase6_assert_past_date(p_administered_on, 'Enter a valid vaccination date');

  v_name := public.phase6_required_text(p_vaccine_name, 120, 'Enter the vaccine name');
  v_dose := public.phase6_required_text(p_dose, 80, 'Enter the dose');
  v_notes := public.phase6_optional_text(p_notes, 2000, 'Notes are too long');
  if p_weight_kg is null then
    v_weight := null;
  else
    v_weight := public.phase6_assert_weight(p_weight_kg);
  end if;
  if p_next_due_on is not null and p_next_due_on < p_administered_on then
    raise exception 'Next vaccination date cannot be before the dose was given';
  end if;

  v_id := gen_random_uuid();
  insert into public.vaccination_records (
    id, lineage_id, revision, is_current, pet_id, appointment_id, vaccine_name,
    administered_on, dose, veterinarian_id, weight_kg, next_due_on, notes, recorded_by
  ) values (
    v_id, v_id, 1, true, p_pet_id, p_appointment_id, v_name,
    p_administered_on, v_dose, p_veterinarian_id, v_weight, p_next_due_on, v_notes, auth.uid()
  );

  return v_id;
end;
$$;

create or replace function public.revise_vaccination_record(
  p_lineage_id uuid,
  p_vaccine_name text,
  p_administered_on date,
  p_dose text,
  p_veterinarian_id uuid,
  p_weight_kg numeric,
  p_next_due_on date,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.vaccination_records%rowtype;
  v_id uuid;
  v_name text;
  v_dose text;
  v_notes text;
  v_weight numeric(6, 2);
begin
  if auth.uid() is null or public.current_user_role() is distinct from 'SENIOR_VET' then
    raise exception 'Only Senior Vets can modify this clinical record';
  end if;

  select * into v_current
  from public.vaccination_records
  where lineage_id = p_lineage_id and is_current
  for update;

  if not found then
    raise exception 'Vaccination record not found';
  end if;

  perform public.phase6_assert_pet_open(v_current.pet_id);
  if v_current.appointment_id is not null then
    perform public.phase6_assert_visit_ready(v_current.appointment_id, v_current.pet_id);
  end if;
  perform public.phase6_assert_active_vet(p_veterinarian_id);
  perform public.phase6_assert_past_date(p_administered_on, 'Enter a valid vaccination date');

  v_name := public.phase6_required_text(p_vaccine_name, 120, 'Enter the vaccine name');
  v_dose := public.phase6_required_text(p_dose, 80, 'Enter the dose');
  v_notes := public.phase6_optional_text(p_notes, 2000, 'Notes are too long');
  if p_weight_kg is null then
    v_weight := null;
  else
    v_weight := public.phase6_assert_weight(p_weight_kg);
  end if;
  if p_next_due_on is not null and p_next_due_on < p_administered_on then
    raise exception 'Next vaccination date cannot be before the dose was given';
  end if;

  perform set_config('app.vaccination_revision', 'on', true);
  update public.vaccination_records
  set is_current = false
  where id = v_current.id;
  perform set_config('app.vaccination_revision', 'off', true);

  v_id := gen_random_uuid();
  insert into public.vaccination_records (
    id, lineage_id, revision, is_current, pet_id, appointment_id, vaccine_name,
    administered_on, dose, veterinarian_id, weight_kg, next_due_on, notes, recorded_by
  ) values (
    v_id, v_current.lineage_id, v_current.revision + 1, true, v_current.pet_id,
    v_current.appointment_id, v_name, p_administered_on, v_dose, p_veterinarian_id,
    v_weight, p_next_due_on, v_notes, auth.uid()
  );

  return v_id;
end;
$$;

-- ---------- RLS ----------
alter table public.pet_weight_records enable row level security;
alter table public.clinical_records enable row level security;
alter table public.vaccination_records enable row level security;

drop policy if exists "pet_weight_records_select" on public.pet_weight_records;
create policy "pet_weight_records_select"
  on public.pet_weight_records
  for select
  to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (
      public.current_user_role() = 'CLIENT'
      and exists (
        select 1 from public.pets p
        where p.id = pet_id and p.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "clinical_records_select" on public.clinical_records;
create policy "clinical_records_select"
  on public.clinical_records
  for select
  to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (
      public.current_user_role() = 'CLIENT'
      and exists (
        select 1 from public.pets p
        where p.id = pet_id and p.owner_id = auth.uid()
      )
    )
  );

drop policy if exists "vaccination_records_select" on public.vaccination_records;
create policy "vaccination_records_select"
  on public.vaccination_records
  for select
  to authenticated
  using (
    public.current_user_role() in ('STAFF', 'SENIOR_VET')
    or (
      public.current_user_role() = 'CLIENT'
      and exists (
        select 1 from public.pets p
        where p.id = pet_id and p.owner_id = auth.uid()
      )
    )
  );

revoke all on public.pet_weight_records from public, anon, authenticated;
revoke all on public.clinical_records from public, anon, authenticated;
revoke all on public.vaccination_records from public, anon, authenticated;
grant select on public.pet_weight_records to authenticated;
grant select on public.clinical_records to authenticated;
grant select on public.vaccination_records to authenticated;

revoke all on function public.protect_pet_weight_record() from public, anon, authenticated;
revoke all on function public.protect_clinical_record() from public, anon, authenticated;
revoke all on function public.protect_vaccination_record() from public, anon, authenticated;
revoke all on function public.phase6_required_text(text, int, text) from public, anon, authenticated;
revoke all on function public.phase6_optional_text(text, int, text) from public, anon, authenticated;
revoke all on function public.phase6_assert_pet_open(uuid) from public, anon, authenticated;
revoke all on function public.phase6_assert_visit_ready(uuid, uuid) from public, anon, authenticated;
revoke all on function public.phase6_assert_active_vet(uuid) from public, anon, authenticated;
revoke all on function public.phase6_assert_weight(numeric) from public, anon, authenticated;
revoke all on function public.phase6_assert_past_date(date, text) from public, anon, authenticated;

revoke all on function public.record_pet_weight(uuid, numeric, uuid) from public, anon;
grant execute on function public.record_pet_weight(uuid, numeric, uuid) to authenticated;

revoke all on function public.create_clinical_record(uuid, uuid, date, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.create_clinical_record(uuid, uuid, date, uuid, text, text, text, text, text) to authenticated;

revoke all on function public.revise_clinical_record(uuid, date, uuid, text, text, text, text, text) from public, anon;
grant execute on function public.revise_clinical_record(uuid, date, uuid, text, text, text, text, text) to authenticated;

revoke all on function public.create_vaccination_record(uuid, uuid, text, date, text, uuid, numeric, date, text) from public, anon;
grant execute on function public.create_vaccination_record(uuid, uuid, text, date, text, uuid, numeric, date, text) to authenticated;

revoke all on function public.revise_vaccination_record(uuid, text, date, text, uuid, numeric, date, text) from public, anon;
grant execute on function public.revise_vaccination_record(uuid, text, date, text, uuid, numeric, date, text) to authenticated;
