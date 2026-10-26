-- assistant_handoffs: escalations captured by the AI shopping assistant.
-- When a shopper leaves an email for a sensitive/order question, the server
-- logs a row here so the team can follow up personally.
--
-- Run this in the Supabase dashboard → SQL editor (it is also kept here for
-- version control). RLS is ON: the public API may INSERT a handoff but CANNOT
-- read any back — the team reads them from the Supabase dashboard (the service
-- role bypasses RLS), so shopper emails stay private.

create table if not exists public.assistant_handoffs (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  question   text,
  created_at timestamptz not null default now()
);

alter table public.assistant_handoffs enable row level security;

drop policy if exists assistant_handoffs_insert_anon on public.assistant_handoffs;
create policy assistant_handoffs_insert_anon
  on public.assistant_handoffs
  for insert
  to anon, authenticated
  with check (true);
