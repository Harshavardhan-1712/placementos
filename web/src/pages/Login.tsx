import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api, auth, ApiError } from "../api";
import { Logo } from "../ui";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  if (auth.get()) return <Navigate to="/" replace />;
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { auth.set((await api.login(email, password)).token); nav("/"); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Could not sign in"); } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <div><h1 className="text-lg font-semibold">Placement cell sign in</h1><p className="mt-1 text-sm text-slate-500">Manage recruitment drives created by you or by Claude.</p></div>
          {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</div>}
          <div><label className="label" htmlFor="email">Email</label><input id="email" className="input" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className="label" htmlFor="pw">Password</label><input id="pw" className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
      </div>
    </div>
  );
}
