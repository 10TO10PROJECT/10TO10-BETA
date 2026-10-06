import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import SurveyFormBuilder from "@/components/SurveyFormBuilder";
import MultiImageUpload from "@/components/MultiImageUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Calendar,
  Users,
  ChevronRight,
  Clock,
  GraduationCap,
  ArrowLeft,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import type { SurveyField } from "@/types/surveyField";
import AddressSearch from "@/components/AddressSearch";
import { toast } from "sonner";

interface Seminar {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  capacity: number | null;
  status: "recruiting" | "closed";
  subject: string | null;
  target_grade: string | null;
  image_url: string | null;
  custom_questions: string[] | null;
  application_count?: number;
}




const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minuteOptions = ['00', '15', '30', '45'];

const SeminarManagementPage = () => {
  const navigate = useNavigate();
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [academyId, setAcademyId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSeminar, setEditingSeminar] = useState<Seminar | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("10");
  const [minute, setMinute] = useState("00");
  const [locationName, setLocationName] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [capacity, setCapacity] = useState(30);
  const [subject, setSubject] = useState("");
  const [targetGrade, setTargetGrade] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [surveyFields, setSurveyFields] = useState<SurveyField[]>([]);
  const [confirmationMode, setConfirmationMode] = useState("auto");
  const [completionMessage, setCompletionMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchAcademyAndSeminars(session.user.id);
      }
    });
  }, []);

  const fetchAcademyAndSeminars = async (userId: string) => {
    try {
      // Check if user has approved academy membership
      const { data: memberData } = await supabase
        .from("academy_members")
        .select("academy_id")
        .eq("user_id", userId)
        .eq("status", "approved")
        .maybeSingle();

      let academyData = memberData?.academy_id ? { id: memberData.academy_id } : null;

      if (!academyData) {
        // Fallback: check if user is owner
        const { data: ownerData } = await supabase
          .from("academies")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();
        academyData = ownerData;
      }

      if (academyData) {
        setAcademyId(academyData.id);
        fetchSeminars(academyData.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error:", error);
      setLoading(false);
    }
  };

  const fetchSeminars = async (academyId: string) => {
    try {
      const { data, error } = await supabase
        .from("seminars")
        .select("*")
        .eq("academy_id", academyId)
        .order("date", { ascending: true });

      if (error) throw error;

      // Get application counts
      const seminarsWithCounts = await Promise.all(
        (data || []).map(async (seminar) => {
          const { count } = await supabase
            .from("seminar_applications")
            .select("*", { count: "exact", head: true })
            .eq("seminar_id", seminar.id)
            .neq("status", "rejected");

          return { ...seminar, application_count: count || 0 };
        })
      );

      setSeminars(seminarsWithCounts as Seminar[]);
    } catch (error) {
      console.error("Error fetching seminars:", error);
    } finally {
      setLoading(false);
    }
  };



  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDate("");
    setHour("10");
    setMinute("00");
    setLocationName("");
    setLocationDetail("");
    setLocationAddress("");
    setCapacity(30);
    setSubject("");
    setTargetGrade("");
    setImageUrls([]);
    setSurveyFields([]);
    setConfirmationMode("auto");
    setCompletionMessage("");
    setEditingSeminar(null);
  };

  const openEditDialog = (seminar: Seminar) => {
    setEditingSeminar(seminar);
    setTitle(seminar.title);
    setDescription(seminar.description || "");
    const seminarDate = new Date(seminar.date);
    setDate(seminarDate.toISOString().split("T")[0]);
    setHour(seminarDate.getHours().toString().padStart(2, '0'));
    // Round minute to nearest 15
    const mins = seminarDate.getMinutes();
    const roundedMins = ['00', '15', '30', '45'].reduce((prev, curr) => 
      Math.abs(parseInt(curr) - mins) < Math.abs(parseInt(prev) - mins) ? curr : prev
    );
    setMinute(roundedMins);
    // Parse location JSON
    if (seminar.location) {
      try {
        const parsed = JSON.parse(seminar.location);
        setLocationName(parsed.name || "");
        setLocationDetail(parsed.detail || "");
        setLocationAddress(parsed.address || "");
      } catch {
        setLocationName(seminar.location);
        setLocationDetail("");
        setLocationAddress("");
      }
    } else {
      setLocationName("");
      setLocationDetail("");
      setLocationAddress("");
    }
    setCapacity(seminar.capacity || 30);
    setSubject(seminar.subject || "");
    setTargetGrade(seminar.target_grade || "");
    // Parse image_url - could be JSON array or single URL
    try {
      const parsed = seminar.image_url ? JSON.parse(seminar.image_url) : [];
      setImageUrls(Array.isArray(parsed) ? parsed : seminar.image_url ? [seminar.image_url] : []);
    } catch {
      setImageUrls(seminar.image_url ? [seminar.image_url] : []);
    }
    // Load survey_fields from seminar (cast from Json)
    const rawFields = (seminar as any).survey_fields;
    setSurveyFields(Array.isArray(rawFields) ? rawFields : []);
    setConfirmationMode((seminar as any).confirmation_mode || "auto");
    setCompletionMessage((seminar as any).completion_message || "");
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSaveSeminar = async () => {
    if (!academyId) {
      toast.error("학원 정보가 없습니다");
      return;
    }

    if (!title.trim() || !date) {
      toast.error("제목과 날짜를 입력해주세요");
      return;
    }

    setSubmitting(true);
    try {
      const dateTime = new Date(`${date}T${hour}:${minute}`).toISOString();

      // Filter survey fields with labels
      const validFields = surveyFields.filter(f => f.label?.trim() || f.consentText?.trim());

      const seminarData = {
        title,
        description: description || null,
        date: dateTime,
        location: (locationName.trim() || locationDetail.trim() || locationAddress.trim())
          ? JSON.stringify({ name: locationName.trim(), detail: locationDetail.trim(), address: locationAddress.trim() })
          : null,
        capacity,
        subject: subject || null,
        target_grade: targetGrade || null,
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        survey_fields: (validFields.length > 0 ? validFields : null) as any,
        confirmation_mode: "manual",
        completion_message: completionMessage.trim() || null,
      };

      if (editingSeminar) {
        const { error } = await supabase
          .from("seminars")
          .update(seminarData)
          .eq("id", editingSeminar.id);

        if (error) throw error;
        toast.success("설명회가 수정되었습니다");
      } else {
        const { data: newSeminar, error } = await supabase.from("seminars").insert({
          academy_id: academyId,
          ...seminarData,
          status: "recruiting",
        }).select('id').single();

        if (error) throw error;

        // 쏘다 알림톡 발송 (fire-and-forget) - 신규 등록 시에만
        if (newSeminar?.id) {
          supabase.functions.invoke('notify-seminar-event', {
            body: { eventType: 'seminar_published', seminarId: newSeminar.id },
          }).catch(() => {});
        }

        toast.success("설명회가 등록되었습니다");
      }

      setIsDialogOpen(false);
      resetForm();
      fetchSeminars(academyId);
    } catch (error) {
      console.error("Error saving seminar:", error);
      toast.error("저장에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSeminar = async () => {
    if (!deleteId || !academyId) return;

    try {
      const { error } = await supabase
        .from("seminars")
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      setSeminars((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success("설명회가 삭제되었습니다");
    } catch (error) {
      console.error("Error deleting seminar:", error);
      toast.error("삭제에 실패했습니다");
    } finally {
      setDeleteId(null);
    }
  };

  const toggleStatus = async (seminar: Seminar) => {
    try {
      const newStatus = seminar.status === "recruiting" ? "closed" : "recruiting";
      const { error } = await supabase
        .from("seminars")
        .update({ status: newStatus })
        .eq("id", seminar.id);

      if (error) throw error;

      setSeminars((prev) =>
        prev.map((s) => (s.id === seminar.id ? { ...s, status: newStatus } : s))
      );
      toast.success(newStatus === "closed" ? "마감되었습니다" : "모집이 재개되었습니다");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("상태 변경에 실패했습니다");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Check if seminar date has passed (auto-close)
  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  // Get effective status considering expiration
  const getEffectiveStatus = (seminar: Seminar) => {
    if (isExpired(seminar.date)) return "closed";
    return seminar.status;
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">설명회 관리</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Create Button */}
        <Button className="w-full mb-6 h-12" onClick={openCreateDialog}>
          <Plus className="w-5 h-5 mr-2" />
          새 설명회 등록
        </Button>

        {/* Seminars List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !academyId ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">먼저 학원을 등록해주세요</p>
            </CardContent>
          </Card>
        ) : seminars.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">등록된 설명회가 없습니다</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {seminars.map((seminar) => {
              const effectiveStatus = getEffectiveStatus(seminar);
              const expired = isExpired(seminar.date);
              return (
                <Card key={seminar.id} className="shadow-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {/* Show badge based on effective status */}
                          {effectiveStatus === "recruiting" && (
                            <Badge variant="default">모집중</Badge>
                          )}
                          {effectiveStatus === "closed" && (
                            <Badge variant="secondary">{expired ? "기간 마감" : "마감"}</Badge>
                          )}
                          {seminar.subject && (
                            <Badge variant="outline">{seminar.subject}</Badge>
                          )}
                        </div>
                        <h4 className="font-semibold text-foreground">
                          {seminar.title}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(seminar)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(seminar.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(seminar.date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {seminar.application_count}/{seminar.capacity || 30}명
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleStatus(seminar)}
                        className="flex-1"
                        disabled={expired}
                      >
                        {expired ? "기간 종료" : (effectiveStatus === "recruiting" ? "마감하기" : "모집 재개")}
                      </Button>
                      <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => navigate(`/admin/seminars/${seminar.id}/applicants`)}
                        >
                          신청자 명단
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-sm mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeminar ? "설명회 수정" : "설명회 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>제목 *</Label>
              <Input
                placeholder="설명회 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>날짜 *</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>시간 *</Label>
              <div className="flex items-center gap-2">
                <Select value={hour} onValueChange={setHour}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map(h => (
                      <SelectItem key={h} value={h}>{h}시</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-muted-foreground">:</span>
                <Select value={minute} onValueChange={setMinute}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {minuteOptions.map(m => (
                      <SelectItem key={m} value={m}>{m}분</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>위치</Label>
              <Input
                placeholder="예) 서울역 컨벤션홀"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>도로명주소</Label>
              <AddressSearch
                value={locationAddress}
                onChange={setLocationAddress}
                placeholder="주소를 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label>정원</Label>
              <Input
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>과목</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="수학">수학</SelectItem>
                    <SelectItem value="영어">영어</SelectItem>
                    <SelectItem value="국어">국어</SelectItem>
                    <SelectItem value="과학">과학</SelectItem>
                    <SelectItem value="코딩">코딩</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>대상 학년</Label>
                <Select value={targetGrade} onValueChange={setTargetGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="초등학생">초등학생</SelectItem>
                    <SelectItem value="중학생">중학생</SelectItem>
                    <SelectItem value="고등학생">고등학생</SelectItem>
                    <SelectItem value="기타">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>포스터 이미지</Label>
              <MultiImageUpload
                values={imageUrls}
                onChange={setImageUrls}
                folder="seminars"
                maxImages={10}
              />
            </div>


            <div className="space-y-2">
              <Label>설명회 안내</Label>
              <p className="text-xs text-muted-foreground">
                **텍스트**로 볼드체를 적용할 수 있습니다.
              </p>
              <Textarea
                placeholder="설명회 상세 내용을 입력하세요. **볼드체** 사용 가능"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
              />
            </div>

            {/* Survey Fields Section */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">
                설문 질문에도 **텍스트**로 볼드체를 적용할 수 있습니다.
              </p>
              <SurveyFormBuilder
                fields={surveyFields}
                onChange={setSurveyFields}
                maxFields={20}
              />
            </div>

            {/* Completion Message */}
            <div className="space-y-2">
              <Label>신청 완료 안내 메시지</Label>
              <Textarea
                placeholder="예: 신청이 완료되었습니다. 당일 10분 전까지 입장해주세요."
                value={completionMessage}
                onChange={(e) => setCompletionMessage(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                신청 완료 후 학부모에게 표시됩니다.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleSaveSeminar}
              disabled={submitting}
            >
              {submitting ? "저장 중..." : (editingSeminar ? "수정하기" : "등록하기")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>


      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>설명회 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 설명회를 삭제하시겠습니까? 관련 신청 데이터도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSeminar} className="bg-destructive text-destructive-foreground">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminBottomNavigation />
    </div>
  );
};

export default SeminarManagementPage;
