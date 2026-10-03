import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiImageUpload from "@/components/MultiImageUpload";
import { 
  ArrowLeft, 
  Shield, 
  Loader2,
  Plus,
  Clock,
  Trash2,
  Edit,
  X,
  Users,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import type { SurveyField } from "@/types/surveyField";
import SurveyFormBuilder from "@/components/SurveyFormBuilder";
import AddressSearch from "@/components/AddressSearch";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface Seminar {
  id: string;
  title: string;
  description: string | null;
  date: string;
  location: string | null;
  image_url: string | null;
  capacity: number | null;
  status: 'recruiting' | 'closed';
  subject: string | null;
  target_grade: string | null;
  author_id: string | null;
  academy_id: string | null;
  custom_questions: string[] | null;
  application_count?: number;
  author?: {
    user_name: string | null;
  };
}




const gradeOptions = [
  { value: '초등', label: '초등학생' },
  { value: '중등', label: '중학생' },
  { value: '고등', label: '고등학생' },
  { value: '전체', label: '전체' },
  { value: '기타', label: '기타' },
];

const subjectOptions = [
  { value: '수학', label: '수학' },
  { value: '영어', label: '영어' },
  { value: '국어', label: '국어' },
  { value: '과학', label: '과학' },
  { value: '코딩', label: '코딩' },
  { value: '입시설명회', label: '입시설명회' },
  { value: '기타', label: '기타' },
];

const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minuteOptions = ['00', '15', '30', '45'];

const SuperAdminSeminarPage = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [seminars, setSeminars] = useState<Seminar[]>([]);
  const [seminarsLoading, setSeminarsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeminar, setEditingSeminar] = useState<Seminar | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  const [locationName, setLocationName] = useState('');
  const [locationDetail, setLocationDetail] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [capacity, setCapacity] = useState(30);
  const [subject, setSubject] = useState('');
  const [targetGrade, setTargetGrade] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [surveyFields, setSurveyFields] = useState<SurveyField[]>([]);
  const [confirmationMode, setConfirmationMode] = useState("auto");
  const [completionMessage, setCompletionMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isSuperAdmin) {
      fetchSeminars();
    }
  }, [loading, isSuperAdmin]);

  const fetchSeminars = async () => {
    try {
      const { data, error } = await supabase
        .from('seminars')
        .select('*')
        .is('academy_id', null)
        .order('date', { ascending: false });

      if (error) throw error;

      // Fetch author names
      const authorIds = [...new Set((data || []).filter(s => s.author_id).map(s => s.author_id))];
      let authorsMap: Record<string, string> = {};
      
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, user_name')
          .in('id', authorIds);
        
        if (profiles) {
          authorsMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.user_name || '운영자';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      // Get application counts
      const seminarsWithCounts = await Promise.all(
        (data || []).map(async (seminar) => {
          const { count } = await supabase
            .from("seminar_applications")
            .select("*", { count: "exact", head: true })
            .eq("seminar_id", seminar.id);

          return {
            ...seminar,
            application_count: count || 0,
            author: { user_name: seminar.author_id ? authorsMap[seminar.author_id] || '운영자' : '운영자' }
          };
        })
      );

      setSeminars(seminarsWithCounts as Seminar[]);
    } catch (error) {
      console.error('Error fetching seminars:', error);
      toast.error('설명회를 불러오는데 실패했습니다');
    } finally {
      setSeminarsLoading(false);
    }
  };


  const resetForm = () => {
    setTitle('');
    setDescription('');
    setDate('');
    setHour('10');
    setMinute('00');
    setLocationName('');
    setLocationDetail('');
    setLocationAddress('');
    setCapacity(30);
    setSubject('');
    setTargetGrade('');
    setImageUrls([]);
    setSurveyFields([]);
    setConfirmationMode("auto");
    setCompletionMessage("");
    setEditingSeminar(null);
  };

  const handleOpenDialog = (seminar?: Seminar) => {
    if (seminar) {
      setEditingSeminar(seminar);
      setTitle(seminar.title);
      setDescription(seminar.description || '');
      const seminarDate = new Date(seminar.date);
      setDate(format(seminarDate, 'yyyy-MM-dd'));
      setHour(format(seminarDate, 'HH'));
      const mins = seminarDate.getMinutes();
      const roundedMins = ['00', '15', '30', '45'].reduce((prev, curr) => 
        Math.abs(parseInt(curr) - mins) < Math.abs(parseInt(prev) - mins) ? curr : prev
      );
      setMinute(roundedMins);
      if (seminar.location) {
        try {
          const parsed = JSON.parse(seminar.location);
          setLocationName(parsed.name || '');
          setLocationDetail(parsed.detail || '');
          setLocationAddress(parsed.address || '');
        } catch {
          setLocationName(seminar.location);
          setLocationDetail('');
          setLocationAddress('');
        }
      } else {
        setLocationName('');
        setLocationDetail('');
        setLocationAddress('');
      }
      setCapacity(seminar.capacity || 30);
      setSubject(seminar.subject || '');
      setTargetGrade(seminar.target_grade || '');
      try {
        const parsed = seminar.image_url ? JSON.parse(seminar.image_url) : [];
        setImageUrls(Array.isArray(parsed) ? parsed : seminar.image_url ? [seminar.image_url] : []);
      } catch {
        setImageUrls(seminar.image_url ? [seminar.image_url] : []);
      }
      const rawFields = (seminar as any).survey_fields;
      setSurveyFields(Array.isArray(rawFields) ? rawFields : []);
      setConfirmationMode((seminar as any).confirmation_mode || "auto");
      setCompletionMessage((seminar as any).completion_message || "");
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };


  const handleSubmit = async () => {
    if (!title.trim() || !date) {
      toast.error('필수 항목을 입력해주세요');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('로그인이 필요합니다');
        return;
      }

      const seminarDate = new Date(`${date}T${hour}:${minute}`);
      const validFields = surveyFields.filter(f => f.label?.trim() || f.consentText?.trim());

      const seminarData = {
        title: title.trim(),
        description: description.trim() || null,
        date: seminarDate.toISOString(),
        location: (locationName.trim() || locationDetail.trim() || locationAddress.trim())
          ? JSON.stringify({ name: locationName.trim(), detail: locationDetail.trim(), address: locationAddress.trim() })
          : null,
        capacity,
        subject: subject.trim() || null,
        target_grade: targetGrade || null,
        image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        author_id: session.user.id,
        academy_id: null,
        status: 'recruiting' as const,
        survey_fields: (validFields.length > 0 ? validFields : null) as any,
        confirmation_mode: "manual",
        completion_message: completionMessage.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingSeminar) {
        const { error } = await supabase
          .from('seminars')
          .update(seminarData)
          .eq('id', editingSeminar.id);

        if (error) throw error;
        toast.success('설명회가 수정되었습니다');
      } else {
        const { error } = await supabase
          .from('seminars')
          .insert(seminarData);

        if (error) throw error;
        toast.success('설명회가 등록되었습니다');
      }

      setDialogOpen(false);
      resetForm();
      fetchSeminars();
    } catch (error) {
      console.error('Error saving seminar:', error);
      toast.error('설명회 저장에 실패했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('seminars')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;
      toast.success('설명회가 삭제되었습니다');
      setSeminars((prev) => prev.filter((s) => s.id !== deleteId));
    } catch (error) {
      console.error('Error deleting seminar:', error);
      toast.error('설명회 삭제에 실패했습니다');
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

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  const getEffectiveStatus = (seminar: Seminar) => {
    if (isExpired(seminar.date)) return "closed";
    return seminar.status;
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
        <Button onClick={() => navigate('/admin/home')}>돌아가기</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/super')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">설명회 관리</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <Button onClick={() => handleOpenDialog()} className="w-full gap-2">
          <Plus className="w-4 h-4" />
          새 설명회 등록
        </Button>

        {seminarsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : seminars.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-6 text-center text-muted-foreground">
              등록된 설명회가 없습니다
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
                        <p className="text-xs text-muted-foreground mt-1">
                          등록자: {seminar.author?.user_name || '운영자'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(seminar)}
                        >
                          <Edit className="w-4 h-4" />
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
                        {format(new Date(seminar.date), 'M/d HH:mm', { locale: ko })}
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
                        onClick={() => navigate(`/admin/super/seminars/${seminar.id}/applicants`)}
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
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSeminar ? '설명회 수정' : '새 설명회 등록'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>제목 *</Label>
              <Input
                placeholder="설명회 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>정원</Label>
                <Input
                  type="number"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 30)}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>대상 학년</Label>
                <Select value={targetGrade} onValueChange={setTargetGrade}>
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradeOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>과목/주제</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="선택" />
                </SelectTrigger>
                <SelectContent>
                  {subjectOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                maxLength={2000}
              />
            </div>

            <div className="space-y-2">
              <Label>포스터 이미지 (선택, 최대 10장)</Label>
              <MultiImageUpload
                values={imageUrls}
                onChange={setImageUrls}
                folder="seminars"
                maxImages={10}
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
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !date}
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {submitting ? '저장 중...' : editingSeminar ? '수정' : '등록'}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminSeminarPage;
