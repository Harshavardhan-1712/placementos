import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { api, ApiError, fmtDate } from "../api";
import { ErrorBox, Logo, Spinner, useAsync } from "../ui";

export default function PublicDrive() {
  const { slug = "" } = useParams();
  const { data: d, error, loading } = useAsync(() => api.publicDrive(slug), [slug]);
  const [f, setF] = useState({ name: "", email: "", phone: "", rollNumber: "", department: "", cgpa: "", graduationYear: "", backlogs: "0" });
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const [err, setErr] = useState<{ message: string; details?: any[] } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.register(slug, { ...f, cgpa: Number(f.cgpa), graduationYear: Number(f.graduationYear), backlogs: Number(f.backlogs) }); setDone(true); window.scrollTo({ top: 0 }); }
    catch (x) { setErr(x instanceof ApiError ? { message: x.message, details: x.details } : { message: "Could not submit" }); } finally { setBusy(false); }
  };
  const shell = (c: React.ReactNode) => <div className="min-h-screen"><header className="border-b border-slate-200 bg-white"><div className="mx-auto flex h-14 max-w-3xl items-center px-4"><Logo /></div></header><main className="mx-auto max-w-3xl px-4 py-6 sm:py-10">{c}</main><footer className="pb-8 text-center text-xs text-slate-400">Powered by PlacementOS</footer></div>;
  if (loading) return shell(<Spinner />);
  if (error || !d) return shell(<div className="card p-8 text-center"><h1 className="text-lg font-semibold">Drive not available</h1><p className="mt-2 text-sm text-slate-500">This recruitment drive doesn't exist or is not open for registration.</p></div>);

  const allDepts = d.eligibleDepartments.some((x) => x.toLowerCase() === "all");
  const closed = !d.registrationOpen;
  return shell(<>
    <div className="card p-5 sm:p-7">
      <p className="text-sm font-medium text-indigo-600">{d.company}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{d.title}</h1>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {[["Package", d.ctc || "—"], ["Location", d.location || "—"], ["Batch", String(d.graduationYear)], ["Apply by", fmtDate(d.registrationDeadline)]].map(([k, v]) => <div key={k}><dt className="text-xs uppercase tracking-wide text-slate-500">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
      </dl>
      {d.description && <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-slate-700">{d.description}</p>}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div><h2 className="text-sm font-semibold">Eligibility</h2><ul className="mt-2 space-y-1 text-sm text-slate-600">
          <li>Departments: {d.eligibleDepartments.join(", ")}</li><li>Graduating batch: {d.graduationYear}</li><li>Minimum CGPA: {d.minCgpa}</li><li>{d.maxBacklogs === 0 ? "No active backlogs" : `Up to ${d.maxBacklogs} active backlog(s)`}</li></ul></div>
        {d.rounds.length > 0 && <div><h2 className="text-sm font-semibold">Selection process</h2><ol className="mt-2 space-y-1 text-sm text-slate-600">{d.rounds.map((r, i) => <li key={i} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{i + 1}</span>{r}</li>)}</ol></div>}
      </div>
    </div>
    <div className="card mt-5 p-5 sm:p-7">
      {done ? (
        <div className="py-6 text-center" role="status"><div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg></div>
          <h2 className="text-lg font-semibold">You're registered</h2><p className="mt-1 text-sm text-slate-500">The placement cell will contact you about the next steps.</p></div>
      ) : closed ? (
        <div className="py-4 text-center"><h2 className="text-lg font-semibold">Registration closed</h2><p className="mt-1 text-sm text-slate-500">The deadline for this drive has passed.</p></div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h2 className="text-lg font-semibold">Register for this drive</h2>
          {err && <div role="alert"><ErrorBox message={err.message} />{Array.isArray(err.details) && err.details.length > 0 && <ul className="mt-2 list-disc rounded-lg bg-red-50 py-2 pl-8 pr-3 text-sm text-red-700">{err.details.map((x: any, i: number) => <li key={i}>{typeof x === "string" ? x : `${x.field}: ${x.message}`}</li>)}</ul>}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="name">Full name</label><input id="name" className="input" required minLength={2} value={f.name} onChange={set("name")} autoComplete="name" /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="input" required value={f.email} onChange={set("email")} autoComplete="email" /></div>
            <div><label className="label" htmlFor="phone">Phone</label><input id="phone" type="tel" className="input" required placeholder="10-digit mobile" value={f.phone} onChange={set("phone")} autoComplete="tel" /></div>
            <div><label className="label" htmlFor="roll">Roll number</label><input id="roll" className="input" required value={f.rollNumber} onChange={set("rollNumber")} /></div>
            <div><label className="label" htmlFor="dept">Department</label>
              {allDepts ? <input id="dept" className="input" required placeholder="e.g. CSE" value={f.department} onChange={set("department")} /> : (
                <select id="dept" className="input" required value={f.department} onChange={set("department")}><option value="">Select…</option>{d.eligibleDepartments.map((x) => <option key={x}>{x}</option>)}<option value="Other">Other (not listed)</option></select>)}</div>
            <div><label className="label" htmlFor="gy">Graduation year</label><input id="gy" type="number" className="input" required min={2000} max={2100} value={f.graduationYear} onChange={set("graduationYear")} /></div>
            <div><label className="label" htmlFor="cgpa">CGPA (out of 10)</label><input id="cgpa" type="number" step="0.01" min={0} max={10} className="input" required value={f.cgpa} onChange={set("cgpa")} /></div>
            <div><label className="label" htmlFor="bk">Active backlogs</label><input id="bk" type="number" min={0} className="input" required value={f.backlogs} onChange={set("backlogs")} /></div>
          </div>
          <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "Submitting…" : "Submit registration"}</button>
        </form>)}
    </div>
  </>);
}
