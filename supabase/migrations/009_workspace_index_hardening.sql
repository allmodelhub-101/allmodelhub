create index if not exists generation_jobs_project_fk_idx on public.generation_jobs(project_id) where project_id is not null;
create index if not exists asset_favorites_job_idx on public.asset_favorites(job_id) where job_id is not null;
create index if not exists asset_favorites_file_idx on public.asset_favorites(file_id) where file_id is not null;

