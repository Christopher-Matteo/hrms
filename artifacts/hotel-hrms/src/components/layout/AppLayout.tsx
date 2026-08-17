import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useGetNotifications, useMarkAllNotificationsRead, getGetNotificationsQueryKey } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, Building2, Layers, Clock, CalendarDays,
  Calendar, FileText, DollarSign, Megaphone, BarChart3, Settings,
  ScrollText, ChevronLeft, Bell, LogOut, Menu, X, ChevronRight,
  Briefcase, UserCheck, AlertCircle, CreditCard, LifeBuoy, ClipboardCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Branches", href: "/branches", icon: Building2, roles: ["super_admin", "hr_manager"] },
  { label: "Departments", href: "/departments", icon: Layers, roles: ["super_admin", "hr_manager"] },
  { label: "Shifts", href: "/shifts", icon: Clock, roles: ["super_admin", "hr_manager"] },
  { label: "Weekly Off", href: "/weekly-off", icon: CalendarDays, roles: ["super_admin", "hr_manager"] },
  { label: "Attendance", href: "/attendance", icon: UserCheck },
  { label: "Leaves", href: "/leaves", icon: Calendar },
  { label: "Advances", href: "/advances", icon: CreditCard },
  { label: "Continue Duty", href: "/continue-duty", icon: Briefcase },
  { label: "Payroll", href: "/payroll", icon: DollarSign },
  { label: "Corrections Requests", href: "/corrections", icon: ClipboardCheck, roles: ["super_admin", "hr_manager"] },
  { label: "Support Tickets", href: "/support-tickets", icon: LifeBuoy, roles: ["super_admin", "hr_manager"] },
  { label: "Announcements", href: "/announcements", icon: Megaphone },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["super_admin", "hr_manager"] },
  { label: "Audit Logs", href: "/audit-logs", icon: ScrollText, roles: ["super_admin"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["super_admin", "hr_manager"] },
];

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
}

function getRoleBadge(role: string) {
  const map: Record<string, string> = {
    super_admin: "Super Admin",
    hr_manager: "HR Manager",
    branch_manager: "Branch Manager",
    employee: "Employee",
  };
  return map[role] ?? role;
}

function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a sequence of tones over exactly 3 seconds
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "sine";
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.2, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    // Play a rising chime sequence lasting exactly 3.0 seconds
    // Tone 1: 523.25 Hz (C5) at 0s, duration 1.0s
    playTone(523.25, audioCtx.currentTime, 1.0);
    // Tone 2: 659.25 Hz (E5) at 0.75s, duration 1.0s
    playTone(659.25, audioCtx.currentTime + 0.75, 1.0);
    // Tone 3: 783.99 Hz (G5) at 1.5s, duration 1.5s
    playTone(783.99, audioCtx.currentTime + 1.5, 1.5);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [toastedIds, setToastedIds] = useState<Set<number>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const { data: notifications } = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      refetchInterval: 3000, // Poll notifications every 3 seconds
    }
  });
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!notifications) {
      console.log("AppLayout useEffect: notifications is undefined or null");
      return;
    }

    console.log("AppLayout useEffect triggered: notifications count =", notifications.length, "isInitialLoad =", isInitialLoad);

    if (isInitialLoad) {
      const unreadList = notifications.filter(n => !n.isRead);
      const toShow = unreadList.slice(0, 3);
      console.log("AppLayout initial load check: unreadList count =", unreadList.length, "toShow count =", toShow.length);

      if (toShow.length > 0) {
        toShow.forEach(n => {
          console.log("AppLayout toasting initial unread notification:", n);
          toast({
            title: "New Employee Portal Request",
            description: n.message,
            variant: "default",
          });
        });
        playNotificationSound();
      }

      const ids = new Set(notifications.map(n => n.id));
      setToastedIds(ids);
      setIsInitialLoad(false);
    } else {
      const newUnread = notifications.filter(n => !n.isRead && !toastedIds.has(n.id));
      console.log("AppLayout subsequent poll check: newUnread count =", newUnread.length, "toastedIds count =", toastedIds.size);
      if (newUnread.length > 0) {
        newUnread.forEach(n => {
          console.log("AppLayout toasting subsequent unread notification:", n);
          toast({
            title: "New Employee Portal Request",
            description: n.message,
            variant: "default",
          });
        });
        playNotificationSound();
        setToastedIds(prev => {
          const next = new Set(prev);
          newUnread.forEach(n => next.add(n.id));
          return next;
        });
      }
    }
  }, [notifications, isInitialLoad, toastedIds, toast]);

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const visibleNav = NAV_ITEMS.filter(item =>
    !item.roles || item.roles.includes(user?.role ?? "")
  );

  function isActive(href: string) {
    if (href === "/") return location === "/" || location === "/dashboard";
    return location.startsWith(href);
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Backdrop overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-25 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full z-30 flex flex-col border-r border-border bg-card transition-all duration-200",
          sidebarOpen ? "w-56 translate-x-0" : "-translate-x-full md:translate-x-0 w-56 md:w-14"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 py-4 border-b border-border h-14">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">RF</span>
          </div>
          {(sidebarOpen || window.innerWidth < 768) && (
            <div className="overflow-hidden">
              <div className="text-sm font-semibold text-foreground truncate">Red Fox Hotel</div>
              <div className="text-xs text-muted-foreground font-medium">HRMS</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {visibleNav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href} onClick={() => { if(window.innerWidth < 768) setSidebarOpen(false); }}>
                <a
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  title={(!sidebarOpen && window.innerWidth >= 768) ? item.label : undefined}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {(sidebarOpen || window.innerWidth < 768) && <span className="truncate">{item.label}</span>}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* User at bottom */}
        {sidebarOpen && user && (
          <div className="p-3 border-t border-border">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold text-xs">{getInitials(user.name)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate">{getRoleBadge(user.role)}</div>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div
        className={cn(
          "flex-1 flex flex-col min-h-screen transition-all duration-200 ml-0",
          sidebarOpen ? "md:ml-56" : "md:ml-14"
        )}
      >
        {/* Top header */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 h-14 border-b border-border bg-card/80 backdrop-blur-sm">
          {/* Desktop Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 hidden md:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </Button>

          {/* Mobile Hamburger Toggle Button */}
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 md:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </Button>

          <div className="flex-1" />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 relative">
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <Button variant="ghost" className="h-auto py-0.5 px-2 text-xs" onClick={() => markAllRead.mutate(undefined)}>
                    Mark all read
                  </Button>
                )}
              </div>
              <DropdownMenuSeparator />
              {notifications?.slice(0, 5).map(n => (
                <div key={n.id} className={cn("px-3 py-2 text-sm", !n.isRead && "bg-primary/5")}>
                  <div className={cn("font-medium", !n.isRead && "text-foreground")}>{n.message}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.type}</div>
                </div>
              ))}
              {!notifications?.length && (
                <div className="px-3 py-4 text-sm text-center text-muted-foreground">No notifications</div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 gap-2 px-2">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-semibold text-xs">{user ? getInitials(user.name) : "?"}</span>
                </div>
                <span className="text-sm font-medium hidden sm:block">{user?.name}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-3 py-2">
                <div className="text-sm font-medium">{user?.name}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
                <Badge variant="secondary" className="mt-1 text-xs">{user ? getRoleBadge(user.role) : ""}</Badge>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
