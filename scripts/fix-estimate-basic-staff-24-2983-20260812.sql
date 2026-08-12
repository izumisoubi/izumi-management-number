-- 全件監査で見つかった、24-2983 の見積基本情報「工事担当者」空欄を補正する。
-- 更新前の payload は安全表に保存し、同じスクリプトを再実行しても重複保存しない。

begin;

create table if not exists public.safety_fix_estimate_basic_staff_20260812 (
  management_number text primary key,
  payload jsonb not null,
  revision integer not null,
  backed_up_at timestamptz not null default now()
);

insert into public.safety_fix_estimate_basic_staff_20260812(
  management_number,
  payload,
  revision
)
select management_number,payload,revision
from public.estimate_projects
where management_number='24-2983'
  and deleted_at is null
on conflict(management_number) do nothing;

update public.estimate_projects
set payload=jsonb_set(payload,'{basic,staff}',to_jsonb('飯田'::text),true),
    revision=revision+1,
    updated_at=now()
where management_number='24-2983'
  and deleted_at is null
  and coalesce(payload->'basic'->>'staff','')='';

commit;
