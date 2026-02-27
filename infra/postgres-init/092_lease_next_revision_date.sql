alter table leases
  add column if not exists next_revision_date date null;

-- backfill: si IRL enabled -> start_date + 1 an
update leases
set next_revision_date = (start_date::date + interval '1 year')::date
where next_revision_date is null
  and lease_terms #>> '{irlIndexation,enabled}' = 'true';
  and coalesce(lease_terms #>> '{irlIndexation,enabled}', 'false') = 'true'