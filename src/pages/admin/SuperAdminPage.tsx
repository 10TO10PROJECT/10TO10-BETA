import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import Logo from "@/components/Logo";
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

interface PlatformStats {
  totalUsers: number;
  parentUsers: number;
  adminUsers: number;
  totalAcademies: number;
  totalConsultations: number;
  pendingConsultations: number;
  totalSeminars: number;
}

const SuperAdminPage = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!loading && isSuperAdmin) {
      fetchStats();
    }
  }, [loading, isSuperAdmin]);

  const fetchStats = async () => {
    try {
      // Fetch user counts
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('role');

      const totalUsers = rolesData?.length || 0;
      const parentUsers = rolesData?.filter(r => r.role === 'parent').length || 0;
      const adminUsers = rolesData?.filter(r => r.role === 'admin').length || 0;

      // Fetch academy count
      const { count: academyCount } = await supabase
        .from('academies')
        .select('*', { count: 'exact', head: true });

      // Fetch consultation counts
      const { data: consultationsData } = await supabase
        .from('consultations')
        .select('status');

      const totalConsultations = consultationsData?.length || 0;
      const pendingConsultations = consultationsData?.filter(c => c.status === 'pending').length || 0;

      // Fetch seminar count
      const { count: seminarCount } = await supabase
        .from('seminars')
        .select('*', { count: 'exact', head: true });

      setStats({
        totalUsers,
        parentUsers,
        adminUsers,
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

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-app-shell flex flex-col items-center justify-center p-4">
        <Shield className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-semibold text-foreground mb-2">접근 권한이 없습니다</h1>
        <p className="text-muted-foreground text-center mb-6">
          이 페이지는 슈퍼관리자만 접근할 수 있습니다.
        </p>
        <Button onClick={() => navigate('/admin/home')}>
          관리자 홈으로 돌아가기
        </Button>
      </div>
    );
  }

  const menuItems = [
    {
      title: "사업자 인증 심사",
      description: "학원 사업자 인증 요청을 심사합니다",
      icon: FileCheck,
      path: "/admin/verification-review",
      color: "text-primary"
    },
    {
      title: "사용자 관리",
      description: "등록된 사용자 및 역할을 관리합니다",
      icon: Users,
      path: "/admin/super/users",
      color: "text-primary"
    },
    {
      title: "커뮤니티 게시물",
      description: "슈퍼관리자 명의로 소식을 등록합니다",
      icon: MessageSquare,
      path: "/admin/super/community",
      color: "text-primary"
    },
    {
      title: "설명회 관리",
      description: "슈퍼관리자 명의로 설명회를 등록합니다",
      icon: Calendar,
      path: "/admin/super/seminars",
      color: "text-primary"
    },
    {
      title: "등록 학원 관리",
      description: "학원 프로필, 강사, 강좌 정보 관리",
      icon: Building2,
      path: "/admin/super/academies",
      color: "text-primary"
    },
    {
      title: "전체 게시물 관리",
      description: "모든 커뮤니티 게시물을 관리합니다",
      icon: Newspaper,
      path: "/admin/super/posts",
      color: "text-primary"
    },
    {
      title: "시스템 설정",
      description: "플랫폼 공지사항 및 설정을 관리합니다",
      icon: Settings,
      path: "/admin/super/settings",
      color: "text-primary"
    }
  ];

  const userChartData = stats ? [
    { name: '학부모', value: stats.parentUsers, color: 'hsl(var(--chart-2))' },
    { name: '관리자', value: stats.adminUsers, color: 'hsl(var(--primary))' }
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/home')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">슈퍼관리자</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Super Admin Badge */}
        <Card className="shadow-card bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">슈퍼관리자 센터</h2>
                <p className="text-sm text-muted-foreground">
                  플랫폼 전체를 관리할 수 있는 권한이 있습니다
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
              {/* User Distribution Pie Chart */}
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
                  <div className="flex justify-center gap-3 mt-2">
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

              {/* Stats Bar Chart */}
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
                <div className={`w-12 h-12 rounded-xl bg-secondary flex items-center justify-center`}>
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
    </div>
  );
};

export default SuperAdminPage;
