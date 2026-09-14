import type { JobRecord } from "../lib/job-types";
import baseJobs from "./jobs.json";
import august24Jobs from "./jobs-2026-08-24.json";
import august25Jobs from "./jobs-2026-08-25.json";
import august26Jobs from "./jobs-2026-08-26.json";
import august27Jobs from "./jobs-2026-08-27.json";
import august28Jobs from "./jobs-2026-08-28.json";
import august31Jobs from "./jobs-2026-08-31.json";
import september1Jobs from "./jobs-2026-09-01.json";
import september2Jobs from "./jobs-2026-09-02.json";
import september3Jobs from "./jobs-2026-09-03.json";
import september4Jobs from "./jobs-2026-09-04.json";
import september8Jobs from "./jobs-2026-09-08.json";
import september9Jobs from "./jobs-2026-09-09.json";
import september10Jobs from "./jobs-2026-09-10.json";
import september11Jobs from "./jobs-2026-09-11.json";

export const sourceJobs = [
  ...(baseJobs as JobRecord[]),
  ...(august24Jobs as JobRecord[]),
  ...(august25Jobs as JobRecord[]),
  ...(august26Jobs as JobRecord[]),
  ...(august27Jobs as JobRecord[]),
  ...(august28Jobs as JobRecord[]),
  ...(august31Jobs as JobRecord[]),
  ...(september1Jobs as JobRecord[]),
  ...(september2Jobs as JobRecord[]),
  ...(september3Jobs as JobRecord[]),
  ...(september4Jobs as JobRecord[]),
  ...(september8Jobs as JobRecord[]),
  ...(september9Jobs as JobRecord[]),
  ...(september10Jobs as JobRecord[]),
  ...(september11Jobs as JobRecord[]),
];
