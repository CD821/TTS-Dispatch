import type { BreakdownItem, JobAnalytics, RangeMetrics } from "./lib/job-types";

type Props = {
  analytics: JobAnalytics;
  metrics: RangeMetrics;
  rangeLabel: string;
  loading: boolean;
};

const percent = (value: number | null) => value == null ? "—" : `${Math.round(value * 100)}%`;

function RankedBars({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: BreakdownItem[];
}) {
  const visible = items.slice(0, 8);
  const maximum = Math.max(1, ...visible.map((item) => item.count));
  return (
    <article className="chart-card">
      <header><div><h3>{title}</h3><p>{subtitle}</p></div><span>Top {Math.min(8, items.length)}</span></header>
      {visible.length ? (
        <div className="ranked-bars">
          {visible.map((item) => (
            <div className="ranked-row" key={item.label} title={`${item.label}: ${item.count} jobs`}>
              <div className="ranked-copy">
                <strong>{item.label}</strong>
                <span>{item.ratedCount ? `${percent(item.onTimeRate)} on time · ${item.ratedCount} rated` : "No OT ratings"}</span>
              </div>
              <div className="ranked-track"><i style={{ width: `${(item.count / maximum) * 100}%` }} /></div>
              <b>{item.count}</b>
            </div>
          ))}
        </div>
      ) : <div className="chart-empty">No jobs in this date range.</div>}
    </article>
  );
}

function MixCard({
  title,
  subtitle,
  items,
  classes,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; count: number }>;
  classes: string[];
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  return (
    <article className="chart-card mix-card">
      <header><div><h3>{title}</h3><p>{subtitle}</p></div><strong>{total}</strong></header>
      <div className="mix-bar" aria-label={items.map((item) => `${item.label}: ${item.count}`).join(", ")}>
        {items.map((item, index) => (
          <span
            className={classes[index] ?? ""}
            key={item.label}
            style={{ width: `${total ? (item.count / total) * 100 : 0}%` }}
          />
        ))}
      </div>
      <div className="mix-legend">
        {items.map((item, index) => (
          <div key={item.label}><i className={classes[index] ?? ""} /><span>{item.label}</span><strong>{item.count}</strong><small>{total ? Math.round((item.count / total) * 100) : 0}%</small></div>
        ))}
      </div>
    </article>
  );
}

function DailyDeliveryChart({ analytics, rangeLabel }: { analytics: JobAnalytics; rangeLabel: string }) {
  const maximum = Math.max(1, ...analytics.daily.map((item) => item.total));
  return (
    <article className="chart-card daily-card">
      <header>
        <div><h3>On-time delivery by dispatch day</h3><p>{rangeLabel}</p></div>
        <div className="chart-legend"><span className="on-time">On time</span><span className="late">Late</span><span className="pending">Pending</span></div>
      </header>
      {analytics.daily.length ? (
        <div className="daily-scroll">
          <div className="daily-chart" style={{ minWidth: `${Math.max(560, analytics.daily.length * 54)}px` }}>
            {analytics.daily.map((item) => (
              <div className="daily-column" key={item.date} title={`${item.date}: ${item.total} jobs, ${item.onTime} on time, ${item.late} late, ${item.pending} pending`}>
                <b>{item.total || ""}</b>
                <div className="day-bar-scale">
                  {item.total ? (
                    <div className="day-bar-total" style={{ height: `${Math.max(5, (item.total / maximum) * 100)}%` }}>
                      <span className="pending" style={{ height: `${(item.pending / item.total) * 100}%` }} />
                      <span className="late" style={{ height: `${(item.late / item.total) * 100}%` }} />
                      <span className="on-time" style={{ height: `${(item.onTime / item.total) * 100}%` }} />
                    </div>
                  ) : <i />}
                </div>
                <span>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}</span>
              </div>
            ))}
          </div>
        </div>
      ) : <div className="chart-empty">No jobs in this date range.</div>}
    </article>
  );
}

export default function InsightsView({ analytics, metrics, rangeLabel, loading }: Props) {
  return (
    <section className={`insights-view ${loading ? "loading" : ""}`} aria-label="Dispatch insights">
      <div className="insight-kpis">
        <article><p>Jobs</p><strong>{metrics.total}</strong><span>{metrics.installCount} installs · {metrics.serviceCount} services</span></article>
        <article><p>On-time</p><strong>{percent(metrics.onTimeRate)}</strong><span>{metrics.onTimeCount} of {metrics.ratedCount} rated jobs</span></article>
        <article><p>Late</p><strong>{metrics.lateCount}</strong><span>Explicitly marked late</span></article>
        <article><p>Awaiting OT</p><strong>{metrics.pendingCount}</strong><span>No OT status entered</span></article>
      </div>

      <div className="chart-grid">
        <DailyDeliveryChart analytics={analytics} rangeLabel={rangeLabel} />
        <MixCard
          title="OT status mix"
          subtitle={`${rangeLabel} · ${metrics.ratedCount} rated jobs`}
          items={[
            { label: "On time", count: metrics.onTimeCount },
            { label: "Late", count: metrics.lateCount },
            { label: "Pending", count: metrics.pendingCount },
          ]}
          classes={["on-time", "late", "pending"]}
        />
        <MixCard
          title="Full house vs partial"
          subtitle={`${rangeLabel} · based on the Install Scope field`}
          items={analytics.scopeMix}
          classes={["full-house", "partial"]}
        />
        <RankedBars title="Jobs by installer" subtitle={rangeLabel} items={analytics.byInstaller} />
        <RankedBars title="Jobs by subdivision" subtitle={rangeLabel} items={analytics.bySubdivision} />
        <RankedBars title="Jobs by builder" subtitle={rangeLabel} items={analytics.byBuilder} />
        <RankedBars title="Jobs by project manager" subtitle={rangeLabel} items={analytics.byProjectManager} />
      </div>
    </section>
  );
}
