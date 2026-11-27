import { useState, type FormEvent } from "react";
import { ApiError, type Drive } from "../api";

const toLocalInput = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date(Date.now() + 14 * 86400000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

type Ctx = { f: Record<string, string>; set: (k: any) => (e: { target: { value: string } }) => void; fieldErr: (n: string) => string | undefined; disabled?: boolean };
function Field({ ctx, k, label, name, hint, ...rest }: { ctx: Ctx; k: string; label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div><label className="label" htmlFor={k}>{label}</label><input id={k} className="input" value={ctx.f[k]} onChange={ctx.set(k)} disabled={ctx.disabled} {...rest} />
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}{ctx.fieldErr(name) && <p className="mt-1 text-xs text-red-600">{ctx.fieldErr(name)}</p>}</div>
  );
}

export default function DriveForm({ drive, onSubmit, submitLabel, disabled }: { drive?: Drive; onSubmit: (body: Record<string, unknown>) => Promise<void>; submitLabel: string; disabled?: boolean }) {
  const [f, setF] = useState({
    company: drive?.company ?? "", title: drive?.title ?? "", description: drive?.description ?? "",
    departments: (drive?.eligibleDepartments ?? []).join(", "), graduationYear: String(drive?.graduationYear ?? new Date().getFullYear() + 1),
    minCgpa: String(drive?.minCgpa ?? 6), maxBacklogs: String(drive?.maxBacklogs ?? 0), ctc: drive?.ctc ?? "", location: drive?.location ?? "",
    deadline: toLocalInput(drive?.registrationDeadline), rounds: (drive?.rounds ?? []).join("\n"),
  });
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<{ message: string; details?: { field: string; message: string }[] } | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const fieldErr = (name: string) => err?.details?.find((d) => d.field === name)?.message;

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      await onSubmit({
        company: f.company, title: f.title, description: f.description,
        eligibleDepartments: f.departments.split(",").map((s) => s.trim()).filter(Boolean),
        graduationYear: Number(f.graduationYear), minCgpa: Number(f.minCgpa), maxBacklogs: Number(f.maxBacklogs),
        ctc: f.ctc, location: f.location, registrationDeadline: new Date(f.deadline).toISOString(),
        rounds: f.rounds.split("\n").map((s) => s.trim()).filter(Boolean),
      });
    } catch (x) { setErr(x instanceof ApiError ? { message: x.message, details: x.details } : { message: "Could not save" }); } finally { setBusy(false); }
  };
  const ctx = { f, set, fieldErr, disabled };
  return (
    <form onSubmit={submit} className="space-y-6">
      {err && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{err.message}{err.details && <ul className="mt-1 list-disc pl-5">{err.details.map((d, i) => <li key={i}>{d.field}: {d.message}</li>)}</ul>}</div>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field ctx={ctx} k="company" name="company" label="Company name" required maxLength={120} />
        <Field ctx={ctx} k="title" name="title" label="Job title" required maxLength={160} />
      </div>
      <div><label className="label" htmlFor="description">Job description</label><textarea id="description" rows={5} className="input" value={f.description} onChange={set("description")} disabled={disabled} maxLength={5000} /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field ctx={ctx} k="departments" name="eligibleDepartments" label="Eligible departments" required hint='Comma-separated, e.g. "CSE, IT, ECE". Use "All" for every department.' />
        <Field ctx={ctx} k="graduationYear" name="graduationYear" label="Graduation year" type="number" required min={2000} max={2100} />
        <Field ctx={ctx} k="minCgpa" name="minCgpa" label="Minimum CGPA" type="number" step="0.01" min={0} max={10} required />
        <Field ctx={ctx} k="maxBacklogs" name="maxBacklogs" label="Max active backlogs" type="number" min={0} max={50} required hint="0 = no active backlogs allowed." />
        <Field ctx={ctx} k="ctc" name="ctc" label="Package / CTC" placeholder="e.g. 12 LPA" maxLength={80} />
        <Field ctx={ctx} k="location" name="location" label="Job location" placeholder="e.g. Bengaluru" maxLength={160} />
        <Field ctx={ctx} k="deadline" name="registrationDeadline" label="Registration deadline" type="datetime-local" required />
      </div>
      <div><label className="label" htmlFor="rounds">Recruitment rounds</label><textarea id="rounds" rows={4} className="input" placeholder={"Online Assessment\nTechnical Interview\nHR Interview"} value={f.rounds} onChange={set("rounds")} disabled={disabled} />
        <p className="mt-1 text-xs text-slate-500">One round per line, in order.</p></div>
      <div className="flex justify-end"><button className="btn-primary" disabled={busy || disabled}>{busy ? "Saving…" : submitLabel}</button></div>
    </form>
  );
}
