import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import { 
  Building2, 
  Calendar, 
  Users, 
  MessageSquare, 
  Plus, 
  ChevronRight,
  Eye,
  TrendingUp,
  MapPin,
  BookOpen,
  Settings
} from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Academy {
  id: string;
  name: string;
  address: string | null;
  subject: string;
  target_grade: string | null;
  profile_image: string | null;
  description: string | null;
  tags: string[] | null;
}

interface Seminar {
  id: string;
  title: string;
  date: string;
  status: string;
  capacity: number | null;
  application_count: number;
}

interface Lead {
  region: string;
  subject: string;
  count: number;
}

const AcademyDashboardPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [consultationCount, setConsultationCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (userId: string) => {
    try {
      // Fetch academy
      const { data: academyData, error: academyError } = await supabase
        .from("academies")
        .select("*")
        .eq("owner_id", userId)
        .maybeSingle();

      if (academyError) throw academyError;

      if (!academyData) {
        navigate("/academy/setup");
        return;
      }

      setAcademy(academyData);

      // Fetch seminars with application count
      const { data: seminarData } = await supabase
        .from("seminars")
        .select(`
          id,
          title,
          date,
          status,
          capacity,
          seminar_applications (id)
        `)
        .eq("academy_id", academyData.id)
        .order("date", { ascending: false })
        .limit(5);

      if (seminarData) {
        setSeminars(seminarData.map((s: any) => ({
          id: s.id,
          title: s.title,
          date: s.date,
          status: s.status,
          capacity: s.capacity,
          application_count: s.seminar_applications?.length || 0
        })));
      }

      // Fetch reservation count (pending + confirmed)
      const { count: reservationCount } = await supabase
        .from("consultation_reservations")
        .select("*", { count: "exact", head: true })
        .eq("academy_id", academyData.id)
        .in("status", ["pending", "confirmed"]);

      setConsultationCount(reservationCount || 0);

      // Simulate lead data based on consultation and seminar applications
      // In production, this would come from actual analytics
      const simulatedLeads: Lead[] = [
        { region: academyData.address?.split(" ")[2] || "동탄4동", subject: academyData.subject, count: Math.floor(Math.random() * 20) + 5 },
        { region: "동탄5동", subject: academyData.subject, count: Math.floor(Math.random() * 15) + 3 },
        { region: "동탄6동", subject: academyData.subject, count: Math.floor(Math.random() * 10) + 2 },
      ];
      setLeads(simulatedLeads);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "데이터를 불러오는 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const redirect = location.pathname + location.search;
        navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      setUser(session.user);
      fetchData(session.user.id);
    };

    checkAuth();
  }, [navigate, fetchData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "recruiting":
        return <Badge className="bg-primary/10 text-primary border-primary/20">모집중</Badge>;
      case "closed":
        return <Badge variant="secondary">마감</Badge>;
      case "completed":
        return <Badge variant="outline">완료</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (!academy) {
    return null;
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" showText={false} />
            <span className="font-semibold text-foreground">내 학원 관리</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/admin/profile")}
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Academy Profile Card */}
        <Card className="shadow-card border-border overflow-hidden">
          <div className="gradient-primary p-4">
            <div className="flex items-start gap-4">
              {academy.profile_image ? (
                <img 
                  src={academy.profile_image} 
                  alt={academy.name}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-white/30"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-white/20 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-primary-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h2 className="text-lg font-bold text-primary-foreground">{academy.name}</h2>
                <div className="flex items-center gap-1 text-primary-foreground/80 text-sm mt-1">
                  <MapPin className="w-3 h-3" />
                  <span>{academy.address || "주소 미등록"}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-white/20 text-primary-foreground border-0 text-xs">
                    <BookOpen className="w-3 h-3 mr-1" />
                    {academy.subject}
                  </Badge>
                  {academy.target_grade && (
                    <Badge className="bg-white/20 text-primary-foreground border-0 text-xs">
                      {academy.target_grade}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{consultationCount}</div>
                <div className="text-xs text-muted-foreground">대기 상담</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">{seminars.length}</div>
                <div className="text-xs text-muted-foreground">설명회</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {leads.reduce((sum, l) => sum + l.count, 0)}
                </div>
                <div className="text-xs text-muted-foreground">관심 리드</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card 
            className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all"
            onClick={() => navigate("/admin/reservations")}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">{consultationCount}</div>
                  <div className="text-xs text-muted-foreground">방문 상담</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                  <Eye className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <div className="text-xl font-bold text-foreground">
                    {Math.floor(Math.random() * 50) + 20}
                  </div>
                  <div className="text-xs text-muted-foreground">오늘 조회수</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Seminar Management Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              내 학원 설명회
            </h3>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/admin/seminars")}
            >
              <Plus className="w-4 h-4 mr-1" />
              새 설명회
            </Button>
          </div>

          {seminars.length === 0 ? (
            <Card className="shadow-card border-border">
              <CardContent className="p-6 text-center">
                <Calendar className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">
                  등록된 설명회가 없습니다
                </p>
                <Button 
                  size="sm"
                  onClick={() => navigate("/admin/seminars")}
                >
                  첫 설명회 등록하기
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {seminars.map((seminar) => (
                <Card 
                  key={seminar.id}
                  className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all"
                  onClick={() => navigate(`/seminar/${seminar.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusBadge(seminar.status)}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(seminar.date), "M월 d일 (EEE) HH:mm", { locale: ko })}
                          </span>
                        </div>
                        <h4 className="font-medium text-foreground line-clamp-1">
                          {seminar.title}
                        </h4>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Users className="w-3 h-3" />
                          <span>{seminar.application_count}명 신청</span>
                          {seminar.capacity && (
                            <span className="text-muted-foreground/50"> / {seminar.capacity}명</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => navigate("/admin/seminars")}
              >
                전체 보기
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </section>

        {/* Lead Visualization Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              사전예약 리드 현황
            </h3>
          </div>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                우리 지역 관심 학부모
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-3">
                {leads.map((lead, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-foreground font-medium">{lead.region}</span>
                        <span className="text-primary font-semibold">{lead.count}명</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((lead.count / 25) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                * {academy.subject} 과목에 관심을 보인 학부모 수 (최근 30일)
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <AdminBottomNavigation />
    </div>
  );
};

export default AcademyDashboardPage;
