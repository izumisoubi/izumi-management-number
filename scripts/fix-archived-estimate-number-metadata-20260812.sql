-- 26-* から 24-* へ退避済みの旧テスト見積について、
-- payload 内に残った旧管理番号・会計年度も現在の台帳番号へ揃える。

begin;

create table if not exists public.safety_fix_archived_estimate_metadata_20260812 (
  management_number text primary key,
  payload jsonb not null,
  revision integer not null,
  backed_up_at timestamptz not null default now()
);

insert into public.safety_fix_archived_estimate_metadata_20260812(
  management_number,payload,revision
)
select management_number,payload,revision
from public.estimate_projects
where management_number between '24-2974' and '24-2984'
  and deleted_at is null
on conflict(management_number) do nothing;

update public.estimate_projects
set payload=jsonb_set(
      jsonb_set(payload,'{basic,kanri}',to_jsonb(management_number),true),
      '{ledger}',coalesce(payload->'ledger','{}'::jsonb) || jsonb_build_object('accountingYear','2024'),true
    ),
    revision=revision+1,
    updated_at=now()
where management_number between '24-2974' and '24-2984'
  and deleted_at is null
  and (
    coalesce(payload->'basic'->>'kanri','')<>management_number
    or coalesce(payload->'ledger'->>'accountingYear','')<>'2024'
  );

commit;
