alter table public.driver_documents
  add column if not exists review_notes text;

comment on column public.driver_documents.review_notes is
  'Admin feedback explaining why a driver document was rejected and what replacement is required.';
