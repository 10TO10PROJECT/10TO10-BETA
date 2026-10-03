import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAcademyMembership } from "@/hooks/useAcademyMembership";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  MapPin,
  FileText,
  Tags,
  Users,
  BookOpen,
  Pencil,
  GraduationCap,
  Clock,
  User,
  Target,
  Lock,
  Image,
} from "lucide-react";
import { getTagLabel } from "@/lib/tagDictionary";
import {
  CLASS_SUBJECT_OPTIONS,
  CLASS_SUBJECT_FILTER_ALL,
  CLASS_SUBJECT_FILTER_NONE,
  CLASS_SUBJECT_FILTER_TRIGGER_CLASS,
  filterClassesBySubject,
} from "@/lib/classSubjects";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Academy = Database["public"]["Tables"]["academies"]["Row"];

interface Teacher {
  id: string;
  name: string;
  subject: string | null;
  bio: string | null;
  image_url: string | null;
}

interface CurriculumStep {
  title: string;
  description: string;
}

interface Class {
  id: string;
  name: string;
  subject: string | null;
  target_grade: string | null;
  schedule: string | null;
  fee: number | null;
  description: string | null;
  teacher_id: string | null;
  is_recruiting: boolean | null;
  /** false면 학부모 미노출 — 읽기 전용 화면에서만 회색으로 표시 */
  is_active?: boolean | null;
  curriculum?: CurriculumStep[];
}

const ProfileReadOnlyPage = () => {
  const navigate = useNavigate();
  const { memberships, loading: membershipLoading } = useAcademyMembership();
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [hasEditPermission, setHasEditPermission] = useState(false);
  const [classListSubjectFilter, setClassListSubjectFilter] = useState(CLASS_SUBJECT_FILTER_ALL);

  const filteredClasses = useMemo(
    () => filterClassesBySubject(classes, classListSubjectFilter),
    [classes, classListSubjectFilter]
  );

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };
    getUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchAcademy();
    }
  }, [user]);

  const fetchAcademy = async () => {
    if (!user) return;

    try {
      // First check academy_members for user's APPROVED membership only
      const { data: memberData, error: memberError } = await supabase
        .from("academy_members")
        .select("academy_id, role, status, permissions")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (memberError) throw memberError;

      let academyId: string | null = null;
      let canEdit = false;

      if (memberData) {
        academyId = memberData.academy_id;
        // Check edit permission: owner has all permissions, or check edit_profile permission
        const permissions = memberData.permissions as Record<string, boolean> | null;
        canEdit = memberData.role === 'owner' || (permissions?.edit_profile === true);
      } else {
        // Fallback: check if user is owner
        const { data: ownerData, error: ownerError } = await supabase
          .from("academies")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (ownerError) throw ownerError;

        if (ownerData) {
          academyId = ownerData.id;
          canEdit = true; // Owner always has edit permission
        }
      }

      setHasEditPermission(canEdit);

      if (academyId) {
        const { data: academyData, error: academyError } = await supabase
          .from("academies")
          .select("*")
          .eq("id", academyId)
          .single();

        if (academyError) throw academyError;

        if (academyData) {
          setAcademy(academyData);
          fetchTeachers(academyData.id);
          fetchClasses(academyData.id);
        }
      }
    } catch (error) {
      console.error("Error fetching academy:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeachers = async (academyId: string) => {
    const { data } = await supabase
      .from("teachers")
      .select("*")
      .eq("academy_id", academyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    setTeachers((data as Teacher[]) || []);
  };

  const fetchClasses = async (academyId: string) => {
    const { data } = await supabase
      .from("classes")
      .select("*")
      .eq("academy_id", academyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    
    const classesWithCurriculum = (data || []).map((cls: any) => ({
      ...cls,
      subject: cls.subject ?? null,
      curriculum: Array.isArray(cls.curriculum) ? cls.curriculum : [],
      is_active: cls.is_active !== false,
    })) as Class[];
    setClasses(classesWithCurriculum);
  };

  const handleEditClick = () => {
    if (hasEditPermission) {
      navigate("/admin/profile");
    }
  };

  if (loading || membershipLoading) {
    return (
      <div className="min-h-screen bg-app-shell pb-20">
        <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <Logo size="sm" showText={false} />
            <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">
              관리자 모드
            </span>
          </div>
        </header>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
        <AdminBottomNavigation />
      </div>
    );
  }

  if (!academy) {
    return (
      <div className="min-h-screen bg-app-shell pb-20">
        <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <Logo size="sm" showText={false} />
            <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">
              관리자 모드
            </span>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <Card className="shadow-card border-border">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">등록된 학원이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                학원을 등록하거나 참여 코드로 학원에 합류해주세요
              </p>
            </CardContent>
          </Card>
        </main>
        <AdminBottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" showText={false} />
          <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">
            관리자 모드
          </span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Tabs defaultValue="profile" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">프로필</TabsTrigger>
            <TabsTrigger value="teachers">강사진</TabsTrigger>
            <TabsTrigger value="classes">개설 강좌</TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            {/* Edit Button - only visible to those with permission */}
            {hasEditPermission && (
              <Button onClick={handleEditClick} className="w-full gap-2">
                <Pencil className="w-4 h-4" />
                편집하기
              </Button>
            )}

            <Card className="shadow-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  학원 정보
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Profile Image */}
                {academy.profile_image && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1 mb-2">
                      <Image className="w-4 h-4" />
                      대표 사진
                    </label>
                    <div className="flex justify-center">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={academy.profile_image} alt={academy.name} />
                        <AvatarFallback>{academy.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                    </div>
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">학원명</label>
                  <p className="text-foreground mt-1">{academy.name}</p>
                </div>

                {/* Subject */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground">과목</label>
                  <p className="text-foreground mt-1">{academy.subject}</p>
                </div>

                {/* Address */}
                {academy.address && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      주소
                    </label>
                    <p className="text-foreground mt-1">{academy.address}</p>
                  </div>
                )}

                {/* Description */}
                {academy.description && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      소개
                    </label>
                    <p className="text-foreground mt-1 whitespace-pre-wrap">{academy.description}</p>
                  </div>
                )}

                {/* Tags */}
                {academy.tags && academy.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Tags className="w-4 h-4" />
                      태그
                    </label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {academy.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Target Tags */}
                {(academy as any).target_tags && (academy as any).target_tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Tags className="w-4 h-4" />
                      타겟 태그
                      {(academy as any).is_profile_locked && (
                        <Lock className="w-3 h-3 text-muted-foreground ml-1" />
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(academy as any).target_tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="outline">{getTagLabel(tag)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Teachers Tab */}
          <TabsContent value="teachers" className="space-y-4">
            {/* Edit Button - only visible to those with permission */}
            {hasEditPermission && (
              <Button onClick={handleEditClick} className="w-full gap-2">
                <Pencil className="w-4 h-4" />
                편집하기
              </Button>
            )}

            <Card className="shadow-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  강사진
                </CardTitle>
              </CardHeader>
              <CardContent>
                {teachers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">
                    등록된 강사가 없습니다
                  </p>
                ) : (
                  <div className="space-y-4">
                    {teachers.map((teacher) => (
                      <div key={teacher.id} className="flex items-start gap-4 p-4 bg-secondary/30 rounded-xl">
                        <Avatar className="w-12 h-12">
                          {teacher.image_url ? (
                            <AvatarImage src={teacher.image_url} alt={teacher.name} />
                          ) : null}
                          <AvatarFallback>
                            <User className="w-6 h-6" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground">{teacher.name}</h4>
                          {teacher.subject && (
                            <p className="text-sm text-muted-foreground">{teacher.subject}</p>
                          )}
                          {teacher.bio && (
                            <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                              {teacher.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes" className="space-y-4">
            {/* Edit Button - only visible to those with permission */}
            {hasEditPermission && (
              <Button onClick={handleEditClick} className="w-full gap-2">
                <Pencil className="w-4 h-4" />
                편집하기
              </Button>
            )}

            {classes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm">과목별 보기</Label>
                <Select value={classListSubjectFilter} onValueChange={setClassListSubjectFilter}>
                  <SelectTrigger className={CLASS_SUBJECT_FILTER_TRIGGER_CLASS}>
                    <SelectValue placeholder="전체" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CLASS_SUBJECT_FILTER_ALL}>전체</SelectItem>
                    <SelectItem value={CLASS_SUBJECT_FILTER_NONE}>과목 미지정</SelectItem>
                    {CLASS_SUBJECT_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Card className="shadow-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  개설 강좌
                </CardTitle>
              </CardHeader>
              <CardContent>
                {classes.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">
                    등록된 강좌가 없습니다
                  </p>
                ) : filteredClasses.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6 text-sm">
                    선택한 조건에 맞는 강좌가 없습니다
                  </p>
                ) : (
                  <div className="space-y-4">
                    {filteredClasses.map((cls) => {
                      const teacher = teachers.find(t => t.id === cls.teacher_id);
                      const isActive = cls.is_active !== false;
                      return (
                        <div
                          key={cls.id}
                          className={cn(
                            "p-4 rounded-xl space-y-3",
                            isActive ? "bg-secondary/30" : "bg-muted/50 text-muted-foreground opacity-90"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <h4
                              className={cn(
                                "font-medium",
                                isActive ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {cls.name}
                            </h4>
                            <div className="flex items-center gap-2">
                              {cls.is_recruiting && (
                                <Badge className="bg-green-100 text-green-700 text-xs">모집중</Badge>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                            {cls.subject && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                과목: {cls.subject}
                              </span>
                            )}
                            {cls.target_grade && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="w-3 h-3" />
                                {cls.target_grade}
                              </span>
                            )}
                            {cls.fee && (
                              <span>₩{cls.fee.toLocaleString()}</span>
                            )}
                          </div>

                          {cls.schedule && (
                            <div className="flex items-center gap-2 text-sm bg-primary/10 text-primary px-3 py-1.5 rounded-lg">
                              <Clock className="w-4 h-4 flex-shrink-0" />
                              <span className="font-medium">{cls.schedule}</span>
                            </div>
                          )}

                          {teacher && (
                            <div className="flex items-center gap-2 text-sm text-foreground">
                              <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span>담당: <span className="font-medium">{teacher.name}</span></span>
                            </div>
                          )}

                          {cls.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {cls.description}
                            </p>
                          )}

                          {/* Curriculum Preview */}
                          {cls.curriculum && cls.curriculum.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border">
                              <p className="text-xs font-medium text-muted-foreground mb-1">커리큘럼</p>
                              <div className="space-y-1">
                                {cls.curriculum.slice(0, 3).map((step, idx) => (
                                  <p key={idx} className="text-xs text-muted-foreground">
                                    {idx + 1}. {step.title}
                                  </p>
                                ))}
                                {cls.curriculum.length > 3 && (
                                  <p className="text-xs text-muted-foreground">
                                    ...외 {cls.curriculum.length - 3}개
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <AdminBottomNavigation />
    </div>
  );
};

export default ProfileReadOnlyPage;
