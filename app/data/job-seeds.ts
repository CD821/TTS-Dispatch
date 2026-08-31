import type { JobRecord } from "../lib/job-types";
import baseJobs from "./jobs.json";
import august24Jobs from "./jobs-2026-08-24.json";
import august25Jobs from "./jobs-2026-08-25.json";
import august26Jobs from "./jobs-2026-08-26.json";
import august27Jobs from "./jobs-2026-08-27.json";
import august28Jobs from "./jobs-2026-08-28.json";

export const sourceJobs = [
  ...(baseJobs as JobRecord[]),
  ...(august24Jobs as JobRecord[]),
  ...(august25Jobs as JobRecord[]),
  ...(august26Jobs as JobRecord[]),
  ...(august27Jobs as JobRecord[]),
  ...(august28Jobs as JobRecord[]),
];
