import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  Shield, 
  FileCheck, 
  Users, 
  Settings,
  Loader2,
  Building2,
  MessageSquare,
  Calendar,
  Newspaper
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import SuperAdminBottomNavigation from "@/components/SuperAdminBottomNavigation";

interface PlatformStats {
  totalUsers: number;
  parentUsers: number;
  adminUsers: number;
  studentUsers: number;
  totalAcademies: number;
  totalConsultations: number;
  pendingConsultations: number;
  totalSeminars: number;
}

const SuperAdminCenterPage = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role');

      const totalUsers = rolesData?.length || 0;
      const parentUsers = rolesData?.filter(r => r.role === 'parent').length || 0;
      const adminUsers = rolesData?.filter(r => r.role === 'admin').length || 0;
      const studentUsers = rolesData?.filter(r => r.role === 'student').length || 0;

      const { count: academyCount } = await supabase
        .from('academies')
        .select('*', { count: 'exact', head: true });

      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('status');

      const totalConsultations = consultationsData?.length || 0;
      const pendingConsultations = consultationsData?.filter(c => c.status === 'pending').length || 0;

      const { count: seminarCount } = await supabase
        .from('seminars')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers,
        parentUsers,
        adminUsers,
        studentUsers,
        totalAcademies: academyCount || 0,
        totalConsultations,
        pendingConsultations,
        totalSeminars: seminarCount || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  const menuItems = [
    {
      title: "사업자 인증 심사",
      description: "학원 사업자 인증 요청을 심사합니다",
      icon: FileCheck,
      path: "/super/verification-review",
      color: "text-primary"
    },
    {
      title: "사용자 관리",
      description: "등록된 사용자 및 역할을 관리합니다",
      icon: Users,
      path: "/super/users",
      color: "text-primary"
    },
    {
      title: "커뮤니티 게시물",
      description: "슈퍼관리자 명의로 소식을 등록합니다",
      icon: MessageSquare,
      path: "/super/posts/create",
      color: "text-primary"
    },
    {
      title: "설명회 관리",
      description: "슈퍼관리자 명의로 설명회를 등록합니다",
      icon: Calendar,
      path: "/super/seminars/manage",
      color: "text-primary"
    },
    {
      title: "등록 학원 관리",
      description: "학원 프로필, 강사, 강좌 정보 관리",
      icon: Building2,
      path: "/super/academies",
      color: "text-primary"
    },
    {
      title: "전체 게시물 관리",
      description: "모든 커뮤니티 게시물을 관리합니다",
      icon: Newspaper,
      path: "/super/posts",
      color: "text-primary"
    },
    {
      title: "시스템 설정",
      description: "플랫폼 공지사항 및 설정을 관리합니다",
      icon: Settings,
      path: "/super/settings",
      color: "text-primary"
    }
  ];

  const userChartData = stats ? [
    { name: '학부모', value: stats.parentUsers, color: 'hsl(var(--chart-2))' },
    { name: '학생', value: stats.studentUsers, color: 'hsl(var(--chart-3))' },
    { name: '학원', value: stats.adminUsers, color: 'hsl(var(--primary))' }
  ] : [];

  const statsBarData = stats ? [
    { name: '학원', value: stats.totalAcademies, fill: 'hsl(var(--primary))' },
    { name: '상담', value: stats.totalConsultations, fill: 'hsl(var(--chart-2))' },
    { name: '설명회', value: stats.totalSeminars, fill: 'hsl(var(--chart-3))' }
  ] : [];

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/super/home')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">슈퍼관리자 센터</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Platform Statistics */}
        {statsLoading ? (
          <Card className="shadow-card">
            <CardContent className="p-6 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </CardContent>
          </Card>
        ) : stats && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-2">
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <Users className="w-5 h-5 text-black mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{stats.totalUsers}</p>
                  <p className="text-[10px] text-muted-foreground">전체 사용자</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <Building2 className="w-5 h-5 text-chart-2 mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{stats.totalAcademies}</p>
                  <p className="text-[10px] text-muted-foreground">등록 학원</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <MessageSquare className="w-5 h-5 text-chart-3 mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{stats.totalConsultations}</p>
                  <p className="text-[10px] text-muted-foreground">총 상담</p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-3 text-center">
                  <Calendar className="w-5 h-5 text-chart-4 mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{stats.totalSeminars}</p>
                  <p className="text-[10px] text-muted-foreground">총 설명회</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">사용자 분포</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={userChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={25}
                          outerRadius={45}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {userChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number) => [`${value}명`, '']}
                          contentStyle={{ 
                            background: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex justify-center gap-2 mt-2 flex-wrap">
                    {userChartData.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-xs text-muted-foreground">{entry.name}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">플랫폼 현황</CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="h-32">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsBarData} layout="vertical">
                        <XAxis type="number" hide />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={35}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [`${value}개`, '']}
                          contentStyle={{ 
                            background: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Menu Items */}
        <div className="space-y-3">
          {menuItems.map((item) => (
            <Card 
              key={item.path}
              className="shadow-card transition-all duration-200 hover:shadow-lg cursor-pointer hover:-translate-y-0.5"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center">
                  <item.icon className={`w-6 h-6 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <SuperAdminBottomNavigation />
    </div>
  );
};

export default SuperAdminCenterPage;
