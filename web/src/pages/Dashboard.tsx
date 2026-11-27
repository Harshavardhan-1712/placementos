import { Link } from "react-router-dom";
import { api, daysLeft, fmtDay, timeAgo, type Activity } from "../api";
import { Empty, ErrorBox, PageHeader, Spinner, useAsync } from "../ui";

const actorLabel: Record<Activity["actor"], string> = { claude: "Claude", dashboard: "You", student: "Student" };
const actorStyle: Record<Activity["actor"], string> = { claude: "bg-indigo-100 text-indigo-700", dashboard: "bg-slate-100 text-slate-700", student: "bg-emerald-100 text-emerald-700" };

export default function Dashboard() {
  const { data, error, loading, reload } = useAsync(() => api.dashboard(), []);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? "Failed to load"} onRetry={reload} />;
  const t = data.totals;
  const stats = [
    { label: "Total drives", value: t.drives, hint: `${t.draft} draft · ${t.archived} archived` },
    { label: "Published", value: t.published, hint: `${t.activeOpen} open for registration` },
    { label: "Total applicants", value: t.applicants, hint: `${data.applicantsByStatus.selected} selected` },
    { label: "Shortlisted", value: data.applicantsByStatus.shortlisted, hint: `${data.applicantsByStatus.registered} awaiting review` },
  ];
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your campus hiring operations at a glance." actions={<Link to="/drives/new" className="btn-primary">New drive</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4"><p className="text-sm text-slate-500">{s.label}</p><p className="mt-1 text-3xl font-semibold tracking-tight">{s.value}</p><p className="mt-1 text-xs text-slate-500">{s.hint}</p></div>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <section className="card min-w-0 lg:col-span-3">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Upcoming deadlines</h2>
          {data.upcomingDeadlines.length === 0 ? <Empty title="No open registrations" body="Published drives with a future deadline appear here." action={<Link to="/drives/new" className="btn-secondary">Create a drive</Link>} /> : (
            <ul className="divide-y divide-slate-100">
              {data.upcomingDeadlines.map((d) => { const n = daysLeft(d.registrationDeadline); return (
                <li key={d.id}><Link to={`/drives/${d.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <div className="min-w-0"><p className="truncate text-sm font-medium">{d.company} <span className="font-normal text-slate-500">· {d.title}</span></p><p className="text-xs text-slate-500">Closes {fmtDay(d.registrationDeadline)} · {d.applicantCount} applicants</p></div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${n <= 3 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}`}>{n <= 0 ? "Today" : `${n}d left`}</span>
                </Link></li>); })}
            </ul>)}
        </section>
        <section className="card min-w-0 lg:col-span-2">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">Recent activity</h2>
          {data.recentActivity.length === 0 ? <Empty title="Nothing yet" body="Ask Claude to create a drive, or create one here. Activity shows up as it happens." /> : (
            <ul className="divide-y divide-slate-100">
              {data.recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${actorStyle[a.actor]}`}>{actorLabel[a.actor]}</span>
                  <div className="min-w-0 text-sm">{a.driveId ? <Link to={`/drives/${a.driveId}`} className="hover:text-indigo-600">{a.message}</Link> : a.message}<p className="text-xs text-slate-400">{timeAgo(a.at)}</p></div>
                </li>))}
            </ul>)}
        </section>
      </div>
    </>
  );
}
