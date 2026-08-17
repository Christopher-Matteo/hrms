import { useGetDashboardStats, useGetAttendanceTrend, useGetPayrollTrend, useGetDepartmentDistribution, useGetRecentActivities, useGetUpcomingBirthdays } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Building2, UserCheck, UserX, DollarSign, Clock, TrendingUp, Star, Calendar } from "lucide-react";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const COLORS = ["#8B1A2E", "#1e3a5f", "#0ea5e9", "#f59e0b", "#10b981"];

function StatCard({ title, value, icon: Icon, subtitle, color = "primary" }: {
  title: string; value: string | number; icon: React.ElementType; subtitle?: string; color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value.toLocaleString()}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats } = useGetDashboardStats();
  const { data: attendanceTrend } = useGetAttendanceTrend();
  const { data: payrollTrend } = useGetPayrollTrend();
  const { data: deptDist } = useGetDepartmentDistribution();
  const { data: recentActivities } = useGetRecentActivities();
  const { data: birthdays } = useGetUpcomingBirthdays();

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard title="Total Employees" value={stats?.totalEmployees ?? 0} icon={Users} />
        <StatCard title="Present Today" value={stats?.presentToday ?? 0} icon={UserCheck} subtitle="Active employees" />
        <StatCard title="Absent Today" value={stats?.absentToday ?? 0} icon={UserX} subtitle={stats?.weeklyOffToday ? `Excludes ${stats.weeklyOffToday} weekly off` : "Not reported"} />
        <StatCard title="On Leave" value={stats?.leaveToday ?? 0} icon={Calendar} />
        <StatCard title="Late Arrivals" value={stats?.lateArrivals ?? 0} icon={Clock} subtitle="Past grace period" />
        <StatCard title="Total Branches" value={stats?.totalBranches ?? 0} icon={Building2} />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Monthly Payroll" value={`₹${(stats?.monthlyPayroll ?? 0).toLocaleString("en-IN")}`} icon={DollarSign} subtitle="Current month" />
        <StatCard title="New Employees" value={stats?.newEmployees ?? 0} icon={TrendingUp} subtitle="Last 30 days" />
        <StatCard title="Monthly Salary Expense" value={`₹${(stats?.salaryExpense ?? 0).toLocaleString("en-IN")}`} icon={DollarSign} subtitle="Gross salaries" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Attendance Trend (Last 14 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={attendanceTrend ?? []}>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="present" stroke="#8B1A2E" strokeWidth={2} dot={false} name="Present" />
                <Line type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={2} dot={false} name="Absent" />
                <Line type="monotone" dataKey="leave" stroke="#f59e0b" strokeWidth={2} dot={false} name="Leave" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payroll trend */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Payroll Trend (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={payrollTrend ?? []}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, "Payroll"]} />
                <Bar dataKey="totalPayroll" fill="#8B1A2E" radius={[3, 3, 0, 0]} name="Total Payroll" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Department distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Department Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={deptDist ?? []} dataKey="count" nameKey="department" cx="50%" cy="50%" outerRadius={70}>
                  {(deptDist ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number, n: string) => [v, n]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Upcoming birthdays */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming Birthdays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {birthdays?.slice(0, 5).map(emp => (
                <div key={emp.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-primary font-bold text-xs">{emp.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.department}</p>
                  </div>
                  <Badge variant="outline" className="text-xs flex-shrink-0">
                    {emp.daysUntil === 0 ? "Today!" : `${emp.daysUntil}d`}
                  </Badge>
                </div>
              ))}
              {!birthdays?.length && <p className="text-sm text-muted-foreground text-center py-4">No upcoming birthdays in the next 30 days</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recent activities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities?.slice(0, 6).map(activity => (
                <div key={activity.id} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">{activity.description}</p>
                    <p className="text-xs text-muted-foreground">{activity.userName} · {new Date(activity.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
              {!recentActivities?.length && <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
