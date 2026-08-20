export type JobRecord = {
  id: number;
  division: string | null;
  dispatchDate: string | null;
  address: string | null;
  workOrder: string | null;
  installer: string | null;
  projectManager: string | null;
  subdivision: string | null;
  installScope: string | null;
  service: boolean;
  builder: string | null;
  templateDate: string | null;
  dueDate: string | null;
  onTime: boolean | null;
};

export type RangeMetrics = {
  total: number;
  installCount: number;
  serviceCount: number;
  ratedCount: number;
  onTimeCount: number;
  lateCount: number;
  pendingCount: number;
  needsReview: number;
  onTimeRate: number | null;
};

export type BreakdownItem = {
  label: string;
  count: number;
  ratedCount: number;
  onTimeRate: number | null;
};

export type DailyItem = {
  date: string;
  total: number;
  onTime: number;
  late: number;
  pending: number;
  onTimeRate: number | null;
};

export type JobAnalytics = {
  byInstaller: BreakdownItem[];
  bySubdivision: BreakdownItem[];
  byBuilder: BreakdownItem[];
  byProjectManager: BreakdownItem[];
  scopeMix: Array<{ label: string; count: number }>;
  daily: DailyItem[];
};

export type JobsResponse = {
  jobs: JobRecord[];
  total: number;
  metrics: RangeMetrics;
  analytics: JobAnalytics;
  dateRange: { from: string | null; to: string | null };
  error?: string;
};
