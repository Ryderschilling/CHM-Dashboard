"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import {
  IconGrid,
  IconUsers,
  IconDollar,
  IconWrench,
  IconTeam,
  IconCheck,
  IconLogout,
} from "./icons";

const NAV = [
  { href: "/", label: "Dashboard", icon: IconGrid },
  { href: "/clients", label: "Clients", icon: IconUsers },
  { href: "/money", label: "Money", icon: IconDollar },
  { href: "/jobs", label: "Jobs", icon: IconWrench },
  { href: "/team", label: "Team", icon: IconTeam },
  { href: "/tasks", label: "Tasks", icon: IconCheck },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)]/60 backdrop-blur z-50">
        <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-7">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--teal)]">
            <span className="display font-bold text-sm text-[var(--teal-ink)]">C</span>
          </span>
          <span>
            <span className="display block font-semibold text-[15px] leading-tight" style={{ fontStretch: "115%" }}>
              CHM OPS
            </span>
            <span className="block text-[11px] text-[var(--mut)] leading-tight">
              Coastal Home Mgmt 30A
            </span>
          </span>
        </Link>

        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`nav-item ${isActive(pathname, href) ? "active" : ""}`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="px-3 pb-5 space-y-1">
          <a
            href="https://squareup.com/dashboard"
            target="_blank"
            rel="noreferrer"
            className="nav-item text-[13px]"
          >
            Square dashboard ↗
          </a>
          <a
            href="https://coastalhomemngt30a.com"
            target="_blank"
            rel="noreferrer"
            className="nav-item text-[13px]"
          >
            Public site ↗
          </a>
          <form action={logout}>
            <button className="nav-item w-full text-left" type="submit">
              <IconLogout size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border)] bg-[var(--surface)]/90 backdrop-blur flex">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium ${
              isActive(pathname, href) ? "text-[var(--teal)]" : "text-[var(--mut)]"
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
