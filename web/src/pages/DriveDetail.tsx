import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, fmtDate, type Applicant, type ApplicantStatus, type Drive } from "../api";
import { AppBadge, DriveBadge, Empty, ErrorBox, PageHeader, Spinner, applicantStyles, useAsync, useToast } from "../ui";
import DriveForm from "./DriveForm";

const STATUSES: ApplicantStatus[] = ["registered", "shortlisted", "rejected", "selected"];

function Applicants({ drive, toast }: { drive: Drive; toast: (m: string, k?: "ok" | "err") => void }) {
  const [status, setStatus] = useState(""); const [search, setSearch] = useState(""); const [q, setQ] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(search), 250); return () => clearTimeout(t); }, [search]);
  const { data, error, loading, reload } = useAsync(() => api.applicants(drive.id, { status, search: q }), [drive.id, status, q]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const change = async (a: Applicant, next: ApplicantStatus) => {
    if (next === a.status) return; setBusyId(a.id);
    try { await api.setApplicantStatus(a.id, next); toast(`${a.name} marked ${next}`); reload(); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Update failed", "err"); } finally { setBusyId(null); }
  };
  const total = data ? Object.values(data.counts).reduce((x, y) => x + y, 0) : 0;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3">
        <div className="flex flex-wrap gap-1">
          {[["", "All", total], ...STATUSES.map((s) => [s, s[0].toUpperCase() + s.slice(1), data?.counts[s] ?? 0])].map(([v, l, n]) => (
            <button key={String(v)} onClick={() => setStatus(String(v))} className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${status === v ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"}`}>{l} · {n}</button>))}
        </div>
        <input className="input max-w-[16rem]" placeholder="Search name, email, roll no." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search applicants" />
      </div>
      {loading && !data ? <Spinner /> : error ? <div className="p-4"><ErrorBox message={error} onRetry={reload} /></div> : !data || data.applicants.length === 0 ? (
        <Empty title={q || status ? "No matching applicants" : "No applicants yet"} body={q || status ? "Try clearing the filters." : drive.status === "published" ? "Share the public link — registrations appear here instantly." : "Publish this drive to let students register."} />
      ) : (
        <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-medium">Student</th><th className="px-4 py-3 font-medium">Roll no.</th><th className="hidden px-4 py-3 font-medium sm:table-cell">Dept</th><th className="px-4 py-3 font-medium">CGPA</th><th className="hidden px-4 py-3 font-medium lg:table-cell">Registered</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {data.applicants.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-4 py-3"><p className="font-medium">{a.name}</p><p className="text-xs text-slate-500">{a.email} · {a.phone}</p></td>
                <td className="px-4 py-3 text-slate-600">{a.rollNumber}</td>
                <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{a.department}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{a.cgpa.toFixed(2)}{a.backlogs > 0 && <span className="ml-1 text-xs text-amber-600">({a.backlogs} backlog)</span>}</td>
                <td className="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">{fmtDate(a.registeredAt)}</td>
                <td className="px-4 py-3">
                  <select aria-label={`Status for ${a.name}`} value={a.status} disabled={busyId === a.id} onChange={(e) => change(a, e.target.value as ApplicantStatus)}
                    className={`rounded-full border-0 py-1 pl-3 pr-7 text-xs font-medium capitalize ring-1 ring-inset focus:ring-2 focus:ring-indigo-500 ${applicantStyles[a.status]}`}>
                    {STATUSES.map((s) => <option key={s} value={s} className="bg-white text-slate-900">{s}</option>)}
                  </select>
                </td>
              </tr>))}
          </tbody></table></div>)}
    </div>
  );
}

export default function DriveDetail() {
  const { id = "" } = useParams();
  const { data: drive, error, loading, reload, setData } = useAsync(() => api.drive(id), [id]);
  const [tab, setTab] = useState<"applicants" | "details">("applicants");
  const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  const t = useToast();

  if (loading && !drive) return <Spinner />;
  if (error || !drive) return <ErrorBox message={error ?? "Not found"} onRetry={reload} />;

  const act = async (a: "publish" | "unpublish" | "archive" | "restore", msg: string) => {
    setBusy(true);
    try { setData(await api.driveAction(drive.id, a)); t.show(msg); } catch (e) { t.show(e instanceof ApiError ? e.message : "Action failed", "err"); } finally { setBusy(false); }
  };
  const copy = async () => { if (!drive.publicUrl) return; try { await navigator.clipboard.writeText(drive.publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { t.show("Copy failed — select the link manually", "err"); } };

  return (
    <>
      <PageHeader title={`${drive.company} — ${drive.title}`}
        subtitle={`Batch ${drive.graduationYear} · closes ${fmtDate(drive.registrationDeadline)}${drive.createdBy === "claude" ? " · created by Claude" : ""}`}
        actions={<>
          <DriveBadge status={drive.status} />
          {drive.status === "draft" && <button className="btn-primary" disabled={busy} onClick={() => act("publish", "Drive published")}>Publish</button>}
          {drive.status === "published" && <button className="btn-secondary" disabled={busy} onClick={() => act("unpublish", "Drive unpublished")}>Unpublish</button>}
          {drive.status !== "archived" && <button className="btn-danger" disabled={busy} onClick={() => { if (confirm("Archive this drive? It becomes read-only and closes to students.")) act("archive", "Drive archived"); }}>Archive</button>}
          {drive.status === "archived" && <button className="btn-secondary" disabled={busy} onClick={() => act("restore", "Restored to draft")}>Restore</button>}
        </>} />
      {drive.status === "published" && drive.publicUrl && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm">
          <span className="font-medium text-indigo-900">Live student link</span>
          <a href={drive.publicUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-indigo-700 underline">{drive.publicUrl}</a>
          <button className="btn-secondary !py-1" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </div>)}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {(["applicants", "details"] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${tab === k ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-700"}`}>{k === "applicants" ? `Applicants · ${drive.applicantCount}` : "Details & edit"}</button>)}
      </div>
      {tab === "applicants" ? <Applicants drive={drive} toast={t.show} /> : (
        <div className="card p-4 sm:p-6">
          {drive.status === "archived" && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">This drive is archived and read-only. Restore it to edit.</p>}
          <DriveForm key={drive.updatedAt} drive={drive} disabled={drive.status === "archived"} submitLabel="Save changes"
            onSubmit={async (b) => { setData(await api.updateDrive(drive.id, b)); t.show("Changes saved"); }} />
        </div>)}
      {t.el}
    </>
  );
}
