-- =====================================================================
-- Phase 6 follow-up: visit and vaccination dates use the clinic calendar.
-- Safe to run after 20261018000000_phase6_clinical_records.sql.
-- Replaces only the date check. Records and policies are unchanged.
-- =====================================================================

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

revoke all on function public.phase6_assert_past_date(date, text) from public, anon, authenticated;
