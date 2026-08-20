import type { Metadata } from "next";
import DispatchApp from "./DispatchApp";
import seedJobs from "./data/jobs.json";
import { summarizeJobs } from "./lib/job-analytics";
import type { JobDirectories, JobRecord } from "./lib/job-types";

export const metadata: Metadata = {
  title: "Dispatch | TTS",
  description: "A calm, clear dispatch workspace for installs and services.",
};

const jobs = seedJobs as JobRecord[];

const distinct = (values: Array<string | null>) => [
  ...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))),
].sort((first, second) => first.localeCompare(second, "en-US", { sensitivity: "base" }));

const toIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Home() {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const initialFrom = toIso(monday);
  const initialTo = toIso(sunday);
  const initialJobs = jobs
    .filter((job) => job.dispatchDate && job.dispatchDate >= initialFrom && job.dispatchDate <= initialTo)
    .sort((a, b) =>
      (a.dispatchDate ?? "").localeCompare(b.dispatchDate ?? "") ||
      (a.address ?? "").localeCompare(b.address ?? ""),
    );
  const directories: JobDirectories = {
    installers: distinct(jobs.map((job) => job.installer)),
    projectManagers: distinct(jobs.map((job) => job.projectManager)),
    builders: distinct(jobs.map((job) => job.builder)),
    subdivisions: distinct(jobs.map((job) => job.subdivision)),
  };
  const initialSummary = summarizeJobs(initialJobs, initialFrom, initialTo);

  return (
    <DispatchApp
      initialFrom={initialFrom}
      initialTo={initialTo}
      initialJobs={initialJobs}
      initialDirectories={directories}
      initialSummary={initialSummary}
    />
  );
}
