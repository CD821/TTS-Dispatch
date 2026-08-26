import type { JobRecord } from "../lib/job-types";
import baseJobs from "./jobs.json";
import august24Jobs from "./jobs-2026-08-24.json";
import august25Jobs from "./jobs-2026-08-25.json";

export const sourceJobs = [
  ...(baseJobs as JobRecord[]),
  ...(august24Jobs as JobRecord[]),
  ...(august25Jobs as JobRecord[]),
];
