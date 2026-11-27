export type DriveStatus = "draft" | "published" | "archived";
export type ApplicantStatus = "registered" | "shortlisted" | "rejected" | "selected";
export interface Drive {
  id: string; slug: string; company: string; title: string; description: string; eligibleDepartments: string[];
  graduationYear: number; minCgpa: number; maxBacklogs: number; ctc: string; location: string; registrationDeadline: string;
  rounds: string[]; status: DriveStatus; publishedAt: string | null; createdBy: string; createdAt: string; updatedAt: string;
  applicantCount: number; publicUrl: string | null;
}
export interface Applicant { id: string; name: string; email: string; phone: string; rollNumber: string; department: string; cgpa: number; backlogs: number; graduationYear: number; status: ApplicantStatus; registeredAt: string; }
export interface Activity { id: number; actor: "claude" | "dashboard" | "student"; kind: string; message: string; driveId: string | null; at: string; }
export interface DashboardData {
  totals: { drives: number; published: number; draft: number; archived: number; activeOpen: number; applicants: number };
  applicantsByStatus: Record<ApplicantStatus, number>; upcomingDeadlines: Drive[]; recentActivity: Activity[];
}
export class ApiError extends Error { constructor(public status: number, public code: string, message: string, public details?: any) { super(message); } }

const TOKEN_KEY = "placementos_token";
export const auth = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request<T>(method: string, path: string, body?: unknown, opts: { auth?: boolean } = { auth: true }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(opts.auth !== false && auth.get() ? { Authorization: `Bearer ${auth.get()}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch { throw new ApiError(0, "network_error", "Network error — check your connection and try again."); }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false && !path.startsWith("/auth")) { auth.clear(); window.location.assign("/login"); }
    const e = data?.error;
    throw new ApiError(res.status, e?.code ?? "error", e?.message ?? `Request failed (${res.status})`, e?.details);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) => request<{ token: string }>("POST", "/auth/login", { email, password }, { auth: false }),
  dashboard: () => request<DashboardData>("GET", "/dashboard"),
  drives: (p: { status?: string; search?: string } = {}) => request<{ drives: Drive[] }>("GET", `/drives?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`),
  drive: (id: string) => request<Drive>("GET", `/drives/${id}`),
  createDrive: (b: unknown) => request<Drive>("POST", "/drives", b),
  updateDrive: (id: string, b: unknown) => request<Drive>("PATCH", `/drives/${id}`, b),
  driveAction: (id: string, a: "publish" | "unpublish" | "archive" | "restore") => request<Drive>("POST", `/drives/${id}/${a}`, {}),
  applicants: (id: string, p: { status?: string; search?: string } = {}) =>
    request<{ drive: { id: string; company: string; title: string; status: DriveStatus }; applicants: Applicant[]; counts: Record<ApplicantStatus, number> }>("GET", `/drives/${id}/applicants?${new URLSearchParams(Object.entries(p).filter(([, v]) => v) as [string, string][])}`),
  setApplicantStatus: (id: string, status: ApplicantStatus) => request<Applicant>("PATCH", `/applicants/${id}/status`, { status }),
  publicDrive: (slug: string) => request<Omit<Drive, "id" | "createdBy" | "applicantCount" | "publicUrl"> & { registrationOpen: boolean }>("GET", `/public/drives/${slug}`, undefined, { auth: false }),
  register: (slug: string, b: unknown) => request<{ ok: true; message: string }>("POST", `/public/drives/${slug}/register`, b, { auth: false }),
};

export const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
export const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`;
};
export const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
