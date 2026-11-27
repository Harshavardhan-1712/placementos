import { useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDay } from "../api";
import { DriveBadge, Empty, ErrorBox, PageHeader, Spinner, useAsync } from "../ui";

const tabs = [["", "All"], ["draft", "Draft"], ["published", "Published"], ["archived", "Archived"]] as const;

export default function Drives() {
  const [status, setStatus] = useState(""); const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useAsync(() => api.drives({ status, search }), [status, search]);
  return (
    <>
      <PageHeader title="Recruitment drives" subtitle="Everything created by you or Claude lives here." actions={<Link to="/drives/new" className="btn-primary">New drive</Link>} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {tabs.map(([v, l]) => <button key={v} onClick={() => setStatus(v)} className={`rounded-md px-3 py-1.5 text-sm font-medium ${status === v ? "bg-white shadow-sm" : "text-slate-600"}`}>{l}</button>)}
        </div>
        <input className="input max-w-xs" placeholder="Search company or title" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search drives" />
      </div>
      <div className="card overflow-hidden">
        {loading && !data ? <Spinner /> : error ? <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div> : !data || data.drives.length === 0 ? (
          <Empty title={search || status ? "No matching drives" : "No drives yet"} body={search || status ? "Try a different filter." : "Create your first drive here, or describe one to Claude and let it use the PlacementOS connector."} action={!search && !status ? <Link to="/drives/new" className="btn-primary">Create drive</Link> : undefined} />
        ) : (
          <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
              <th className="px-4 py-3 font-medium">Drive</th><th className="px-4 py-3 font-medium">Status</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Deadline</th><th className="hidden px-4 py-3 font-medium md:table-cell">CTC</th><th className="px-4 py-3 text-right font-medium">Applicants</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.drives.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3"><Link to={`/drives/${d.id}`} className="font-medium text-slate-900 hover:text-indigo-600">{d.company}</Link><p className="text-xs text-slate-500">{d.title} · Batch {d.graduationYear}{d.createdBy === "claude" && <span className="ml-2 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">via Claude</span>}</p></td>
                  <td className="px-4 py-3"><DriveBadge status={d.status} /></td>
                  <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{fmtDay(d.registrationDeadline)}</td>
                  <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{d.ctc || "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{d.applicantCount}</td>
                </tr>))}
            </tbody></table></div>)}
      </div>
    </>
  );
}
