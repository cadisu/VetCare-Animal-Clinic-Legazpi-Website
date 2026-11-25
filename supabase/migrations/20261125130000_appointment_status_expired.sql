-- Add EXPIRED before any function uses it. PostgreSQL cannot use a new
-- enum value in the same transaction that adds it.

alter type public.appointment_status add value if not exists 'EXPIRED';

alter table public.appointment_status_events
  alter column actor_role drop not null;
