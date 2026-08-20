import type { Metadata } from "next";
import DispatchApp from "./DispatchApp";
import seedJobs from "./data/jobs.json";
import { summarizeJobs } from "./lib/job-analytics";
import type { JobRecord } from "./lib/job-types";

export const metadata: Metadata = {
  title: "Dispatch | TTS",
  description: "A calm, clear dispatch workspace for installs and services.",
};

const jobs = seedJobs as JobRecord[];

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
  const installers = [
    ...new Set(jobs.map((job) => job.installer).filter((name): name is string => Boolean(name))),
  ].sort();
  const initialSummary = summarizeJobs(initialJobs, initialFrom, initialTo);

  return (
    <DispatchApp
      initialFrom={initialFrom}
      initialTo={initialTo}
      initialJobs={initialJobs}
      installers={installers}
      initialSummary={initialSummary}
    />
  );
}
