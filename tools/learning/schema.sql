begin;
create table if not exists public.learning_attempts (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 topic text not null check(topic in ('set','logic','real','func','explog','trig','complex','matrix','seq','analytic','vector','stat','count','prob','dist','calc')),
 completed_at timestamptz not null default now(),
 received_at timestamptz not null default now(),
 evidence jsonb not null check(jsonb_typeof(evidence)='object' and jsonb_typeof(evidence->'results')='array' and jsonb_array_length(evidence->'results')=5 and length(evidence::text)<10000)
);
create index if not exists learning_attempts_owner_time on public.learning_attempts(user_id,completed_at);
alter table public.learning_attempts enable row level security;
revoke all on public.learning_attempts from public,anon,authenticated;
grant select,insert on public.learning_attempts to authenticated;
grant all on public.learning_attempts to service_role;
create policy learning_attempts_read_own on public.learning_attempts for select to authenticated using((select auth.uid())=user_id);
create policy learning_attempts_insert_own on public.learning_attempts for insert to authenticated with check((select auth.uid())=user_id and completed_at<=now()+interval '5 minutes');
create table if not exists public.learning_question_reports (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 topic text not null,
 details jsonb not null check(jsonb_typeof(details)='object' and length(details::text)<20000),
 created_at timestamptz not null default now()
);
alter table public.learning_question_reports enable row level security;
revoke all on public.learning_question_reports from public,anon,authenticated;
grant select,insert on public.learning_question_reports to authenticated;
grant all on public.learning_question_reports to service_role;
create policy learning_reports_read_own on public.learning_question_reports for select to authenticated using((select auth.uid())=user_id);
create policy learning_reports_insert_own on public.learning_question_reports for insert to authenticated with check((select auth.uid())=user_id);
comment on table public.learning_attempts is 'Personal practice evidence submitted by the learner client. Not a proctored exam score or public leaderboard authority.';
commit;
