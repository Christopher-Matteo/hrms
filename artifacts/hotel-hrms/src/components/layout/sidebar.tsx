import React from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { 
  Building2, Users, CalendarCheck, Clock, CalendarOff, 
  Palmtree, Wallet, HandCoins, Receipt, Bell, 
  FileText, Settings, History, LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navGroups = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
    ]
  },
  {
    label: "Organization",
    items: [
      { name: "Branches", href: "/branches", icon: Building2, roles: ["super_admin", "hr_manager"] },
      { name: "Departments", href: "/departments", icon: Users, roles: ["super_admin", "hr_manager"] },
      { name: "Employees", href: "/employees", icon: Users },
      { name: "Announcements", href: "/announcements", icon: Bell },
    ]
  },
  {
    label: "Time & Attendance",
    items: [
      { name: "Attendance", href: "/attendance", icon: CalendarCheck },
      { name: "Calendar", href: "/attendance/calendar", icon: CalendarOff },
      { name: "Shifts", href: "/shifts", icon: Clock },
      { name: "Leaves", href: "/leaves", icon: Palmtree },
      { name: "Weekly Off", href: "/weekly-off", icon: CalendarOff },
    ]
  },
  {
    label: "Payroll",
    items: [
      { name: "Payroll", href: "/payroll", icon: Receipt },
      { name: "Advances", href: "/advances", icon: Wallet },
      { name: "Continue Duty", href: "/continue-duty", icon: HandCoins },
    ]
  },
  {
    label: "Administration",
    items: [
      { name: "Reports", href: "/reports", icon: FileText, roles: ["super_admin", "hr_manager"] },
      { name: "Settings", href: "/settings", icon: Settings, roles: ["super_admin"] },
      { name: "Audit Logs", href: "/audit-logs", icon: History, roles: ["super_admin"] },
    ]
  }
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="px-4 py-3 flex flex-row items-center gap-2">
        <div className="bg-primary text-primary-foreground p-1.5 rounded-md flex items-center justify-center">
          <Building2 size={20} />
        </div>
        <span className="font-semibold text-lg tracking-tight group-data-[collapsible=icon]:hidden">
          Red Fox
        </span>
      </SidebarHeader>

      <SidebarContent>
        {navGroups.map((group) => {
          const visibleItems = group.items.filter(
            item => !item.roles || item.roles.includes(user.role)
          );
          
          if (visibleItems.length === 0) return null;

          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleItems.map((item) => {
                    const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                    return (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton 
                          asChild 
                          isActive={isActive}
                          tooltip={item.name}
                        >
                          <Link href={item.href} className="flex items-center gap-3">
                            <item.icon size={18} />
                            <span>{item.name}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
        <div className="flex items-center gap-3 mb-4 group-data-[collapsible=icon]:hidden">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary">{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium truncate">{user.name}</span>
            <span className="text-xs text-muted-foreground truncate capitalize">{user.role.replace('_', ' ')}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:w-9" onClick={logout}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 group-data-[collapsible=icon]:mr-0"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          <span className="group-data-[collapsible=icon]:hidden">Logout</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
