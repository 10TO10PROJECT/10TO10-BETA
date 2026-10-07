import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, GraduationCap, Phone, Calendar, User, Eye, CheckCircle, XCircle, ArrowUpDown, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SurveyField, SurveyAnswer } from "@/types/surveyField";

interface Application {
  id: string;
  student_name: string;
  student_grade: string | null;
  attendee_count: number | null;
  message: string | null;
  custom_answers: Record<string, any> | null;
  created_at: string;
  user_id: string;
  status: string;
  profile?: {
    phone: string | null;
    user_name: string | null;
  };
}

interface SeminarInfo {
  id: string;
  title: string;
  survey_fields: SurveyField[] | null;
  confirmation_mode: string;
}

const SeminarApplicantsPage = () => {
  const { seminarId } = useParams<{ seminarId: string }>();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [seminar, setSeminar] = useState<SeminarInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", phone: "", memo: "" });
  const [addSubmitting, setAddSubmitting] = useState(false);

  useEffect(() => {
    if (seminarId) fetchData();
  }, [seminarId]);

  const fetchData = async () => {
    try {
      const { data: seminarData } = await supabase
        .from("seminars")
        .select("id, title, survey_fields, confirmation_mode")
        .eq("id", seminarId)
        .maybeSingle();

      if (seminarData) {
        setSeminar({
          ...seminarData,
          survey_fields: Array.isArray(seminarData.survey_fields) ? seminarData.survey_fields as any : null,
        });
      }

      const { data, error } = await supabase
        .from("seminar_applications")
        .select("*")
        .eq("seminar_id", seminarId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = data.map((app) => app.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, phone, user_name")
          .in("id", userIds);

        const appsWithProfiles = data.map((app) => ({
          ...app,
          profile: profiles?.find((p) => p.id === app.user_id),
        }));

        setApplications(appsWithProfiles as Application[]);
      } else {
        setApplications([]);
      }
    } catch (error) {
      console.error("Error fetching applicants:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateApplicationStatus = async (appId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("seminar_applications")
        .update({ status })
        .eq("id", appId);

      if (error) throw error;

      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a))
      );
      toast.success(status === "confirmed" ? "승인되었습니다" : "거절되었습니다");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("상태 변경에 실패했습니다");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getParentPhone = (app: Application) => {
    return app.custom_answers?._parentPhone || app.profile?.phone || null;
  };

  const getAttendeeBreakdown = (app: Application) => {
    const parentCount = Number(app.custom_answers?._parentCount);
    const studentCount = Number(app.custom_answers?._studentCount);
    if (!Number.isFinite(parentCount) && !Number.isFinite(studentCount)) return null;
    return {
      parent: Number.isFinite(parentCount) ? parentCount : 0,
      student: Number.isFinite(studentCount) ? studentCount : 0,
    };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700 text-[10px]">대기중</Badge>;
      case "confirmed":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-[10px]">확정</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="text-[10px]">거절</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const sortedApplications = [...applications].sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
  });

  const deleteApplication = async (appId: string) => {
    try {
      const { error } = await supabase
        .from("seminar_applications")
        .delete()
        .eq("id", appId);

      if (error) throw error;

      setApplications((prev) => prev.filter((a) => a.id !== appId));
      setDeleteTarget(null);
      setSelectedApp(null);
      toast.success("신청이 삭제되었습니다");
    } catch (error) {
      console.error("Error deleting application:", error);
      toast.error("삭제에 실패했습니다");
    }
  };

  const handleManualAdd = async () => {
    if (!addForm.name.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }
    setAddSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error("로그인이 필요합니다");
        return;
      }

      const { error } = await supabase.from("seminar_applications").insert({
        seminar_id: seminarId,
        user_id: session.user.id,
        student_name: addForm.name.trim(),
        status: "confirmed",
        custom_answers: {
          _parentPhone: addForm.phone.trim() || null,
          _manualEntry: true,
          _memo: addForm.memo.trim() || null,
        } as any,
      } as any);

      if (error) throw error;

      toast.success("신청이 수동 추가되었습니다");
      setAddDialogOpen(false);
      setAddForm({ name: "", phone: "", memo: "" });
      fetchData();
    } catch (error) {
      console.error("Error adding application:", error);
      toast.error("추가에 실패했습니다");
    } finally {
      setAddSubmitting(false);
    }
  };

  // Render detail sheet ordered by survey_fields
  const renderDetailContent = (app: Application) => {
    const surveyFields = seminar?.survey_fields || [];
    const customAnswers = app.custom_answers || {};
    const breakdown = getAttendeeBreakdown(app);
    const totalAttendees = app.attendee_count ?? (breakdown ? breakdown.parent + breakdown.student : 0);

    return (
      <div className="space-y-4">
        {/* Basic info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{app.student_name}</span>
          </div>
          {totalAttendees >= 1 && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                신청 인원: {totalAttendees}명
                {breakdown && (
                  <span className="text-muted-foreground">
                    {" "}(학부모 {breakdown.parent}명 · 학생 {breakdown.student}명)
                  </span>
                )}
              </span>
            </div>
          )}
          {getParentPhone(app) && (
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{getParentPhone(app)}</span>
            </div>
          )}
          {app.profile?.user_name && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">계정: {app.profile.user_name}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{formatDate(app.created_at)}</span>
          </div>
        </div>

        {/* Survey answers in form order */}
        {surveyFields.length > 0 && (
          <div className="space-y-3 border-t border-border pt-3">
            {surveyFields.map((field) => {
              if (field.type === "static_text") return null;
              const answer = customAnswers[field.id];
              if (!answer) return null;

              const label = field.label || field.consentText || field.id;
              const value = renderAnswerValue(answer);

              return (
                <div key={field.id} className="text-sm">
                  <p className="text-muted-foreground text-xs font-medium mb-0.5 whitespace-pre-wrap">
                    {label.split(/(\*\*[^*]+\*\*)/).map((part: string, i: number) =>
                      part.startsWith("**") && part.endsWith("**")
                        ? <strong key={i}>{part.slice(2, -2)}</strong>
                        : part
                    )}
                  </p>
                  <p className="text-foreground whitespace-pre-wrap">{value}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Legacy message */}
        {app.message && (
          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground font-medium mb-0.5">메시지</p>
            <p className="text-sm text-foreground">{app.message}</p>
          </div>
        )}

        {/* Approve/reject in detail sheet */}
        {app.status === "pending" && (
          <div className="flex gap-2 pt-3 border-t border-border">
            <Button
              size="sm"
              className="flex-1 gap-1"
              onClick={() => {
                updateApplicationStatus(app.id, "confirmed");
                setSelectedApp(null);
              }}
            >
              <CheckCircle className="w-4 h-4" />
              승인
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1 text-destructive hover:text-destructive"
              onClick={() => {
                updateApplicationStatus(app.id, "rejected");
                setSelectedApp(null);
              }}
            >
              <XCircle className="w-4 h-4" />
              거절
            </Button>
          </div>
        )}
      </div>
    );
  };

  const renderAnswerValue = (value: any): string => {
    if (typeof value === "object" && value !== null && "value" in value) {
      const v = value.value;
      if (Array.isArray(v)) return v.join(", ");
      if (typeof v === "boolean") return v ? "동의" : "미동의";
      return String(v);
    }
    if (Array.isArray(value)) return value.join(", ");
    if (typeof value === "boolean") return value ? "동의" : "미동의";
    return String(value);
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">신청자 명단</h1>
            {seminar && (
              <p className="text-xs text-muted-foreground truncate">{seminar.title}</p>
            )}
          </div>
          <Badge variant="secondary">
            {applications.reduce((sum, app) => sum + (app.attendee_count || 1), 0)}명
          </Badge>
          <Button size="sm" variant="outline" className="gap-1" onClick={() => setAddDialogOpen(true)}>
            <Plus className="w-3.5 h-3.5" />
            수동 추가
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        {/* Sort toggle */}
        {applications.length > 1 && (
          <div className="flex justify-end mb-3">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              {sortOrder === "asc" ? "오래된순" : "최신순"}
            </Button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : applications.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <GraduationCap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">신청자가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sortedApplications.map((app, index) => {
              const phone = getParentPhone(app);

              return (
                <Card key={app.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      {/* Profile circle */}
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                        {index + 1}
                      </div>

                      {/* Name & phone */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{app.student_name}</p>
                          {(app.attendee_count ?? 0) > 1 && (
                            <Badge variant="outline" className="text-[10px]">{app.attendee_count}명</Badge>
                          )}
                          {getStatusBadge(app.status)}
                        </div>
                        {phone && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" />
                            {phone}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          onClick={() => setSelectedApp(app)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          상세
                        </Button>
                        {app.status === "confirmed" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(app)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Approve/reject buttons */}
                    {app.status === "pending" && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1 gap-1"
                          onClick={() => updateApplicationStatus(app.id, "confirmed")}
                        >
                          <CheckCircle className="w-4 h-4" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => updateApplicationStatus(app.id, "rejected")}
                        >
                          <XCircle className="w-4 h-4" />
                          거절
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

        {/* Detail Sheet */}
        <Sheet open={!!selectedApp} onOpenChange={(open) => !open && setSelectedApp(null)}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg">신청 상세</SheetTitle>
                {selectedApp && getStatusBadge(selectedApp.status)}
              </div>
            </SheetHeader>
            {selectedApp && renderDetailContent(selectedApp)}
            {/* Delete button for confirmed */}
            {selectedApp && selectedApp.status === "confirmed" && (
              <div className="pt-3 border-t border-border mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 text-destructive hover:text-destructive"
                  onClick={() => setDeleteTarget(selectedApp)}
                >
                  <Trash2 className="w-4 h-4" />
                  신청 삭제
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>신청 삭제</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.student_name}님의 신청을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>취소</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && deleteApplication(deleteTarget.id)}
              >
                삭제
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Manual Add Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>수동 신청 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="manual-name">이름 *</Label>
                <Input
                  id="manual-name"
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="신청자 이름"
                />
              </div>
              <div>
                <Label htmlFor="manual-phone">전화번호</Label>
                <Input
                  id="manual-phone"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                />
              </div>
              <div>
                <Label htmlFor="manual-memo">메모</Label>
                <Input
                  id="manual-memo"
                  value={addForm.memo}
                  onChange={(e) => setAddForm((p) => ({ ...p, memo: e.target.value }))}
                  placeholder="메모 (선택)"
                />
              </div>
              <Button className="w-full" onClick={handleManualAdd} disabled={addSubmitting}>
                {addSubmitting ? "추가 중..." : "추가하기"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default SeminarApplicantsPage;
