-- Private source corpus. Only the service role can import or retrieve raw items.
-- Apply to MathPath project xhkyaasgezqalsymnryg; no other project.
begin;
create table if not exists public.exam_corpus_papers (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  year integer not null check (year between 2500 and 2700),
  kind text not null check (kind in ('a_level','samuan')),
  source_name text not null,
  page_count integer not null check (page_count > 0),
  model text not null,
  prompt_version text not null,
  processed_at timestamptz not null,
  summary jsonb not null check (jsonb_typeof(summary)='object')
);
create table if not exists public.exam_corpus_items (
  paper_id text not null references public.exam_corpus_papers(id) on delete cascade,
  number integer not null check (number between 1 and 100),
  page_start integer not null check (page_start > 0),
  page_end integer not null check (page_end >= page_start),
  primary_topic text not null check (primary_topic in ('set','logic','real','func','explog','trig','complex','matrix','seq','analytic','vector','stat','count','prob','dist','calc')),
  needs_review boolean not null default true,
  content jsonb not null check (jsonb_typeof(content)='object'),
  primary key (paper_id,number)
);
create index if not exists exam_corpus_papers_year_idx on public.exam_corpus_papers(year,processed_at desc);
create index if not exists exam_corpus_items_topic_idx on public.exam_corpus_items(primary_topic,paper_id);
alter table public.exam_corpus_papers enable row level security;
alter table public.exam_corpus_items enable row level security;
revoke all on public.exam_corpus_papers,public.exam_corpus_items from public,anon,authenticated;
grant select,insert,update,delete on public.exam_corpus_papers,public.exam_corpus_items to service_role;

create or replace function public.import_exam_corpus(p_document jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  p_id text := p_document->>'id';
  q jsonb;
  n integer;
begin
  if jsonb_typeof(p_document->'questions') is distinct from 'array' then raise exception 'questions array required'; end if;
  n := jsonb_array_length(p_document->'questions');
  if n <> (p_document->'summary'->>'counted')::integer then raise exception 'summary count mismatch'; end if;
  -- Serialize concurrent imports for a source, including its first insertion.
  perform pg_advisory_xact_lock(hashtextextended(p_id,0));
  if exists(select 1 from public.exam_corpus_papers where id=p_id and summary->>'coverage'='complete')
     and p_document->'summary'->>'coverage' is distinct from 'complete' then
    raise exception 'refusing to replace complete paper with partial extraction';
  end if;
  insert into public.exam_corpus_papers(id,year,kind,source_name,page_count,model,prompt_version,processed_at,summary)
  values(p_id,(p_document->>'year')::integer,p_document->>'kind',p_document->>'source_name',
    (p_document->>'page_count')::integer,p_document->>'model',p_document->>'prompt_version',
    (p_document->>'processed_at')::timestamptz,p_document->'summary')
  on conflict(id) do update set year=excluded.year,kind=excluded.kind,source_name=excluded.source_name,
    page_count=excluded.page_count,model=excluded.model,prompt_version=excluded.prompt_version,
    processed_at=excluded.processed_at,summary=excluded.summary;
  delete from public.exam_corpus_items where paper_id=p_id;
  for q in select value from jsonb_array_elements(p_document->'questions') loop
    if (q->>'page_end')::integer > (p_document->>'page_count')::integer then raise exception 'page beyond source'; end if;
    insert into public.exam_corpus_items(paper_id,number,page_start,page_end,primary_topic,needs_review,content)
    values(p_id,(q->>'number')::integer,(q->>'page_start')::integer,(q->>'page_end')::integer,
      q->'topics'->>0,coalesce((q->>'needs_review')::boolean,true),q);
  end loop;
  return jsonb_build_object('paper_id',p_id,'stored',n);
end $$;
revoke all on function public.import_exam_corpus(jsonb) from public,anon,authenticated;
grant execute on function public.import_exam_corpus(jsonb) to service_role;
commit;
