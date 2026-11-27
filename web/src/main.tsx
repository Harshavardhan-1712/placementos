import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import "./index.css";
import { auth } from "./api";
import { Logo } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Drives from "./pages/Drives";
import DriveNew from "./pages/DriveNew";
import DriveDetail from "./pages/DriveDetail";
import PublicDrive from "./pages/PublicDrive";

function Shell() {
  const nav = useNavigate();
  if (!auth.get()) return <Navigate to="/login" replace />;
  const link = ({ isActive }: { isActive: boolean }) => `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3 sm:gap-6">
            <NavLink to="/" aria-label="PlacementOS home"><Logo compact /></NavLink>
            <nav className="flex gap-1"><NavLink end to="/" className={link}>Dashboard</NavLink><NavLink to="/drives" className={link}>Drives</NavLink></nav>
          </div>
          <button className="btn-secondary !py-1.5" onClick={() => { auth.clear(); nav("/login"); }}>Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8"><Outlet /></main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/d/:slug" element={<PublicDrive />} />
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="drives" element={<Drives />} />
          <Route path="drives/new" element={<DriveNew />} />
          <Route path="drives/:id" element={<DriveDetail />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
