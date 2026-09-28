import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  ChevronDown,
  FileBarChart,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Undo2,
  Users,
  Wrench,
  MapPin,
  KeyRound,
  UserCircle,
} from "lucide-react";
import logo from "@/assets/jhaymarts-logo.png";
import { useAuth } from "@/lib/auth";
import { useDepartments, useTools, useTransfers } from "@/lib/data";
import { isOverdue } from "@/lib/domain";
import { OverdueAlert } from "@/components/overdue-alert";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/inventory", label: "Tools inventory", icon: Wrench },
  { to: "/transfer", label: "Tool transfer", icon: ArrowLeftRight },
  { to: "/returns", label: "Tool return", icon: Undo2 },
  { to: "/overdue", label: "Overdue tools", icon: AlertTriangle, badge: true },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/departments", label: "Department", icon: Building2 },
  { to: "/areas", label: "Areas", icon: MapPin },
  { to: "/search", label: "Search tools", icon: Search },
  { to: "/system", label: "System", icon: Settings, adminOnly: true },
  { to: "/users", label: "User management", icon: Users, adminOnly: true },
] as const;

export function AppShell() {
  const { profile, signOut, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const shownRef = useRef(false);

  const { data: transfers = [] } = useTransfers();
  const { data: tools = [] } = useTools();
  const { data: departments = [] } = useDepartments();

  const overdue = useMemo(() => transfers.filter((t) => isOverdue(t)), [transfers]);

  // Forced password change cannot be bypassed.
  useEffect(() => {
    if (!loading && profile?.must_change_password && pathname !== "/change-password") {
      void navigate({ to: "/change-password" });
    }
  }, [loading, profile, pathname, navigate]);

  // Show the overdue alert right after login, then every 5 minutes while unresolved.
  useEffect(() => {
    if (profile?.must_change_password) return;
    if (overdue.length === 0) {
      shownRef.current = false;
      return;
    }
    if (!shownRef.current) {
      shownRef.current = true;
      setAlertOpen(true);
    }
    const timer = setInterval(() => setAlertOpen(true), 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [overdue.length, profile?.must_change_password]);

  useEffect(() => setMobileOpen(false), [pathname]);

  const items = NAV.filter((n) => !("adminOnly" in n && n.adminOnly) || isAdmin);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[228px] flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-[10px] border-b border-sidebar-border px-[14px] py-[14px]">
          <img src={logo} alt="" width={816} height={816} className="h-[30px] w-[30px]" />
          <div className="leading-tight">
            <div className="text-[13px] font-medium">Jhaymarts</div>
            <div className="text-[11px] text-sidebar-muted">Tools Management</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-[10px]" aria-label="Main navigation">
          {items.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "mx-[8px] mb-[2px] flex items-center gap-[10px] rounded-[6px] px-[10px] py-[8px] text-[13px] transition-colors",
                  active
                    ? "bg-sidebar-active font-medium text-sidebar-foreground"
                    : "text-sidebar-muted hover:bg-sidebar-active/60 hover:text-sidebar-foreground",
                )}
              >
                <Icon size={15} />
                <span className="flex-1">{item.label}</span>
                {"badge" in item && item.badge && overdue.length > 0 ? (
                  <span className="rounded-[10px] bg-danger px-[6px] py-[1px] text-[11px] font-medium text-primary-foreground">
                    {overdue.length}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border px-[14px] py-[10px] text-[11px] text-sidebar-muted">
          Cloud database connected
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-[10px] border-b border-border bg-card px-[14px] py-[9px]">
          <button
            type="button"
            className="rounded-[6px] p-[5px] text-muted-foreground transition-colors hover:bg-muted lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={18} />
          </button>

          <Link
            to="/search"
            className="hidden items-center gap-[6px] rounded-[6px] border border-input px-[10px] py-[5px] text-[12px] text-muted-foreground transition-colors hover:bg-muted sm:flex"
          >
            <Search size={13} /> Search tools
          </Link>

          <div className="ml-auto flex items-center gap-[12px]">
            <Clock />
            <Link
              to="/overdue"
              aria-label={`${overdue.length} overdue tools`}
              className="relative rounded-[6px] p-[6px] text-muted-foreground transition-colors hover:bg-muted"
            >
              <Bell size={16} />
              {overdue.length > 0 ? (
                <span className="absolute -top-[1px] -right-[1px] min-w-[15px] rounded-[10px] bg-danger px-[3px] text-center text-[10px] leading-[15px] text-primary-foreground">
                  {overdue.length}
                </span>
              ) : null}
            </Link>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-[6px] rounded-[6px] border border-input px-[9px] py-[5px] text-[12px] transition-colors hover:bg-muted"
              >
                <UserCircle size={15} className="text-primary" />
                <span className="hidden sm:inline">
                  {profile?.full_name || profile?.username} •{" "}
                  {profile?.role === "admin" ? "Administrator" : "User"}
                </span>
                <ChevronDown size={13} />
              </button>
              {menuOpen ? (
                <div
                  className="absolute right-0 z-30 mt-[5px] w-[190px] rounded-[6px] border border-border bg-card py-[4px] shadow-md"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-[8px] px-[12px] py-[7px] text-[13px] transition-colors hover:bg-muted"
                  >
                    <UserCircle size={14} /> My profile
                  </Link>
                  <Link
                    to="/change-password"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-[8px] px-[12px] py-[7px] text-[13px] transition-colors hover:bg-muted"
                  >
                    <KeyRound size={14} /> Change password
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                      void navigate({ to: "/", replace: true });
                    }}
                    className="flex w-full items-center gap-[8px] px-[12px] py-[7px] text-left text-[13px] text-danger transition-colors hover:bg-muted"
                  >
                    <LogOut size={14} /> Logout
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-[14px] lg:p-[20px]">
          <Outlet />
        </main>
      </div>

      <OverdueAlert
        open={alertOpen && overdue.length > 0}
        onClose={() => setAlertOpen(false)}
        overdue={overdue}
        tools={tools}
        departments={departments}
      />
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="hidden text-[12px] text-muted-foreground md:inline">
      {now.toLocaleString("en-PH", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </span>
  );
}
