import { neon } from "@neondatabase/serverless";
import type { JobRecord } from "../app/lib/job-types";

export type StoredJobRow = {
  id: string | number;
  division: string;
  dispatch_date: string;
  address: string;
  work_order: string | null;
  installer: string | null;
  project_manager: string | null;
  subdivision: string | null;
  install_scope: string | null;
  service: boolean;
  builder: string | null;
  template_date: string | null;
  due_date: string | null;
  on_time: boolean | null;
};

let schemaReady: Promise<void> | null = null;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Connect Neon in Vercel, then redeploy.");
  }
  return neon(databaseUrl);
}

export async function ensureJobsSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
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
        )
      `;
      await sql`CREATE INDEX IF NOT EXISTS idx_jobs_dispatch_date ON jobs(dispatch_date)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_jobs_dispatch_installer ON jobs(dispatch_date, installer)`;
    })();
  }
  await schemaReady;
}

export async function listStoredJobs(): Promise<StoredJobRow[]> {
  await ensureJobsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id::text AS id,
      division,
      dispatch_date::text AS dispatch_date,
      address,
      work_order,
      installer,
      project_manager,
      subdivision,
      install_scope,
      service,
      builder,
      template_date::text AS template_date,
      due_date::text AS due_date,
      on_time
    FROM jobs
    ORDER BY dispatch_date DESC, id DESC
  `;
  return rows as unknown as StoredJobRow[];
}

export async function saveStoredJob(job: JobRecord, userId: string) {
  await ensureJobsSchema();
  const sql = getSql();
  await sql`
    INSERT INTO jobs (
      id, division, dispatch_date, address, work_order, installer, project_manager,
      subdivision, install_scope, service, builder, template_date, due_date, on_time,
      created_by, updated_by, updated_at
    ) VALUES (
      ${job.id}, ${job.division}, ${job.dispatchDate}, ${job.address}, ${job.workOrder},
      ${job.installer}, ${job.projectManager}, ${job.subdivision}, ${job.installScope},
      ${job.service}, ${job.builder}, ${job.templateDate}, ${job.dueDate}, ${job.onTime},
      ${userId}, ${userId}, CURRENT_TIMESTAMP
    )
    ON CONFLICT (id) DO UPDATE SET
      division = EXCLUDED.division,
      dispatch_date = EXCLUDED.dispatch_date,
      address = EXCLUDED.address,
      work_order = EXCLUDED.work_order,
      installer = EXCLUDED.installer,
      project_manager = EXCLUDED.project_manager,
      subdivision = EXCLUDED.subdivision,
      install_scope = EXCLUDED.install_scope,
      service = EXCLUDED.service,
      builder = EXCLUDED.builder,
      template_date = EXCLUDED.template_date,
      due_date = EXCLUDED.due_date,
      on_time = EXCLUDED.on_time,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `;
}
