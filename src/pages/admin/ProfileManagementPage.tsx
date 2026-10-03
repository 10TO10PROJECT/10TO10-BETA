import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessVerification } from "@/hooks/useBusinessVerification";
import { useAcademyMembership } from "@/hooks/useAcademyMembership";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import ImageUpload from "@/components/ImageUpload";
import NicknameSettingsDialog from "@/components/NicknameSettingsDialog";
import TargetRegionSelector from "@/components/TargetRegionSelector";
import AcademyTargetTagsEditor from "@/components/AcademyTargetTagsEditor";

import CurriculumEditor from "@/components/CurriculumEditor";

import ClassScheduleInput from "@/components/ClassScheduleInput";
import AddressSearch from "@/components/AddressSearch";
import { loadNaverMapScript, geocodeAddress } from "@/utils/naverMap";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import {
  Building2,
  Image,
  FileText,
  Tags,
  X,
  Plus,
  Save,
  Users,
  BookOpen,
  Pencil,
  Trash2,
  MoreVertical,
  Copy,
  GraduationCap,
  ShieldCheck,
  Clock,
  ShieldAlert,
  ChevronRight,
  User,
  MapPin,
  Target,
  Lock,
  Loader2,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { logError } from "@/lib/errorLogger";
import { academyProfileSchema, teacherSchema, classSchema, validateInput } from "@/lib/validation";
import { SortableProfileRow } from "@/components/SortableProfileRow";
import { cn } from "@/lib/utils";
import {
  CLASS_SUBJECT_OPTIONS,
  CLASS_SUBJECT_FILTER_ALL,
  CLASS_SUBJECT_FILTER_NONE,
  CLASS_SUBJECT_FILTER_TRIGGER_CLASS,
  filterClassesBySubject,
} from "@/lib/classSubjects";

type Academy = Database["public"]["Tables"]["academies"]["Row"];

interface Teacher {
  id: string;
  name: string;
  subject: string | null;
  bio: string | null;
  image_url: string | null;
  member_id: string | null;
  sort_order: number;
}

interface AcademyMemberWithProfile {
  id: string;
  user_id: string;
  role: string;
  grade: string | null;
  status: string;
  profile: {
    user_name: string | null;
  } | null;
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
  /** false면 학부모 미노출, 학원 화면에서만 회색 표시 */
  is_active?: boolean | null;
  sort_order: number;
  curriculum?: CurriculumStep[];
  tags?: string[] | null;
}

type OpenedClassCourseCardProps = {
  cls: Class;
  dragHandle?: ReactNode;
  onEdit: (cls: Class) => void;
  onCopy: (cls: Class) => void;
  onRequestDelete: (cls: Class) => void;
  onToggleActive: (classId: string, isActive: boolean) => void;
  onToggleRecruiting: (classId: string, isRecruiting: boolean) => void;
};

function OpenedClassCourseCard({
  cls,
  dragHandle,
  onEdit,
  onCopy,
  onRequestDelete,
  onToggleActive,
  onToggleRecruiting,
}: OpenedClassCourseCardProps) {
  const isActive = cls.is_active !== false;
  return (
    <Card
      className={cn(
        "shadow-card transition-colors",
        !isActive && "border-muted-foreground/25 bg-muted/35 opacity-[0.92]"
      )}
    >
      <CardContent className="p-4">
        <div className="mb-2 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {dragHandle}
            <div className="min-w-0">
              <h4
                className={cn(
                  "font-medium",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {cls.name}
              </h4>
              <p className="text-xs text-muted-foreground">
                {cls.subject ? `과목: ${cls.subject}` : "과목 미지정"}
              </p>
              <p className="text-xs text-muted-foreground">
                {cls.target_grade || "대상 학년 미정"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" onClick={() => onEdit(cls)} aria-label="강좌 편집">
              <Pencil className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="강좌 더보기">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => onToggleActive(cls.id, !isActive)}
                >
                  {isActive ? "강좌 비활성화하기" : "강좌 활성화하기"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCopy(cls)}>
                  강좌 복사하기
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onRequestDelete(cls)}
                >
                  삭제하기
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          {cls.schedule && <p>📅 {cls.schedule}</p>}
          {cls.fee && <p>💰 {cls.fee.toLocaleString()}원</p>}
        </div>
        {Array.isArray(cls.tags) && cls.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {cls.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-xs text-muted-foreground">모집 상태</span>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-medium ${cls.is_recruiting ? "text-primary" : "text-muted-foreground"}`}
            >
              {cls.is_recruiting ? "모집중" : "마감"}
            </span>
            <Switch
              checked={cls.is_recruiting ?? true}
              onCheckedChange={(checked) => onToggleRecruiting(cls.id, checked)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

async function persistTableSortOrder(
  table: "teachers" | "classes",
  orderedIds: string[]
): Promise<boolean> {
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      supabase.from(table).update({ sort_order: index }).eq("id", id)
    )
  );
  return !results.some((r) => r.error);
}

const ProfileManagementPage = () => {
  const navigate = useNavigate();
  const { isVerified, isPending, isRejected, loading: verificationLoading } = useBusinessVerification();
  const { memberships, loading: membershipLoading, joinByCode, refetch: refetchMemberships } = useAcademyMembership();
  const [academy, setAcademy] = useState<Academy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isProfileLocked, setIsProfileLocked] = useState(false);

  // Join code state for new users
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  // Profile state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [targetTags, setTargetTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Teachers & Classes state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academyMembers, setAcademyMembers] = useState<AcademyMemberWithProfile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classListSubjectFilter, setClassListSubjectFilter] = useState(CLASS_SUBJECT_FILTER_ALL);
  /** ON: 활성화된 강좌만 목록에 표시 */
  const [classActiveFilterOnly, setClassActiveFilterOnly] = useState(true);
  const classInsertDefaultsRef = useRef<{ is_recruiting: boolean; is_active: boolean } | null>(null);

  const filteredClasses = useMemo(
    () => filterClassesBySubject(classes, classListSubjectFilter),
    [classes, classListSubjectFilter]
  );

  const classesForListView = useMemo(() => {
    if (!classActiveFilterOnly) return filteredClasses;
    return filteredClasses.filter((c) => c.is_active !== false);
  }, [filteredClasses, classActiveFilterOnly]);

  const canReorderClasses = useMemo(
    () =>
      classListSubjectFilter === CLASS_SUBJECT_FILTER_ALL && !classActiveFilterOnly,
    [classListSubjectFilter, classActiveFilterOnly]
  );

  // Dialog state
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [userProfile, setUserProfile] = useState<{ user_name: string | null } | null>(null);

  // Teacher form
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherBio, setTeacherBio] = useState("");
  const [teacherImage, setTeacherImage] = useState("");
  const [teacherMemberId, setTeacherMemberId] = useState("");

  // Class form
  const [className, setClassName] = useState("");
  const [classSubject, setClassSubject] = useState("");
  const [classYears, setClassYears] = useState<string[]>([]);
  const [classSchedule, setClassSchedule] = useState("");
  const [classFee, setClassFee] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");
  const [classCurriculum, setClassCurriculum] = useState<CurriculumStep[]>([]);
  const [classTags, setClassTags] = useState<string[]>([]);
  const [classNewTag, setClassNewTag] = useState("");

  const [pendingDelete, setPendingDelete] = useState<
    | { kind: "teacher"; id: string; name: string }
    | { kind: "class"; id: string; name: string }
    | null
  >(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const { toast } = useToast();

  // Handle join by code
  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      sonnerToast.error("참여 코드를 입력해주세요");
      return;
    }

    setJoining(true);
    const result = await joinByCode(joinCode.trim());
    setJoining(false);

    if (result.success) {
      sonnerToast.success(`${result.academyName}에 참여했습니다!`);
      refetchMemberships();
      // Refetch academy data
      if (user) {
        fetchAcademy();
      }
    } else {
      sonnerToast.error(result.error || "참여에 실패했습니다");
    }
  };

  const handleRegisterNewAcademy = () => {
    if (!isVerified) {
      sonnerToast.error("새 학원을 등록하려면 사업자 인증이 필요합니다");
      navigate('/admin/verification');
      return;
    }
    navigate('/academy/setup');
  };

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
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("user_name")
      .eq("id", user.id)
      .maybeSingle();
    setUserProfile(data);
  };

  const fetchAcademy = async () => {
    if (!user) return;

    try {
      // First check academy_members for user's APPROVED membership only
      const { data: memberData, error: memberError } = await supabase
        .from("academy_members")
        .select("academy_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (memberError) throw memberError;

      if (memberData) {
        // User is an approved member of an academy, fetch the academy data
        const { data: academyData, error: academyError } = await supabase
          .from("academies")
          .select("*")
          .eq("id", memberData.academy_id)
          .single();

        if (academyError) throw academyError;

        if (academyData) {
          setAcademy(academyData);
          setName(academyData.name);
          setAddress(academyData.address || "");
          setDescription(academyData.description || "");
          setProfileImage(academyData.profile_image || "");
          setBannerImage((academyData as any).banner_image || "");
          setTags(academyData.tags || []);
          setTargetRegions((academyData as any).target_regions || []);
          setTargetTags((academyData as any).target_tags || []);
          setIsProfileLocked((academyData as any).is_profile_locked || false);
          fetchTeachers(academyData.id);
          fetchClasses(academyData.id);
          fetchAcademyMembers(academyData.id);
        }
      } else {
        // Fallback: check if user is owner (for backwards compatibility)
        const { data: ownerData, error: ownerError } = await supabase
          .from("academies")
          .select("*")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (ownerError) throw ownerError;

        if (ownerData) {
          setAcademy(ownerData);
          setName(ownerData.name);
          setAddress(ownerData.address || "");
          setDescription(ownerData.description || "");
          setProfileImage(ownerData.profile_image || "");
          setBannerImage((ownerData as any).banner_image || "");
          setTags(ownerData.tags || []);
          setTargetRegions((ownerData as any).target_regions || []);
          setTargetTags((ownerData as any).target_tags || []);
          setIsProfileLocked((ownerData as any).is_profile_locked || false);
          fetchTeachers(ownerData.id);
          fetchClasses(ownerData.id);
          fetchAcademyMembers(ownerData.id);
        }
      }
    } catch (error) {
      logError("fetch-academy", error);
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
    const rows = (data || []) as (Teacher & { sort_order?: number })[];
    setTeachers(
      rows.map((t) => ({
        ...t,
        sort_order: typeof t.sort_order === "number" ? t.sort_order : 0,
      }))
    );
  };

  const fetchAcademyMembers = async (academyId: string) => {
    try {
      // Fetch approved academy members
      const { data: memberData, error } = await supabase
        .from("academy_members")
        .select("*")
        .eq("academy_id", academyId)
        .eq("status", "approved")
        .order("created_at");

      if (error) throw error;

      if (memberData && memberData.length > 0) {
        const userIds = memberData.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, user_name")
          .in("id", userIds);

        const membersWithProfiles = memberData.map(member => ({
          id: member.id,
          user_id: member.user_id,
          role: member.role,
          grade: (member as any).grade || null,
          status: member.status,
          profile: profiles?.find(p => p.id === member.user_id) || null,
        }));

        setAcademyMembers(membersWithProfiles);
      } else {
        setAcademyMembers([]);
      }
    } catch (error) {
      logError("fetch-academy-members", error);
    }
  };

  const fetchClasses = async (academyId: string) => {
    const { data } = await supabase
      .from("classes")
      .select("*")
      .eq("academy_id", academyId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    
    // Parse curriculum JSON for each class and ensure tags array
    const classesWithCurriculum = (data || []).map((cls: any) => ({
      ...cls,
      subject: cls.subject ?? null,
      sort_order: typeof cls.sort_order === "number" ? cls.sort_order : 0,
      curriculum: Array.isArray(cls.curriculum) ? cls.curriculum : [],
      tags: Array.isArray(cls.tags) ? cls.tags : [],
      is_active: cls.is_active !== false,
    })) as Class[];
    setClasses(classesWithCurriculum);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleTeacherDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!academy) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setTeachers((prev) => {
        const oldIndex = prev.findIndex((t) => t.id === active.id);
        const newIndex = prev.findIndex((t) => t.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        const reordered = arrayMove(prev, oldIndex, newIndex);
        void (async () => {
          const ok = await persistTableSortOrder(
            "teachers",
            reordered.map((t) => t.id)
          );
          if (!ok) {
            toast({ title: "순서 저장에 실패했습니다", variant: "destructive" });
            fetchTeachers(academy.id);
          }
        })();
        return reordered;
      });
    },
    [academy, toast, fetchTeachers]
  );

  const handleClassDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!academy) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      setClasses((prev) => {
        const oldIndex = prev.findIndex((c) => c.id === active.id);
        const newIndex = prev.findIndex((c) => c.id === over.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        const reordered = arrayMove(prev, oldIndex, newIndex);
        void (async () => {
          const ok = await persistTableSortOrder(
            "classes",
            reordered.map((c) => c.id)
          );
          if (!ok) {
            toast({ title: "순서 저장에 실패했습니다", variant: "destructive" });
            fetchClasses(academy.id);
          }
        })();
        return reordered;
      });
    },
    [academy, toast, fetchClasses]
  );

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSaveProfile = async () => {
    if (!academy) return;

    // Validate input
    const validation = validateInput(academyProfileSchema, {
      name,
      description: description || null,
      profile_image: profileImage || null,
      tags,
    });

    if (!validation.success) {
      toast({ title: "오류", description: (validation as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    const validatedData = (validation as { success: true; data: { name: string; description?: string | null; profile_image?: string | null; tags: string[] } }).data;

    setSaving(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      const trimmedAddress = (address || "").trim();
      if (trimmedAddress) {
        const clientId = import.meta.env.VITE_NAVER_MAP_CLIENT_ID;
        if (clientId) {
          try {
            await loadNaverMapScript(clientId);
            const coords = await geocodeAddress(trimmedAddress);
            if (coords) {
              latitude = coords.lat;
              longitude = coords.lng;
            }
          } catch {
            // 지오코딩 실패 시 주소만 저장
          }
        }
      }

      const updatePayload: Record<string, unknown> = {
        name: validatedData.name,
        address: trimmedAddress || null,
        description: validatedData.description,
        profile_image: validatedData.profile_image,
        banner_image: bannerImage || null,
        tags: validatedData.tags,
        target_regions: targetRegions,
        target_tags: targetTags,
        updated_at: new Date().toISOString(),
      };
      if (latitude != null && longitude != null) {
        updatePayload.latitude = latitude;
        updatePayload.longitude = longitude;
      } else {
        updatePayload.latitude = null;
        updatePayload.longitude = null;
      }

      const { error } = await supabase
        .from("academies")
        .update(updatePayload)
        .eq("id", academy.id);

      if (error) throw error;

      toast({ title: "저장 완료", description: "프로필이 업데이트되었습니다." });
    } catch (error) {
      logError("save-academy", error);
      toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Teacher CRUD
  const resetTeacherForm = () => {
    setTeacherName("");
    setTeacherSubject("");
    setTeacherBio("");
    setTeacherImage("");
    setTeacherMemberId("");
    setEditingTeacher(null);
  };

  const openTeacherDialog = (teacher?: Teacher) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setTeacherName(teacher.name);
      setTeacherSubject(teacher.subject || "");
      setTeacherBio(teacher.bio || "");
      setTeacherImage(teacher.image_url || "");
      setTeacherMemberId(teacher.member_id || "");
    } else {
      resetTeacherForm();
    }
    setIsTeacherDialogOpen(true);
  };

  // Get member display name (name + grade)
  const getMemberDisplayName = (member: AcademyMemberWithProfile): string => {
    const name = member.profile?.user_name || "이름 없음";
    const grade = member.role === "owner" ? "원장" : getGradeLabel(member.grade);
    return `${name} ${grade}`;
  };

  const getGradeLabel = (grade: string | null): string => {
    switch (grade) {
      case "admin":
        return "원장";
      case "vice_owner":
        return "부원장";
      case "staff":
        return "상담실장";
      case "teacher":
        return "강사";
      default:
        return "상담실장";
    }
  };

  // Get teacher display name with grade from linked member
  const getTeacherDisplayInfo = (teacher: Teacher): { name: string; grade: string } => {
    if (teacher.member_id) {
      const member = academyMembers.find(m => m.id === teacher.member_id);
      if (member) {
        const name = member.profile?.user_name || teacher.name;
        const grade = member.role === "owner" ? "원장" : getGradeLabel(member.grade);
        return { name, grade };
      }
    }
    return { name: teacher.name, grade: "" };
  };

  const handleSaveTeacher = async () => {
    if (!academy) return;

    // Get name from member if linked
    let finalName = teacherName;
    if (teacherMemberId) {
      const member = academyMembers.find(m => m.id === teacherMemberId);
      if (member?.profile?.user_name) {
        finalName = member.profile.user_name;
      }
    }

    // Validate input
    const validation = validateInput(teacherSchema, {
      name: finalName,
      subject: teacherSubject || null,
      bio: teacherBio || null,
      image_url: teacherImage || null,
    });

    if (!validation.success) {
      toast({ title: "오류", description: (validation as { success: false; error: string }).error, variant: "destructive" });
      return;
    }

    const validatedData = (validation as { success: true; data: { name: string; subject?: string | null; bio?: string | null; image_url?: string | null } }).data;

    try {
      if (editingTeacher) {
        const { error } = await supabase
          .from("teachers")
          .update({
            name: validatedData.name,
            subject: validatedData.subject,
            bio: validatedData.bio,
            image_url: validatedData.image_url,
            member_id: teacherMemberId || null,
          })
          .eq("id", editingTeacher.id);
        if (error) throw error;
      } else {
        const nextOrder =
          teachers.length === 0
            ? 0
            : Math.max(...teachers.map((t) => t.sort_order ?? 0)) + 1;
        const { error } = await supabase.from("teachers").insert({
          academy_id: academy.id,
          name: validatedData.name,
          subject: validatedData.subject,
          bio: validatedData.bio,
          image_url: validatedData.image_url,
          member_id: teacherMemberId || null,
          sort_order: nextOrder,
        });
        if (error) throw error;
      }

      toast({ title: "저장 완료" });
      setIsTeacherDialogOpen(false);
      resetTeacherForm();
      fetchTeachers(academy.id);
    } catch (error: unknown) {
      logError("save-teacher", error);
      const message = error instanceof Error ? error.message : undefined;
      toast({
        title: "강사 저장 실패",
        description: message || "권한이 없거나 입력을 확인해주세요.",
        variant: "destructive",
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete || !academy) return;
    setDeleteSubmitting(true);
    try {
      if (pendingDelete.kind === "teacher") {
        const { error } = await supabase.from("teachers").delete().eq("id", pendingDelete.id);
        if (error) throw error;
        await fetchTeachers(academy.id);
      } else {
        const { error } = await supabase.from("classes").delete().eq("id", pendingDelete.id);
        if (error) throw error;
        await fetchClasses(academy.id);
      }
      toast({ title: "삭제 완료" });
      setPendingDelete(null);
    } catch (error) {
      logError("profile-delete", error);
      toast({
        title: "삭제 실패",
        description: "다시 시도하거나 권한을 확인해주세요.",
        variant: "destructive",
      });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Class CRUD
  const parseTargetGrade = (target?: string | null) => {
    let years: string[] = [];
    if (!target) return { years };

    // 1) 이미 토큰(유아, 초1, 중2, 고3, 성인 등)들이 들어있는 경우
    const tokenMatches = target.match(/(유아|성인|초[1-6]|중[1-3]|고[1-3])/g);
    if (tokenMatches) {
      years = Array.from(new Set(tokenMatches));
      return { years };
    }

    // 2) 구버전: "초등학생 초1, 초2" 형태에서 토큰만 추출
    const legacyTokenMatches = target.match(/(초[1-6]|중[1-3]|고[1-3])/g);
    if (legacyTokenMatches) {
      years = Array.from(new Set(legacyTokenMatches));
      return { years };
    }

    // 3) 더 구버전: "초등 저학년 1학년" 같은 형태
    const legacyMatch = target.match(/([1-6])학년/);
    if (legacyMatch) {
      const num = legacyMatch[1];
      if (target.includes("초등")) years = [`초${num}`];
      else if (target.includes("중")) years = [`중${Math.min(Number(num), 3)}`];
      else if (target.includes("고")) years = [`고${Math.min(Number(num), 3)}`];
    }

    return { years };
  };

  const gradeChipOptions = [
    "유아",
    "초1",
    "초2",
    "초3",
    "초4",
    "초5",
    "초6",
    "중1",
    "중2",
    "중3",
    "고1",
    "고2",
    "고3",
    "성인",
  ] as const;

  const toggleClassYear = (year: string) => {
    setClassYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const resetClassForm = () => {
    setClassName("");
    setClassSubject("");
    setClassYears([]);
    setClassSchedule("");
    setClassFee("");
    setClassDescription("");
    setClassTeacherId("");
    setClassCurriculum([]);
    setClassTags([]);
    setClassNewTag("");
    setEditingClass(null);
    classInsertDefaultsRef.current = null;
  };

  const openClassDialog = (cls?: Class) => {
    classInsertDefaultsRef.current = null;
    if (cls) {
      setEditingClass(cls);
      setClassName(cls.name);
      setClassSubject(cls.subject || "");
      const { years } = parseTargetGrade(cls.target_grade || "");
      setClassYears(years || []);
      setClassSchedule(cls.schedule || "");
      setClassFee(cls.fee?.toString() || "");
      setClassDescription(cls.description || "");
      setClassTeacherId(cls.teacher_id || "");
      setClassCurriculum(cls.curriculum || []);
      setClassTags(cls.tags || []);
      setClassNewTag("");
    } else {
      resetClassForm();
    }
    setIsClassDialogOpen(true);
  };

  /** 강좌 추가와 동일한 다이얼로그에 기존 강좌 정보를 채워 넣음 (신규 저장 시 별도 행으로 insert) */
  const openClassDialogAsCopy = (cls: Class) => {
    setEditingClass(null);
    classInsertDefaultsRef.current = {
      is_recruiting: cls.is_recruiting ?? true,
      is_active: cls.is_active !== false,
    };
    setClassName(cls.name);
    setClassSubject(cls.subject || "");
    const { years } = parseTargetGrade(cls.target_grade || "");
    setClassYears(years || []);
    setClassSchedule(cls.schedule || "");
    setClassFee(cls.fee?.toString() || "");
    setClassDescription(cls.description || "");
    setClassTeacherId(cls.teacher_id || "");
    setClassCurriculum(cls.curriculum ? [...cls.curriculum] : []);
    setClassTags(cls.tags ? [...cls.tags] : []);
    setClassNewTag("");
    setIsClassDialogOpen(true);
  };

  const handleAddClassTag = () => {
    if (classNewTag.trim() && !classTags.includes(classNewTag.trim())) {
      setClassTags([...classTags, classNewTag.trim()]);
      setClassNewTag("");
    }
  };

  const handleRemoveClassTag = (tagToRemove: string) => {
    setClassTags(classTags.filter((tag) => tag !== tagToRemove));
  };

  const handleSaveClass = async () => {
    if (!academy || !className.trim()) return;

    try {
      const composedTargetGrade = classYears.length > 0 ? classYears.join(", ") : null;

      const insertDefaults = classInsertDefaultsRef.current;
      const classData = {
        name: className,
        subject: classSubject.trim() || null,
        target_grade: composedTargetGrade,
        schedule: classSchedule || null,
        fee: classFee ? parseInt(classFee) : null,
        description: classDescription || null,
        teacher_id: classTeacherId || null,
        curriculum: classCurriculum as unknown as any,
        tags: classTags,
      };

      if (editingClass) {
        const { error } = await supabase.from("classes").update(classData).eq("id", editingClass.id);
        if (error) throw error;
      } else {
        const nextClassOrder =
          classes.length === 0
            ? 0
            : Math.max(...classes.map((c) => c.sort_order ?? 0)) + 1;
        const { error } = await supabase.from("classes").insert([
          {
            ...classData,
            academy_id: academy.id,
            sort_order: nextClassOrder,
            is_recruiting: insertDefaults?.is_recruiting ?? true,
            is_active: insertDefaults?.is_active ?? true,
          },
        ]);
        if (error) throw error;
      }

      toast({ title: "저장 완료" });
      setIsClassDialogOpen(false);
      resetClassForm();
      classInsertDefaultsRef.current = null;
      await fetchClasses(academy.id);
    } catch (error) {
      console.error("Error saving class:", error);
      const message = error instanceof Error ? error.message : undefined;
      toast({ title: "오류", description: message || "강좌 저장에 실패했습니다.", variant: "destructive" });
    }
  };

  const handleToggleClassActive = async (classId: string, isActive: boolean) => {
    if (!academy) return;
    try {
      const { error } = await supabase.from("classes").update({ is_active: isActive }).eq("id", classId);
      if (error) throw error;
      setClasses((prev) =>
        prev.map((c) => (c.id === classId ? { ...c, is_active: isActive } : c))
      );
      toast({
        title: isActive ? "강좌가 활성화되었습니다" : "강좌가 비활성화되었습니다",
        description: isActive ? "학부모에게 다시 노출됩니다." : "학부모 화면에서는 더 이상 보이지 않습니다.",
      });
    } catch (error) {
      logError("toggle-class-active", error);
      toast({ title: "상태 변경 실패", variant: "destructive" });
    }
  };

  const handleToggleRecruiting = async (classId: string, isRecruiting: boolean) => {
    try {
      const { error } = await supabase
        .from("classes")
        .update({ is_recruiting: isRecruiting })
        .eq("id", classId);
      
      if (error) throw error;
      
      setClasses(prev => prev.map(cls => 
        cls.id === classId ? { ...cls, is_recruiting: isRecruiting } : cls
      ));
      
      toast({ 
        title: isRecruiting ? "모집 상태로 변경" : "마감 상태로 변경",
        description: isRecruiting ? "학생 모집이 시작되었습니다" : "학생 모집이 마감되었습니다"
      });
    } catch (error) {
      logError("toggle-recruiting", error);
      toast({ title: "오류", description: "상태 변경에 실패했습니다", variant: "destructive" });
    }
  };

  if (loading || verificationLoading || membershipLoading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Verification Status Card Component
  const VerificationStatusCard = () => {
    if (isVerified) {
      return (
        <Card className="shadow-card border-primary/20 bg-primary/5 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground text-sm">사업자 인증 완료</h3>
                <p className="text-xs text-muted-foreground">학원 프로필 등록 및 운영이 가능합니다</p>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (isPending) {
      return (
        <Card className="shadow-card border-warning/20 bg-warning/5 mb-4 cursor-pointer" onClick={() => navigate('/admin/verification')}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground text-sm">사업자 인증 심사 중</h3>
                <p className="text-xs text-muted-foreground">영업일 1-2일 내 심사가 완료됩니다</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="shadow-card border-destructive/20 bg-destructive/5 mb-4 cursor-pointer" onClick={() => navigate('/admin/verification')}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-foreground text-sm">사업자 인증 필요</h3>
              <p className="text-xs text-muted-foreground">학원 등록을 위해 인증을 완료해주세요</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  };

  // Check if user has a pending membership
  const pendingMembership = memberships.find(m => m.membership.status === 'pending');

  if (!academy) {
    return (
      <div className="min-h-screen bg-app-shell pb-20">
        <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
            <Logo size="sm" showText={false} />
            <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">
              학원 계정 설정
            </span>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
          {/* Pending Membership Notice */}
          {pendingMembership && (
            <Card className="shadow-card border-warning/30 bg-warning/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-warning" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground mb-1">승인 대기 중</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>{pendingMembership.name}</strong> 학원에 참여 요청을 보냈습니다.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      학원 원장님이 승인하면 학원 관리 기능을 이용할 수 있습니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!pendingMembership && (
            <div className="text-center mb-6">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h2 className="text-lg font-bold text-foreground mb-1">학원 계정을 설정해주세요</h2>
              <p className="text-sm text-muted-foreground">
                새 학원을 등록하거나, 기존 학원에 참여할 수 있습니다
              </p>
            </div>
          )}

          {/* Option 1: Register New Academy */}
          <Card 
            className={`shadow-card border-border cursor-pointer transition-colors ${
              isVerified ? 'hover:border-primary/50' : 'opacity-90'
            }`}
            onClick={handleRegisterNewAcademy}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground">새 학원 등록하기</h4>
                  {!verificationLoading && !isVerified && (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {isVerified 
                    ? "원장으로서 새 학원을 등록합니다"
                    : "사업자 인증 후 등록 가능합니다"
                  }
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-4 py-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">또는</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Option 2: Join Existing Academy */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">기존 학원에 참여하기</CardTitle>
                  <CardDescription className="text-xs">
                    참여 코드로 학원 관리자가 됩니다
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                학원 원장님에게 받은 6자리 참여 코드를 입력하세요.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="참여 코드 (예: ABC123)"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  className="uppercase text-center tracking-widest font-mono"
                />
                <Button 
                  onClick={handleJoinByCode}
                  disabled={joining || !joinCode.trim()}
                >
                  {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : "참여"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Business Verification Link (if not verified) */}
          {!isVerified && !verificationLoading && (
            <Card 
              className="shadow-card border-warning/20 bg-warning/5 cursor-pointer hover:border-warning/50 transition-colors"
              onClick={() => navigate("/admin/verification")}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-warning" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground text-sm">사업자 인증하기</h4>
                  <p className="text-xs text-muted-foreground">
                    새 학원을 등록하려면 사업자 인증이 필요합니다
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          )}

          {/* Verification Status (if pending) */}
          {isPending && (
            <Card 
              className="shadow-card border-warning/20 bg-warning/5 cursor-pointer"
              onClick={() => navigate("/admin/verification")}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground text-sm">사업자 인증 심사 중</h4>
                  <p className="text-xs text-muted-foreground">
                    영업일 1-2일 내 심사가 완료됩니다
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
        </main>
        <AdminBottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Logo size="sm" showText={false} />
          <span className="text-xs font-medium text-primary bg-secondary px-2 py-1 rounded-full">프로필 관리</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-6">
            <TabsTrigger value="profile" className="gap-1 text-xs">
              <Building2 className="w-3 h-3" />
              프로필
            </TabsTrigger>
            <TabsTrigger value="teachers" className="gap-1 text-xs">
              <Users className="w-3 h-3" />
              강사진
            </TabsTrigger>
            <TabsTrigger value="classes" className="gap-1 text-xs">
              <BookOpen className="w-3 h-3" />
              개설 강좌
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  로고 이미지 (정사각형)
                </CardTitle>
                <CardDescription className="text-xs">
                  프로필 목록, 검색 결과에 표시됩니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  value={profileImage}
                  onChange={setProfileImage}
                  folder="academies"
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Image className="w-4 h-4 text-primary" />
                  배너 사진 (직사각형)
                </CardTitle>
                <CardDescription className="text-xs">
                  학원 상세 페이지 상단에 표시됩니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ImageUpload
                  value={bannerImage}
                  onChange={setBannerImage}
                  folder="academies"
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  학원명
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  학원 주소
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AddressSearch 
                  value={address} 
                  onChange={setAddress} 
                  placeholder="주소를 검색해주세요"
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  학원 소개글
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tags className="w-4 h-4 text-primary" />
                  특징 태그
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                      {tag}
                      <button onClick={() => handleRemoveTag(tag)} className="ml-1 p-0.5">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="태그 입력"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                  />
                  <Button variant="outline" size="icon" onClick={handleAddTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Target Region Selector */}
            {isProfileLocked ? (
              <Card className="shadow-card border-warning/30 bg-warning/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium flex items-center gap-2 text-warning">
                    <Lock className="w-4 h-4" />
                    타겟 설정 잠금됨
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-3">
                    슈퍼관리자에 의해 타겟 지역 및 타겟 태그 설정이 잠금되었습니다.
                    변경이 필요하시면 슈퍼관리자에게 문의해주세요.
                  </p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {targetRegions.map(region => (
                        <Badge key={region} variant="secondary" className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          {region}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {targetTags.map(tag => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          <Target className="w-3 h-3 mr-1" />
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <TargetRegionSelector
                  selectedRegions={targetRegions}
                  onChange={setTargetRegions}
                />

                {/* Target Tags Editor for Recommendation */}
                <AcademyTargetTagsEditor
                  selectedTags={targetTags}
                  onChange={setTargetTags}
                />
              </>
            )}


            <Button className="w-full gap-2" onClick={handleSaveProfile} disabled={saving}>
              <Save className="w-4 h-4" />
              {saving ? "저장 중..." : "프로필 저장"}
            </Button>
          </TabsContent>

          {/* Teachers Tab */}
          <TabsContent value="teachers" className="space-y-4">
            <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" onClick={() => openTeacherDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  강사 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingTeacher ? "강사 수정" : "강사 추가"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Link to Academy Member */}
                  <div className="space-y-2">
                    <Label>관리자 연동</Label>
                    <Select 
                      value={teacherMemberId || "none"} 
                      onValueChange={(value) => {
                        const newValue = value === "none" ? "" : value;
                        setTeacherMemberId(newValue);
                        // Auto-fill name from member
                        if (newValue) {
                          const member = academyMembers.find(m => m.id === newValue);
                          if (member?.profile?.user_name) {
                            setTeacherName(member.profile.user_name);
                          }
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="관리자 선택 (선택사항)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">연동 안함</SelectItem>
                        {academyMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {getMemberDisplayName(member)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      관리자와 연동하면 이름과 등급이 자동으로 표시됩니다
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>이름 *</Label>
                    <Input 
                      value={teacherName} 
                      onChange={(e) => setTeacherName(e.target.value)} 
                      disabled={!!teacherMemberId}
                      placeholder={teacherMemberId ? "관리자 이름이 자동 적용됩니다" : "강사 이름"}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>담당 과목</Label>
                    <Input value={teacherSubject} onChange={(e) => setTeacherSubject(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>약력</Label>
                    <Textarea value={teacherBio} onChange={(e) => setTeacherBio(e.target.value)} rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label>프로필 사진</Label>
                    <ImageUpload
                      value={teacherImage}
                      onChange={setTeacherImage}
                      folder="teachers"
                    />
                  </div>
                  <Button className="w-full" onClick={handleSaveTeacher}>
                    저장
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {teachers.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="p-6 text-center">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">등록된 강사가 없습니다</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    관리자 탭에서 등록된 멤버를 강사로 추가할 수 있습니다
                  </p>
                </CardContent>
              </Card>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleTeacherDragEnd}
              >
                <SortableContext
                  items={teachers.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {teachers.map((teacher) => {
                      const displayInfo = getTeacherDisplayInfo(teacher);
                      return (
                        <SortableProfileRow key={teacher.id} id={teacher.id}>
                          {(dragHandle) => (
                            <Card className="shadow-card">
                              <CardContent className="p-4">
                                <div className="flex items-center gap-2">
                                  {dragHandle}
                                  <div className="flex min-w-0 flex-1 items-center gap-3">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                                      {teacher.image_url ? (
                                        <img src={teacher.image_url} alt={displayInfo.name} className="h-full w-full object-cover" />
                                      ) : (
                                        <GraduationCap className="h-6 w-6 text-primary" />
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-medium text-foreground">{displayInfo.name}</h4>
                                        {displayInfo.grade && (
                                          <Badge variant="secondary" className="text-xs">
                                            {displayInfo.grade}
                                          </Badge>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground">{teacher.subject || "과목 미지정"}</p>
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openTeacherDialog(teacher)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const info = getTeacherDisplayInfo(teacher);
                                        setPendingDelete({ kind: "teacher", id: teacher.id, name: info.name });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </div>
                                {teacher.bio && (
                                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                                    {teacher.bio}
                                  </p>
                                )}
                              </CardContent>
                            </Card>
                          )}
                        </SortableProfileRow>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent
            value="classes"
            className="bg-transparent border-0 focus-visible:ring-0 focus-visible:outline-none p-0"
          >
            <div className="space-y-4">
              <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" onClick={() => openClassDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    강좌 추가
                  </Button>
                </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden bg-card border-0 shadow-lg">
                  <DialogHeader>
                    <DialogTitle>{editingClass ? "강좌 수정" : "강좌 추가"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>강좌명 *</Label>
                      <Input value={className} onChange={(e) => setClassName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>과목</Label>
                      <Select
                        value={classSubject || "__none__"}
                        onValueChange={(v) => setClassSubject(v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="과목을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">선택 안 함</SelectItem>
                          {CLASS_SUBJECT_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>대상 학년</Label>
                      <div className="flex flex-wrap gap-2">
                        {gradeChipOptions.map((year) => (
                          <Button
                            key={year}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={`rounded-full px-3 h-8 text-xs min-w-[44px] ${
                              classYears.includes(year)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-foreground"
                            }`}
                            onClick={() => toggleClassYear(year)}
                          >
                            {year}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <ClassScheduleInput value={classSchedule} onChange={setClassSchedule} />
                    </div>
                    <div className="space-y-2">
                      <Label>수강료 (원)</Label>
                      <Input type="number" value={classFee} onChange={(e) => setClassFee(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>담당 강사</Label>
                      <Select value={classTeacherId} onValueChange={setClassTeacherId}>
                        <SelectTrigger>
                          <SelectValue placeholder="선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {teachers.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Tags className="w-4 h-4 text-primary" />
                        특징 태그
                      </Label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {classTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                            {tag}
                            <button onClick={() => handleRemoveClassTag(tag)} className="ml-1 p-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          placeholder="태그 입력"
                          value={classNewTag}
                          onChange={(e) => setClassNewTag(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleAddClassTag()}
                        />
                        <Button variant="outline" size="icon" onClick={handleAddClassTag}>
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>설명</Label>
                      <Textarea value={classDescription} onChange={(e) => setClassDescription(e.target.value)} rows={3} />
                    </div>
                    
                    {/* Curriculum Editor */}
                    <div className="border-t pt-4">
                      <CurriculumEditor
                        curriculum={classCurriculum}
                        onChange={setClassCurriculum}
                      />
                    </div>
                    
                    <Button className="w-full" onClick={handleSaveClass}>
                      저장
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {classes.length === 0 ? (
                <Card className="shadow-card">
                  <CardContent className="p-6 text-center">
                    <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">등록된 강좌가 없습니다</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">과목별 보기</Label>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Select value={classListSubjectFilter} onValueChange={setClassListSubjectFilter}>
                        <SelectTrigger
                          className={cn(
                            CLASS_SUBJECT_FILTER_TRIGGER_CLASS,
                            "h-9 w-36 max-w-[42vw] shrink-0"
                          )}
                        >
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
                      <div className="flex items-center gap-2">
                        <Label
                          htmlFor="class-active-filter-only"
                          className="text-sm font-normal whitespace-nowrap text-foreground"
                        >
                          활성화 강좌
                        </Label>
                        <Switch
                          id="class-active-filter-only"
                          checked={classActiveFilterOnly}
                          onCheckedChange={setClassActiveFilterOnly}
                        />
                      </div>
                    </div>
                    {(classListSubjectFilter !== CLASS_SUBJECT_FILTER_ALL || classActiveFilterOnly) && (
                      <p className="text-xs text-muted-foreground">
                        과목 필터를 사용하거나 「활성화 강좌」만 켜 두면 순서 변경(드래그)을 사용할 수 없습니다. 전체
                        과목·비활성 강좌까지 표시하면 드래그로 순서를 바꿀 수 있습니다.
                      </p>
                    )}
                  </div>
                  {classesForListView.length === 0 ? (
                    <Card className="shadow-card">
                      <CardContent className="p-6 text-center">
                        <p className="text-sm text-muted-foreground">
                          선택한 조건에 맞는 강좌가 없습니다
                        </p>
                      </CardContent>
                    </Card>
                  ) : canReorderClasses ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleClassDragEnd}
                    >
                      <SortableContext
                        items={classes.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {classes.map((cls) => (
                            <SortableProfileRow key={cls.id} id={cls.id}>
                              {(dragHandle) => (
                                <OpenedClassCourseCard
                                  cls={cls}
                                  dragHandle={dragHandle}
                                  onEdit={openClassDialog}
                                  onCopy={openClassDialogAsCopy}
                                  onRequestDelete={(c) =>
                                    setPendingDelete({ kind: "class", id: c.id, name: c.name })
                                  }
                                  onToggleActive={handleToggleClassActive}
                                  onToggleRecruiting={handleToggleRecruiting}
                                />
                              )}
                            </SortableProfileRow>
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : (
                    <div className="space-y-3">
                      {classesForListView.map((cls) => (
                        <OpenedClassCourseCard
                          key={cls.id}
                          cls={cls}
                          onEdit={openClassDialog}
                          onCopy={openClassDialogAsCopy}
                          onRequestDelete={(c) =>
                            setPendingDelete({ kind: "class", id: c.id, name: c.name })
                          }
                          onToggleActive={handleToggleClassActive}
                          onToggleRecruiting={handleToggleRecruiting}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </main>

      {user && (
        <NicknameSettingsDialog
          open={isNicknameDialogOpen}
          onOpenChange={setIsNicknameDialogOpen}
          currentNickname={userProfile?.user_name || ""}
          userId={user.id}
          onSuccess={(newNickname) => setUserProfile({ user_name: newNickname })}
        />
      )}

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => {
          if (!open && !deleteSubmitting) setPendingDelete(null);
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingDelete?.kind === "teacher" ? "강사 삭제" : "강좌 삭제"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete && (
                <>
                  <span className="font-medium text-foreground">{pendingDelete.name}</span> 항목을 삭제하시겠습니까?
                  삭제된 항목은 복구할 수 없습니다.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleteSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSubmitting ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AdminBottomNavigation />
    </div>
  );
};

export default ProfileManagementPage;
