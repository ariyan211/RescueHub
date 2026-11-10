import { ShieldCheck } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      to="/"
      className={`inline-flex items-center gap-2 text-lg font-extrabold tracking-tight ${inverse ? "text-white" : "text-slate-950"}`}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-xl text-white ${inverse ? "bg-[#f2562b]" : "bg-blue-600"}`}
      >
        <ShieldCheck size={20} />
      </span>
      ResponseHub
    </Link>
  );
}

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-[#f8f7f4]">
      <header className="border-b border-white/10 bg-[#070d18]">
        <div className="page-container flex min-h-18 items-center justify-between gap-5">
          <Brand inverse />
          <nav aria-label="Public navigation" className="flex items-center gap-3 sm:gap-6">
            <NavLink
              to="/hotspots"
              className={({ isActive }) =>
                `text-sm font-semibold hover:text-white ${isActive ? "text-white" : "text-slate-300"}`
              }
            >
              Hotspots
            </NavLink>
            <NavLink
              to="/track"
              className={({ isActive }) =>
                `text-sm font-semibold hover:text-white ${isActive ? "text-white" : "text-slate-300"}`
              }
            >
              Track
            </NavLink>
            <Link
              to="/admin"
              className="hidden text-sm font-semibold text-slate-300 hover:text-white sm:inline"
            >
              Open Admin Demo
            </Link>
            <Link
              to="/report"
              className="inline-flex min-h-10 items-center rounded-full bg-[#f2562b] px-4 text-sm font-bold text-white hover:bg-[#ff6a3d]"
            >
              Report incident
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="border-t border-white/10 bg-[#070d18] text-slate-400">
        <div className="page-container py-8">
          <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] leading-5 text-slate-300">
            <p>
              <strong className="text-white">Prototype only.</strong> This application does not
              contact emergency services or dispatch responders. If you are in immediate danger,
              contact your local emergency services.
            </p>
          </div>
          <div className="mt-6 flex flex-col justify-between gap-3 text-sm sm:flex-row">
            <p>ResponseHub demonstration interface</p>
            <p>Data is stored locally in this browser and is not shared between devices.</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Hero photo by{" "}
            <a
              className="underline hover:text-slate-300"
              href="https://unsplash.com/@jannesglas"
              target="_blank"
              rel="noreferrer"
            >
              Jannes Glas
            </a>{" "}
            on Unsplash.
          </p>
        </div>
      </footer>
    </div>
  );
}
