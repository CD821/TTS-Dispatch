"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import InsightsView from "./InsightsView";
import type {
  JobAnalytics,
  JobDirectories,
  JobRecord,
  JobsResponse,
  RangeMetrics,
} from "./lib/job-types";

type Props = {
  initialFrom: string;
  initialTo: string;
  initialJobs: JobRecord[];
  initialDirectories: JobDirectories;
  initialSummary: { metrics: RangeMetrics; analytics: JobAnalytics };
};

type DraftJob = Omit<JobRecord, "id">;
type View = "dispatch" | "insights";
type SortKey = "dispatchDate" | "address" | "service" | "installer" | "templateDate" | "dueDate" | "onTime";
type SortDirection = "ascending" | "descending";

const ADD_NEW_OPTION = "__add_new__";

type DirectorySelectProps = {
  label: string;
  value: string | null;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
};

function DirectorySelect({ label, value, options, placeholder, onChange }: DirectorySelectProps) {
  const [addingNew, setAddingNew] = useState(false);
  const selectOptions = useMemo(() => {
    const current = value?.trim();
    if (!current || options.some((option) => option.toLowerCase() === current.toLowerCase())) return options;
    return [...options, current].sort((first, second) =>
      first.localeCompare(second, "en-US", { sensitivity: "base" }),
    );
  }, [options, value]);

  return (
    <label className="directory-field">
      {label}
      {addingNew ? (
        <div className="directory-new-row">
          <input
            value={value ?? ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={`New ${label.toLowerCase()}`}
          />
          <button type="button" onClick={() => { onChange(""); setAddingNew(false); }}>Back</button>
        </div>
      ) : (
        <select
          value={value ?? ""}
          onChange={(event) => {
            if (event.target.value === ADD_NEW_OPTION) {
              onChange("");
              setAddingNew(true);
              return;
            }
            onChange(event.target.value);
          }}
        >
          <option value="">{placeholder}</option>
          {selectOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          <option value={ADD_NEW_OPTION}>＋ Add new…</option>
        </select>
      )}
    </label>
  );
}

const emptyDraft = (dispatchDate: string): DraftJob => ({
  division: "TTS",
  dispatchDate,
  address: "",
  workOrder: "",
  installer: "",
  projectManager: "",
  subdivision: "",
  installScope: "",
  service: false,
  builder: "",
  templateDate: "",
  dueDate: "",
  onTime: null,
});

const parseDate = (value: string) => new Date(`${value}T12:00:00`);
const toIso = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const formatDate = (value: string | null, options?: Intl.DateTimeFormatOptions) =>
  value
    ? parseDate(value).toLocaleDateString("en-US", options ?? { month: "short", day: "numeric" })
    : null;
const shiftDate = (value: string, amount: number) => {
  const date = parseDate(value);
  date.setDate(date.getDate() + amount);
  return toIso(date);
};
const getWeekRange = (value: string) => {
  const date = parseDate(value);
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toIso(monday), to: toIso(sunday) };
};
const formatRange = (from: string, to: string) => {
  const start = parseDate(from);
  const end = parseDate(to);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
};
const percent = (value: number | null) => value == null ? "—" : `${Math.round(value * 100)}%`;

export default function DispatchApp({
  initialFrom,
  initialTo,
  initialJobs,
  initialDirectories,
  initialSummary,
}: Props) {
  const [activeView, setActiveView] = useState<View>("dispatch");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [jobs, setJobs] = useState(initialJobs);
  const [metrics, setMetrics] = useState(initialSummary.metrics);
  const [analytics, setAnalytics] = useState(initialSummary.analytics);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [installerFilter, setInstallerFilter] = useState("all");
  const [directories, setDirectories] = useState(initialDirectories);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<JobRecord | null>(null);
  const [draft, setDraft] = useState<DraftJob>(() => emptyDraft(initialFrom));
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "dispatchDate",
    direction: "ascending",
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);

  const today = toIso(new Date());
  const currentWeek = getWeekRange(today);
  const rangeLabel = formatRange(from, to);
  const isCurrentWeek = from === currentWeek.from && to === currentWeek.to;
  const sortedJobs = useMemo(() => {
    const valueFor = (job: JobRecord, key: SortKey): string | number | null => {
      if (key === "service") return job.service ? "Service" : "Install";
      if (key === "onTime") return job.onTime == null ? null : job.onTime ? "On time" : "Late";
      return job[key];
    };
    return [...jobs].sort((first, second) => {
      const firstValue = valueFor(first, sort.key);
      const secondValue = valueFor(second, sort.key);
      if (firstValue == null && secondValue == null) return 0;
      if (firstValue == null) return 1;
      if (secondValue == null) return -1;
      const comparison = typeof firstValue === "number" && typeof secondValue === "number"
        ? firstValue - secondValue
        : String(firstValue).localeCompare(String(secondValue), "en-US", { numeric: true, sensitivity: "base" });
      return sort.direction === "ascending" ? comparison : -comparison;
    });
  }, [jobs, sort]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && activeView === "dispatch") {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchRef.current?.focus(), 0);
      }
      if (event.key === "Escape") {
        setModalOpen(false);
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeView]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ from, to });
        if (query.trim()) params.set("q", query.trim());
        if (typeFilter !== "all") params.set("type", typeFilter);
        if (scopeFilter !== "all") params.set("scope", scopeFilter);
        if (installerFilter !== "all") params.set("installer", installerFilter);
        const response = await fetch(`/api/jobs?${params}`, { signal: controller.signal });
        const data = (await response.json()) as Partial<JobsResponse>;
        if (!response.ok || !data.jobs || !data.metrics || !data.analytics) {
          throw new Error(data.error ?? "Unable to load jobs.");
        }
        setJobs(data.jobs);
        setMetrics(data.metrics);
        setAnalytics(data.analytics);
        if (data.directories) setDirectories(data.directories);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setMessage("The shared data is reconnecting. Your current view is still available.");
        }
      } finally {
        setLoading(false);
      }
    }, query ? 220 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [from, to, query, typeFilter, scopeFilter, installerFilter, refreshKey]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!modalOpen) return;
    const timer = window.setTimeout(() => addressRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [modalOpen]);

  const changeView = (view: View) => {
    setActiveView(view);
    if (view === "insights") {
      setQuery("");
      setSearchOpen(false);
    }
  };

  const changeFrom = (value: string) => {
    if (!value) return;
    setFrom(value);
    if (value > to) setTo(value);
  };

  const changeTo = (value: string) => {
    if (!value) return;
    setTo(value);
    if (value < from) setFrom(value);
  };

  const shiftRange = (amount: number) => {
    setFrom((value) => shiftDate(value, amount * 7));
    setTo((value) => shiftDate(value, amount * 7));
    setQuery("");
  };

  const toggleSort = (key: SortKey) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending",
    }));
  };

  const getExportUrl = () => {
    const params = new URLSearchParams({ from, to, format: "xls" });
    if (query.trim()) params.set("q", query.trim());
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (scopeFilter !== "all") params.set("scope", scopeFilter);
    if (installerFilter !== "all") params.set("installer", installerFilter);
    return `/api/jobs?${params}`;
  };

  const sortHeader = (key: SortKey, label: string, title?: string) => (
    <th aria-sort={sort.key === key ? sort.direction : "none"} title={title}>
      <button className="sort-button" type="button" onClick={() => toggleSort(key)}>
        {label}<span aria-hidden="true">{sort.key === key ? sort.direction === "ascending" ? "↑" : "↓" : "↕"}</span>
      </button>
    </th>
  );

  const openAdd = () => {
    setEditing(null);
    setDraft(emptyDraft(today >= from && today <= to ? today : from));
    setModalOpen(true);
  };

  const openEdit = (job: JobRecord) => {
    setEditing(job);
    setDraft({
      division: job.division,
      dispatchDate: job.dispatchDate,
      address: job.address,
      workOrder: job.workOrder,
      installer: job.installer,
      projectManager: job.projectManager,
      subdivision: job.subdivision,
      installScope: job.installScope,
      service: job.service,
      builder: job.builder,
      templateDate: job.templateDate,
      dueDate: job.dueDate,
      onTime: job.onTime,
    });
    setModalOpen(true);
  };

  const updateDraft = <K extends keyof DraftJob>(key: K, value: DraftJob[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const saveJob = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch(editing ? `/api/jobs/${editing.id}` : "/api/jobs", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as { job?: JobRecord; error?: string };
      if (!response.ok || !data.job) throw new Error(data.error ?? "Unable to save this job.");
      setModalOpen(false);
      setQuery("");
      setRefreshKey((value) => value + 1);
      setMessage(editing ? "Job updated for the whole team." : "Job added to dispatch.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save this job.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="topbar-title"><Image className="app-logo" src="/app-icon.png" alt="" width={46} height={46} priority /><div><p className="eyebrow">OPERATIONS</p><h1>{activeView === "dispatch" ? "Dispatch" : "Insights"}</h1></div></div>
          <div className="top-actions">
            {activeView === "dispatch" && searchOpen ? (
              <label className="search-field">
                <span>⌕</span>
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search this date range…"
                  aria-label="Search jobs in this date range"
                />
                <button type="button" onClick={() => { setQuery(""); setSearchOpen(false); }} aria-label="Close search">×</button>
              </label>
            ) : activeView === "dispatch" ? (
              <button className="search-button" onClick={() => { setSearchOpen(true); window.setTimeout(() => searchRef.current?.focus(), 0); }} aria-label="Search jobs">
                <span>⌕</span> Search <kbd>⌘ K</kbd>
              </button>
            ) : null}
            <a className="export-button" href={getExportUrl()}>⇩ Export Excel</a>
            <button className="primary-button" onClick={openAdd}>＋ Add job</button>
            <div className="account-control">
              <Show when="signed-in"><UserButton /></Show>
              <Show when="signed-out"><SignInButton><button className="sign-in-button" type="button">Sign in</button></SignInButton></Show>
            </div>
          </div>
        </header>

        <div className="view-tabs" role="tablist" aria-label="Workspace view">
          <button type="button" role="tab" aria-selected={activeView === "dispatch"} className={activeView === "dispatch" ? "active" : ""} onClick={() => changeView("dispatch")}>Dispatch</button>
          <button type="button" role="tab" aria-selected={activeView === "insights"} className={activeView === "insights" ? "active" : ""} onClick={() => changeView("insights")}>Insights</button>
        </div>

        <section className="range-toolbar" aria-label="Report filters">
          <div className="range-controls">
            <button className="week-step" type="button" onClick={() => shiftRange(-1)} aria-label="Previous week">‹</button>
            <label><span>From</span><input type="date" value={from} onChange={(event) => changeFrom(event.target.value)} /></label>
            <span className="range-divider">to</span>
            <label><span>To</span><input type="date" value={to} onChange={(event) => changeTo(event.target.value)} /></label>
            <button className="week-step" type="button" onClick={() => shiftRange(1)} aria-label="Next week">›</button>
            <button className={`this-week ${isCurrentWeek ? "active" : ""}`} type="button" onClick={() => { setFrom(currentWeek.from); setTo(currentWeek.to); setQuery(""); }}>This week</button>
          </div>
          <div className="global-filters">
            <span>{rangeLabel}</span>
            <label><span className="sr-only">Work type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="all">All work</option><option value="install">Installs</option><option value="service">Services</option></select></label>
            <label><span className="sr-only">House scope</span><select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)}><option value="all">All scopes</option><option value="full-house">Full house</option><option value="partial">Partial</option></select></label>
            <label><span className="sr-only">Installer</span><select value={installerFilter} onChange={(event) => setInstallerFilter(event.target.value)}><option value="all">All installers</option>{directories.installers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          </div>
        </section>

        {activeView === "dispatch" ? (
          <>
            <section className="summary-grid" aria-label="Dispatch summary">
              <article className="summary-card hero-card">
                <div><p>{query ? "Search results" : rangeLabel}</p><strong>{metrics.total}</strong><span>{query ? "matching jobs" : "jobs dispatched"}</span></div>
                <div className="mini-stack" aria-label={`${metrics.installCount} installs and ${metrics.serviceCount} services`}>
                  <span style={{ width: `${Math.max(24, metrics.total ? (metrics.installCount / metrics.total) * 100 : 24)}%` }}>{metrics.installCount} installs</span>
                  <span className="service-bar" style={{ width: `${Math.max(22, metrics.total ? (metrics.serviceCount / metrics.total) * 100 : 22)}%` }}>{metrics.serviceCount} services</span>
                </div>
              </article>
              <article className="summary-card metric-card">
                <p>On-time for this range</p><strong>{percent(metrics.onTimeRate)}</strong><span className={metrics.onTimeRate != null && metrics.onTimeRate >= .9 ? "positive" : ""}>{metrics.ratedCount ? `${metrics.onTimeCount} of ${metrics.ratedCount} rated jobs` : "No OT ratings entered"}</span>
              </article>
              <article className="summary-card metric-card">
                <p>Needs review</p><strong>{metrics.needsReview}</strong><span>Missing OT status</span>
              </article>
            </section>

            <section className="jobs-panel">
              <div className="panel-heading">
                <div>
                  <h2>{query ? `Results for “${query}”` : `${rangeLabel} jobs`}</h2>
                </div>
              </div>

              <div className={`table-wrap ${loading ? "loading" : ""}`}>
                <table>
                  <thead><tr>{sortHeader("dispatchDate", "Dispatch")}{sortHeader("address", "Job")}{sortHeader("service", "Type")}{sortHeader("installer", "Installer")}{sortHeader("templateDate", "Template", "Date the job was templated")}{sortHeader("dueDate", "Due date", "Original install date")}{sortHeader("onTime", "OT", "Manually marked on-time status")}<th aria-label="More actions" /></tr></thead>
                  <tbody>
                    {sortedJobs.map((job) => (
                      <tr key={job.id}>
                        <td><span className="dispatch-date">{formatDate(job.dispatchDate, { weekday: "short", month: "short", day: "numeric" }) || "—"}</span></td>
                        <td><strong>{job.address || "Untitled job"}</strong><span>{[job.workOrder, job.builder, job.installScope].filter(Boolean).join(" · ") || "Details not entered"}</span></td>
                        <td><span className={`type-pill ${job.service ? "service" : ""}`}>{job.service ? "Service" : "Install"}</span></td>
                        <td><span className="installer-cell"><i>{(job.installer || "—").slice(0, 2)}</i>{job.installer || "Unassigned"}</span></td>
                        <td><span className={job.templateDate ? "date-value" : "muted-value"}>{formatDate(job.templateDate) || "Not entered"}</span></td>
                        <td><span className={job.dueDate ? "date-value" : "muted-value"}>{formatDate(job.dueDate) || "Not entered"}</span></td>
                        <td><span className={`status-pill ${job.onTime == null ? "pending" : job.onTime ? "on-time" : "late"}`}>{job.onTime == null ? "Pending" : job.onTime ? "On time" : "Late"}</span></td>
                        <td><button className="more-button" onClick={() => openEdit(job)} aria-label={`Edit ${job.address}`}>•••</button></td>
                      </tr>
                    ))}
                    {!jobs.length && !loading ? (
                      <tr><td className="empty-state" colSpan={8}><strong>No jobs in this range.</strong><span>Choose another date range or add the first dispatch.</span><button type="button" onClick={openAdd}>Add job</button></td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <InsightsView analytics={analytics} metrics={metrics} rangeLabel={rangeLabel} loading={loading} />
        )}
      </section>

      {modalOpen ? (
        <div className="modal-backdrop">
          <button className="modal-dismiss" type="button" aria-label="Close job editor" onClick={() => setModalOpen(false)} />
          <section className="job-modal" role="dialog" aria-modal="true" aria-labelledby="job-modal-title">
            <header><div><p className="eyebrow">{editing ? "EDIT DISPATCH" : "NEW DISPATCH"}</p><h2 id="job-modal-title">{editing ? "Update job" : "Add a job"}</h2></div><button type="button" onClick={() => setModalOpen(false)} aria-label="Close">×</button></header>
            <form onSubmit={saveJob}>
              <div className="form-grid">
                <label className="span-two">Address<span>Job site</span><input ref={addressRef} required value={draft.address ?? ""} onChange={(event) => updateDraft("address", event.target.value)} placeholder="e.g. 31010 Peony Place" /></label>
                <label>Dispatch date<span>Leaves the shop</span><input required type="date" value={draft.dispatchDate ?? ""} onChange={(event) => updateDraft("dispatchDate", event.target.value)} /></label>
                <label>Work type<span>Install or service</span><select value={draft.service ? "service" : "install"} onChange={(event) => updateDraft("service", event.target.value === "service")}><option value="install">Install</option><option value="service">Service</option></select></label>
                <label>Work order<input value={draft.workOrder ?? ""} onChange={(event) => updateDraft("workOrder", event.target.value)} placeholder="HC014115" /></label>
                <label>Division<select value={draft.division ?? "TTS"} onChange={(event) => updateDraft("division", event.target.value)}><option>TTS</option><option>BESPOKE</option></select></label>
                <DirectorySelect label="Installer" value={draft.installer} options={directories.installers} placeholder="Assign installer" onChange={(value) => updateDraft("installer", value)} />
                <DirectorySelect label="Project manager" value={draft.projectManager} options={directories.projectManagers} placeholder="Choose project manager" onChange={(value) => updateDraft("projectManager", value)} />
                <DirectorySelect label="Builder" value={draft.builder} options={directories.builders} placeholder="Choose builder" onChange={(value) => updateDraft("builder", value)} />
                <DirectorySelect label="Subdivision" value={draft.subdivision} options={directories.subdivisions} placeholder="Choose subdivision" onChange={(value) => updateDraft("subdivision", value)} />
                <label className="span-two">Scope<input value={draft.installScope ?? ""} onChange={(event) => updateDraft("installScope", event.target.value)} placeholder="Full house, kitchen, master bath…" /></label>
                <label>Template date<span>Date template was completed</span><input type="date" value={draft.templateDate ?? ""} onChange={(event) => updateDraft("templateDate", event.target.value)} /></label>
                <label>Due date<span>Original install date</span><input type="date" value={draft.dueDate ?? ""} onChange={(event) => updateDraft("dueDate", event.target.value)} /></label>
                <label className="span-two">OT status<select value={draft.onTime == null ? "pending" : draft.onTime ? "on-time" : "late"} onChange={(event) => updateDraft("onTime", event.target.value === "pending" ? null : event.target.value === "on-time")}><option value="pending">Pending</option><option value="on-time">On time</option><option value="late">Late</option></select></label>
              </div>
              <footer><button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add to dispatch"}</button></footer>
            </form>
          </section>
        </div>
      ) : null}

      {message ? <div className="toast" role="status">{message}</div> : null}
    </main>
  );
}
