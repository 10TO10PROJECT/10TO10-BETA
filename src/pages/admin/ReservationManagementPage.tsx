import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Calendar, User, GraduationCap, Clock, CheckCircle, XCircle, Phone } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

type ConsultationReservation = Database["public"]["Tables"]["consultation_reservations"]["Row"];

interface ReservationWithParent extends ConsultationReservation {
  parent?: {
    user_name: string | null;
    phone: string | null;
  };
}

const ReservationManagementPage = () => {
  const [reservations, setReservations] = useState<ReservationWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("pending");
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getUser();
  }, []);

  useEffect(() => {
    const fetchReservations = async () => {
      if (!user) return;

      try {
        const { data: academy } = await supabase
          .from("academies")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (academy) {
          const { data, error } = await supabase
            .from("consultation_reservations")
            .select("*")
            .eq("academy_id", academy.id)
            .order("reservation_date", { ascending: true })
            .order("reservation_time", { ascending: true });

          if (error) throw error;

          // Fetch parent profiles for each reservation
          if (data && data.length > 0) {
            const parentIds = [...new Set(data.map(r => r.parent_id))];
            const { data: profilesData } = await supabase
              .from("profiles")
              .select("id, user_name, phone")
              .in("id", parentIds);

            const reservationsWithParents = data.map(reservation => ({
              ...reservation,
              parent: profilesData?.find(p => p.id === reservation.parent_id)
            }));

            setReservations(reservationsWithParents);
          } else {
            setReservations([]);
          }
        }
      } catch (error) {
        console.error("Error fetching reservations:", error);
        toast({
          title: "오류",
          description: "예약 목록을 불러오는데 실패했습니다.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReservations();
  }, [user, toast]);

  const updateReservationStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from("consultation_reservations")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status } : r))
      );

      const statusMessages: Record<string, string> = {
        confirmed: "예약이 확정되었습니다.",
        completed: "상담이 완료 처리되었습니다.",
        cancelled: "예약이 취소되었습니다.",
      };

      toast({
        title: "완료",
        description: statusMessages[status] || "상태가 변경되었습니다.",
      });
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast({
        title: "오류",
        description: "상태 변경에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700">대기중</Badge>;
      case "confirmed":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">확정</Badge>;
      case "completed":
        return <Badge variant="secondary" className="bg-green-100 text-green-700">완료</Badge>;
      case "cancelled":
        return <Badge variant="destructive">취소됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatReservationDateTime = (dateStr: string, timeStr: string) => {
    const date = new Date(dateStr);
    return format(date, "M월 d일 (EEE)", { locale: ko }) + ` ${timeStr}`;
  };

  const filteredReservations = reservations.filter(r => {
    if (activeTab === "pending") return r.status === "pending" || r.status === "confirmed";
    if (activeTab === "completed") return r.status === "completed";
    if (activeTab === "cancelled") return r.status === "cancelled";
    return true;
  });

  const pendingCount = reservations.filter(r => r.status === "pending" || r.status === "confirmed").length;
  const completedCount = reservations.filter(r => r.status === "completed").length;

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" showText={false} />
          <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">
            방문 상담 관리
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg text-foreground">방문 상담 예약 목록</h2>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">예정된 상담</div>
            </CardContent>
          </Card>
          <Card className="shadow-card border-border">
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-xs text-muted-foreground">완료된 상담</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="pending">예정</TabsTrigger>
            <TabsTrigger value="completed">완료</TabsTrigger>
            <TabsTrigger value="cancelled">취소</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredReservations.length === 0 ? (
              <Card className="shadow-card border-border">
                <CardContent className="p-8 text-center">
                  <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">
                    {activeTab === "pending" && "예정된 상담이 없습니다."}
                    {activeTab === "completed" && "완료된 상담이 없습니다."}
                    {activeTab === "cancelled" && "취소된 상담이 없습니다."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredReservations.map((reservation) => (
                  <Card key={reservation.id} className="shadow-card border-border">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium text-foreground">
                              {reservation.student_name}
                            </h4>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <GraduationCap className="w-3 h-3" />
                              <span>{reservation.student_grade || "학년 미정"}</span>
                            </div>
                          </div>
                        </div>
                        {getStatusBadge(reservation.status)}
                      </div>

                      {/* Reservation Date/Time */}
                      <div className="flex items-center gap-2 text-sm font-medium text-primary mb-3 bg-primary/5 rounded-lg p-2">
                        <Clock className="w-4 h-4" />
                        <span>{formatReservationDateTime(reservation.reservation_date, reservation.reservation_time)}</span>
                      </div>

                      {/* Parent Info */}
                      {reservation.parent && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <User className="w-3 h-3" />
                          <span>{reservation.parent.user_name || "학부모"}</span>
                          {reservation.parent.phone && (
                            <>
                              <Phone className="w-3 h-3 ml-2" />
                              <span>{reservation.parent.phone}</span>
                            </>
                          )}
                        </div>
                      )}

                      {reservation.message && (
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-3">
                          "{reservation.message}"
                        </p>
                      )}

                      {/* Action Buttons */}
                      {reservation.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => updateReservationStatus(reservation.id, "confirmed")}
                            className="flex-1 gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            예약 확정
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateReservationStatus(reservation.id, "cancelled")}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <XCircle className="w-4 h-4" />
                            거절
                          </Button>
                        </div>
                      )}

                      {reservation.status === "confirmed" && (
                        <Button
                          size="sm"
                          onClick={() => updateReservationStatus(reservation.id, "completed")}
                          className="w-full gap-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          상담 완료
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      <AdminBottomNavigation />
    </div>
  );
};

export default ReservationManagementPage;
