-- Keep a car applicant's request for Lotty Women separate from general driver approval.
begin;
alter table public.driver_profiles
  add column if not exists women_service_requested boolean not null default false;
comment on column public.driver_profiles.women_service_requested is
  'Whether a car applicant has requested separate Lotty Women eligibility review. Does not affect normal driver approval or ride eligibility.';
commit;
