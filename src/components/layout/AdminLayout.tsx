import {
  ArrowLeft,
  ClipboardList,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  ShieldCheck,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";

const links = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/incidents", label: "Incidents", icon: ClipboardList, end: false },
  { to: "/admin/teams", label: "Response teams", icon: UsersRound, end: false },
  { to: "/admin/map", label: "Live map", icon: MapIcon, end: false },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const title =
    location.pathname === "/admin"
      ? "Overview"
      : location.pathname === "/admin/incidents"
        ? "Incidents"
        : location.pathname === "/admin/teams"
          ? "Response teams"
          : location.pathname === "/admin/map"
            ? "Live map"
            : "Incident details";
  const sidebar = (
    <div className="flex h-full flex-col">
      <Link to="/" className="flex items-center gap-3 px-5 py-6 text-lg font-extrabold text-white">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-500">
          <ShieldCheck size={20} />
        </span>
        ResponseHub
      </Link>
      <div className="px-5 pb-4 text-xs font-bold uppercase tracking-[.18em] text-slate-500">
        Admin workspace
      </div>
      <nav className="space-y-1 px-3" aria-label="Administrator navigation">
        {links.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto border-t border-slate-800 p-3">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeft size={18} />
          Back to public site
        </Link>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#f5f4f1] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden bg-[#101b2d] lg:block">{sidebar}</aside>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}
        >
          <aside className="h-full w-[280px] bg-[#101b2d]">{sidebar}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-18 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <button
              className="icon-button lg:hidden"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-label="Toggle navigation"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-xl font-bold text-slate-950">{title}</h1>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            Demo workspace
          </span>
        </header>
        <main className="p-4 sm:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
