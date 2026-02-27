-- 093_fix_lease_next_revision_date_backfill.sql
update leases
set next_revision_date = (start_date::date + interval '1 year')::date
where next_revision_date is null
  and start_date is not null;