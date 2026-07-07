-- Run this in the Supabase SQL editor (or via `supabase db push`) against a
-- fresh project. Mirrors src/database/schema.ts exactly (architecture doc
-- v4.1 §3), with a user_id column added per table for Row Level Security.
-- Anonymous Auth (src/remote/supabaseClient.ts) is used, so `user_id` is the
-- anonymous auth.uid() — each device gets its own isolated rows.

create table if not exists projects (
  id text primary key,
  user_id uuid not null references auth.users(id),
  title text not null,
  date text not null,
  status text not null,
  settings jsonb not null,
  cover_image_uri text,
  latest_version_id text,
  published_version_id text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_projects_user on projects(user_id);

create table if not exists tracks (
  id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  type text not null,
  order_index integer not null,
  created_at timestamptz not null
);
create index if not exists idx_tracks_project on tracks(project_id);

create table if not exists assets (
  id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  media_type text not null,
  local_uri text not null,
  remote_uri text,
  duration double precision not null,
  fps double precision not null,
  width integer not null,
  height integer not null,
  thumbnail_uri text not null,
  poster_frame_uri text not null,
  sync_status text not null,
  created_at timestamptz not null
);
create index if not exists idx_assets_project on assets(project_id);

create table if not exists clips (
  id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  track_id text not null references tracks(id),
  asset_id text not null references assets(id),
  order_index integer not null,
  trim_start double precision not null,
  trim_end double precision not null,
  effects jsonb not null,
  rotation double precision not null,
  crop jsonb,
  transform jsonb,
  visibility text not null,
  deleted_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_clips_project_track_order on clips(project_id, track_id, order_index);
create index if not exists idx_clips_asset on clips(asset_id);

create table if not exists export_versions (
  id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  version_number integer not null,
  local_uri text,
  remote_uri text,
  thumbnail_uri text,
  status text not null,
  composition_snapshot jsonb not null,
  settings_snapshot jsonb not null,
  sync_status text not null,
  created_at timestamptz not null,
  completed_at timestamptz
);
create index if not exists idx_export_versions_project on export_versions(project_id);

create table if not exists sync_queue (
  task_id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  target_id text not null,
  type text not null,
  status text not null,
  priority integer not null,
  retry_count integer not null,
  last_error text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_sync_queue_status_priority on sync_queue(status, priority);

create table if not exists ai_jobs (
  id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  type text not null,
  status text not null,
  progress double precision not null,
  priority integer not null,
  worker_version text,
  started_at timestamptz,
  finished_at timestamptz,
  result jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null
);
create index if not exists idx_ai_jobs_project on ai_jobs(project_id);

create table if not exists caption_cues (
  id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  track_id text not null references tracks(id),
  export_version_id text not null references export_versions(id),
  text text not null,
  start_ms double precision not null,
  end_ms double precision not null,
  order_index integer not null,
  created_at timestamptz not null
);
create index if not exists idx_caption_cues_project on caption_cues(project_id, order_index);

create table if not exists events (
  id text primary key,
  user_id uuid not null references auth.users(id),
  project_id text not null references projects(id),
  type text not null,
  payload jsonb not null,
  device_time timestamptz not null,
  app_version text not null,
  os_version text not null,
  created_at timestamptz not null
);
create index if not exists idx_events_project_created on events(project_id, created_at);

-- Row Level Security: each anonymous user only ever sees their own rows.
alter table projects enable row level security;
alter table tracks enable row level security;
alter table assets enable row level security;
alter table clips enable row level security;
alter table export_versions enable row level security;
alter table sync_queue enable row level security;
alter table ai_jobs enable row level security;
alter table caption_cues enable row level security;
alter table events enable row level security;

create policy "own rows only" on projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on tracks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on assets for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on clips for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on export_versions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on sync_queue for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on ai_jobs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on caption_cues for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows only" on events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Storage bucket: projects/{projectId}/{clips|exports|thumbnails}/... + metadata.json
insert into storage.buckets (id, name, public) values ('vlog-projects', 'vlog-projects', false)
on conflict (id) do nothing;

create policy "own storage objects only" on storage.objects for all
  using (bucket_id = 'vlog-projects' and (storage.foldername(name))[1] in (
    select id from projects where user_id = auth.uid()
  ))
  with check (bucket_id = 'vlog-projects' and (storage.foldername(name))[1] in (
    select id from projects where user_id = auth.uid()
  ));
