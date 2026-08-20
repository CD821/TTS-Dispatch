import type {
  BreakdownItem,
  DailyItem,
  JobAnalytics,
  JobRecord,
  RangeMetrics,
} from "./job-types";

const addDays = (iso: string, amount: number) => {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
};

const rate = (onTime: number, rated: number) => (rated ? onTime / rated : null);

function breakdown(jobs: JobRecord[], pick: (job: JobRecord) => string | null): BreakdownItem[] {
  const groups = new Map<string, JobRecord[]>();
  for (const job of jobs) {
    const label = pick(job)?.trim() || "Unassigned";
    const group = groups.get(label) ?? [];
    group.push(job);
    groups.set(label, group);
  }
  return [...groups.entries()]
    .map(([label, group]) => {
      const rated = group.filter((job) => job.onTime != null);
      const onTime = rated.filter((job) => job.onTime).length;
      return { label, count: group.length, ratedCount: rated.length, onTimeRate: rate(onTime, rated.length) };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function summarizeJobs(jobs: JobRecord[], from: string | null, to: string | null) {
  const rated = jobs.filter((job) => job.onTime != null);
  const onTimeCount = rated.filter((job) => job.onTime).length;
  const metrics: RangeMetrics = {
    total: jobs.length,
    installCount: jobs.filter((job) => !job.service).length,
    serviceCount: jobs.filter((job) => job.service).length,
    ratedCount: rated.length,
    onTimeCount,
    lateCount: rated.length - onTimeCount,
    pendingCount: jobs.length - rated.length,
    needsReview: jobs.filter((job) => job.onTime == null).length,
    onTimeRate: rate(onTimeCount, rated.length),
  };

  const dailyByDate = new Map<string, JobRecord[]>();
  for (const job of jobs) {
    if (!job.dispatchDate) continue;
    const group = dailyByDate.get(job.dispatchDate) ?? [];
    group.push(job);
    dailyByDate.set(job.dispatchDate, group);
  }

  const dates: string[] = [];
  if (from && to) {
    for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) dates.push(cursor);
  } else {
    dates.push(...[...dailyByDate.keys()].sort());
  }
  const daily: DailyItem[] = dates.map((date) => {
    const group = dailyByDate.get(date) ?? [];
    const dayRated = group.filter((job) => job.onTime != null);
    const dayOnTime = dayRated.filter((job) => job.onTime).length;
    return {
      date,
      total: group.length,
      onTime: dayOnTime,
      late: dayRated.length - dayOnTime,
      pending: group.length - dayRated.length,
      onTimeRate: rate(dayOnTime, dayRated.length),
    };
  });

  const fullHouseCount = jobs.filter((job) =>
    (job.installScope ?? "").toUpperCase().includes("FULL HOUSE"),
  ).length;
  const analytics: JobAnalytics = {
    byInstaller: breakdown(jobs, (job) => job.installer),
    bySubdivision: breakdown(jobs, (job) => job.subdivision),
    byBuilder: breakdown(jobs, (job) => job.builder),
    byProjectManager: breakdown(jobs, (job) => job.projectManager),
    scopeMix: [
      { label: "Full house", count: fullHouseCount },
      { label: "Partial / other", count: jobs.length - fullHouseCount },
    ],
    daily,
  };

  return { metrics, analytics };
}
