alter table leases
  add column if not exists next_revision_date date null;