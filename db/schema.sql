CREATE TABLE IF NOT EXISTS jobs (
  id BIGINT PRIMARY KEY,
  division TEXT NOT NULL DEFAULT 'TTS',
  dispatch_date DATE NOT NULL,
  address TEXT NOT NULL,
  work_order TEXT,
  installer TEXT,
  project_manager TEXT,
  subdivision TEXT,
  install_scope TEXT,
  service BOOLEAN NOT NULL DEFAULT FALSE,
  builder TEXT,
  template_date DATE,
  due_date DATE,
  on_time BOOLEAN,
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_dispatch_date ON jobs(dispatch_date);
CREATE INDEX IF NOT EXISTS idx_jobs_dispatch_installer ON jobs(dispatch_date, installer);
