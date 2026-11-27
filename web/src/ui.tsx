import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ApiError, type ApplicantStatus, type DriveStatus } from "./api";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const run = useCallback(() => {
    setLoading(true); setError(null);
    fn().then(setData).catch((e) => setError(e instanceof ApiError ? e.message : "Something went wrong")).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}

export const Spinner = ({ label = "Loading…" }: { label?: string }) => (
  <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500" role="status">
    <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />{label}
  </div>
);
export const ErrorBox = ({ message, onRetry }: { message: string; onRetry?: () => void }) => (
  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
    <p>{message}</p>{onRetry && <button onClick={onRetry} className="mt-2 font-medium underline">Try again</button>}
  </div>
);
export const Empty = ({ title, body, action }: { title: string; body: string; action?: ReactNode }) => (
  <div className="px-6 py-14 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V7a2 2 0 00-2-2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0h-4l-1.5 2h-5L8 13H4" /></svg>
    </div>
    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
    <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{body}</p>
    {action && <div className="mt-4">{action}</div>}
  </div>
);
export const PageHeader = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
    <div className="min-w-0"><h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

const driveStyles: Record<DriveStatus, string> = { draft: "bg-slate-100 text-slate-700 ring-slate-200", published: "bg-emerald-50 text-emerald-700 ring-emerald-200", archived: "bg-amber-50 text-amber-700 ring-amber-200" };
export const DriveBadge = ({ status }: { status: DriveStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${driveStyles[status]}`}>{status}</span>
);
export const applicantStyles: Record<ApplicantStatus, string> = { registered: "bg-blue-50 text-blue-700 ring-blue-200", shortlisted: "bg-indigo-50 text-indigo-700 ring-indigo-200", rejected: "bg-red-50 text-red-700 ring-red-200", selected: "bg-emerald-50 text-emerald-700 ring-emerald-200" };
export const AppBadge = ({ status }: { status: ApplicantStatus }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${applicantStyles[status]}`}>{status}</span>
);
export const Toast = ({ msg, kind, onClose }: { msg: string; kind: "ok" | "err"; onClose: () => void }) => {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t); }, [msg, onClose]);
  return <div role="status" className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${kind === "ok" ? "bg-slate-900 text-white" : "bg-red-600 text-white"}`}>{msg}</div>;
};
export function useToast() {
  const [t, setT] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const el = t ? <Toast {...t} onClose={() => setT(null)} /> : null;
  return { show: (msg: string, kind: "ok" | "err" = "ok") => setT({ msg, kind }), el };
}
export const Logo = ({ light, compact }: { light?: boolean; compact?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white"><svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 22V10h7a4 4 0 010 8h-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
    <span className={`text-base font-semibold tracking-tight ${compact ? "hidden sm:inline" : ""} ${light ? "text-white" : "text-slate-900"}`}>PlacementOS</span>
  </div>
);
