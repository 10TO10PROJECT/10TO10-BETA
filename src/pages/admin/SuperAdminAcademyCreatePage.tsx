import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import Logo from "@/components/Logo";
import ImageUpload from "@/components/ImageUpload";
import TargetRegionSelector from "@/components/TargetRegionSelector";
import AcademyTargetTagsEditor from "@/components/AcademyTargetTagsEditor";
import AddressSearch from "@/components/AddressSearch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
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
  GraduationCap,
  Shield,
  Loader2,
  MapPin,
  Target,
} from "lucide-react";
import CurriculumEditor from "@/components/CurriculumEditor";
import ClassScheduleInput from "@/components/ClassScheduleInput";
import { loadNaverMapScript, geocodeAddress } from "@/utils/naverMap";
import {
  CLASS_SUBJECT_OPTIONS,
  CLASS_SUBJECT_FILTER_ALL,
  CLASS_SUBJECT_FILTER_NONE,
  CLASS_SUBJECT_FILTER_TRIGGER_CLASS,
  filterClassesBySubject,
} from "@/lib/classSubjects";

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
  curriculum?: CurriculumStep[];
}

const SuperAdminAcademyCreatePage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isSuperAdmin, loading } = useSuperAdmin();
  const [saving, setSaving] = useState(false);
  const [createdAcademyId, setCreatedAcademyId] = useState<string | null>(null);

  // Profile state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [targetRegions, setTargetRegions] = useState<string[]>([]);
  const [targetTags, setTargetTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  // Teachers & Classes state
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classListSubjectFilter, setClassListSubjectFilter] = useState(CLASS_SUBJECT_FILTER_ALL);

  const filteredClasses = useMemo(
    () => filterClassesBySubject(classes, classListSubjectFilter),
    [classes, classListSubjectFilter]
  );

  // Dialog state
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  // Teacher form
  const [teacherName, setTeacherName] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherBio, setTeacherBio] = useState("");
  const [teacherImage, setTeacherImage] = useState("");

  // Class form
  const [className, setClassName] = useState("");
  const [classCourseSubject, setClassCourseSubject] = useState("");
  const [classGrade, setClassGrade] = useState("");
  const [classSchedule, setClassSchedule] = useState("");
  const [classFee, setClassFee] = useState("");
  const [classDescription, setClassDescription] = useState("");
  const [classTeacherId, setClassTeacherId] = useState("");
  const [classCurriculum, setClassCurriculum] = useState<CurriculumStep[]>([]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleCreateAcademy = async () => {
    if (!name.trim() || !subject.trim()) {
      toast({ title: "오류", description: "학원명과 과목은 필수입니다.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      const trimmedAddress = address.trim();
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

      const { data, error } = await supabase
        .from("academies")
        .insert({
          name: name.trim(),
          subject: subject.trim(),
          address: trimmedAddress || null,
          description: description.trim() || null,
          profile_image: profileImage || null,
          tags: tags,
          target_regions: targetRegions,
          target_tags: targetTags,
          owner_id: null,
          ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
        })
        .select("id")
        .single();

      if (error) throw error;

      setCreatedAcademyId(data.id);

      // Insert teachers if any
      if (teachers.length > 0) {
        const teachersWithAcademy = teachers.map(t => ({
          academy_id: data.id,
          name: t.name,
          subject: t.subject,
          bio: t.bio,
          image_url: t.image_url,
        }));
        
        const { data: insertedTeachers, error: teacherError } = await supabase
          .from("teachers")
          .insert(teachersWithAcademy)
          .select("id, name");
        
        if (teacherError) throw teacherError;

        // Map old temp IDs to new real IDs for classes
        const teacherIdMap = new Map<string, string>();
        teachers.forEach((t, index) => {
          if (insertedTeachers && insertedTeachers[index]) {
            teacherIdMap.set(t.id, insertedTeachers[index].id);
          }
        });

        // Insert classes with mapped teacher IDs
        if (classes.length > 0) {
          const classesWithAcademy = classes.map(c => ({
            academy_id: data.id,
            name: c.name,
            subject: c.subject,
            target_grade: c.target_grade,
            schedule: c.schedule,
            fee: c.fee,
            description: c.description,
            teacher_id: c.teacher_id ? teacherIdMap.get(c.teacher_id) || null : null,
            is_recruiting: c.is_recruiting ?? true,
            curriculum: c.curriculum as any,
          }));
          
          const { error: classError } = await supabase
            .from("classes")
            .insert(classesWithAcademy);
          
          if (classError) throw classError;
        }
      } else if (classes.length > 0) {
        // Insert classes without teacher references
        const classesWithAcademy = classes.map(c => ({
          academy_id: data.id,
          name: c.name,
          subject: c.subject,
          target_grade: c.target_grade,
          schedule: c.schedule,
          fee: c.fee,
          description: c.description,
          teacher_id: null,
          is_recruiting: c.is_recruiting ?? true,
          curriculum: c.curriculum as any,
        }));
        
        const { error: classError } = await supabase
          .from("classes")
          .insert(classesWithAcademy);
        
        if (classError) throw classError;
      }

      toast({ title: "생성 완료", description: `${name.trim()} 학원이 생성되었습니다.` });
      navigate("/admin/super/academies");
    } catch (error) {
      console.error("Error creating academy:", error);
      toast({ title: "오류", description: "학원 생성에 실패했습니다.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Teacher CRUD (local state only until academy is created)
  const resetTeacherForm = () => {
    setTeacherName("");
    setTeacherSubject("");
    setTeacherBio("");
    setTeacherImage("");
    setEditingTeacher(null);
  };

  const openTeacherDialog = (teacher?: Teacher) => {
    if (teacher) {
      setEditingTeacher(teacher);
      setTeacherName(teacher.name);
      setTeacherSubject(teacher.subject || "");
      setTeacherBio(teacher.bio || "");
      setTeacherImage(teacher.image_url || "");
    } else {
      resetTeacherForm();
    }
    setIsTeacherDialogOpen(true);
  };

  const handleSaveTeacher = () => {
    if (!teacherName.trim()) {
      toast({ title: "오류", description: "강사 이름은 필수입니다.", variant: "destructive" });
      return;
    }

    if (editingTeacher) {
      setTeachers(prev => prev.map(t => 
        t.id === editingTeacher.id 
          ? { ...t, name: teacherName, subject: teacherSubject || null, bio: teacherBio || null, image_url: teacherImage || null }
          : t
      ));
    } else {
      const newTeacher: Teacher = {
        id: `temp-${Date.now()}`,
        name: teacherName,
        subject: teacherSubject || null,
        bio: teacherBio || null,
        image_url: teacherImage || null,
      };
      setTeachers(prev => [...prev, newTeacher]);
    }

    setIsTeacherDialogOpen(false);
    resetTeacherForm();
  };

  const handleDeleteTeacher = (id: string) => {
    setTeachers(prev => prev.filter(t => t.id !== id));
    // Also remove teacher reference from classes
    setClasses(prev => prev.map(c => 
      c.teacher_id === id ? { ...c, teacher_id: null } : c
    ));
  };

  // Class CRUD (local state only)
  const resetClassForm = () => {
    setClassName("");
    setClassCourseSubject("");
    setClassGrade("");
    setClassSchedule("");
    setClassFee("");
    setClassDescription("");
    setClassTeacherId("");
    setClassCurriculum([]);
    setEditingClass(null);
  };

  const openClassDialog = (cls?: Class) => {
    if (cls) {
      setEditingClass(cls);
      setClassName(cls.name);
      setClassCourseSubject(cls.subject || "");
      setClassGrade(cls.target_grade || "");
      setClassSchedule(cls.schedule || "");
      setClassFee(cls.fee?.toString() || "");
      setClassDescription(cls.description || "");
      setClassTeacherId(cls.teacher_id || "");
      setClassCurriculum(cls.curriculum || []);
    } else {
      resetClassForm();
    }
    setIsClassDialogOpen(true);
  };

  const handleSaveClass = () => {
    if (!className.trim()) {
      toast({ title: "오류", description: "강좌명은 필수입니다.", variant: "destructive" });
      return;
    }

    if (editingClass) {
      setClasses(prev => prev.map(c => 
        c.id === editingClass.id 
          ? {
              ...c,
              name: className,
              subject: classCourseSubject.trim() || null,
              target_grade: classGrade || null,
              schedule: classSchedule || null,
              fee: classFee ? parseInt(classFee) : null,
              description: classDescription || null,
              teacher_id: classTeacherId || null,
              curriculum: classCurriculum,
            }
          : c
      ));
    } else {
      const newClass: Class = {
        id: `temp-${Date.now()}`,
        name: className,
        subject: classCourseSubject.trim() || null,
        target_grade: classGrade || null,
        schedule: classSchedule || null,
        fee: classFee ? parseInt(classFee) : null,
        description: classDescription || null,
        teacher_id: classTeacherId || null,
        is_recruiting: true,
        curriculum: classCurriculum,
      };
      setClasses(prev => [...prev, newClass]);
    }

    setIsClassDialogOpen(false);
    resetClassForm();
  };

  const handleDeleteClass = (id: string) => {
    setClasses(prev => prev.filter(c => c.id !== id));
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

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/super/academies')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">새 학원 추가</span>
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
                  학원 대표 사진
                </CardTitle>
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
                  <Building2 className="w-4 h-4 text-primary" />
                  학원명 <span className="text-destructive">*</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="학원명을 입력하세요"
                  maxLength={100}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  과목 <span className="text-destructive">*</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  placeholder="예: 수학, 영어, 국어"
                  maxLength={50}
                />
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
                  placeholder="주소를 입력해주세요"
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
                  placeholder="학원 소개를 입력하세요"
                  maxLength={500}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Tags className="w-4 h-4 text-primary" />
                  특징 태그
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
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
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  />
                  <Button variant="outline" size="icon" onClick={handleAddTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Target Region Selector */}
            <TargetRegionSelector
              selectedRegions={targetRegions}
              onChange={setTargetRegions}
            />

            {/* Target Tags Editor */}
            <AcademyTargetTagsEditor
              selectedTags={targetTags}
              onChange={setTargetTags}
            />
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
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{editingTeacher ? "강사 수정" : "강사 추가"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>이름 *</Label>
                    <Input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} />
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
                  <p className="text-xs text-muted-foreground mt-1">학원 생성 후에도 추가할 수 있습니다</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {teachers.map((teacher) => (
                  <Card key={teacher.id} className="shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                          {teacher.image_url ? (
                            <img src={teacher.image_url} alt={teacher.name} className="w-full h-full object-cover" />
                          ) : (
                            <GraduationCap className="w-6 h-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-foreground">{teacher.name}</h4>
                          <p className="text-xs text-muted-foreground">{teacher.subject || "과목 미지정"}</p>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openTeacherDialog(teacher)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteTeacher(teacher.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Classes Tab */}
          <TabsContent value="classes" className="space-y-4">
            <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" onClick={() => openClassDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  강좌 추가
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
                      value={classCourseSubject || "__none__"}
                      onValueChange={(v) => setClassCourseSubject(v === "__none__" ? "" : v)}
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
                    <Select value={classGrade} onValueChange={setClassGrade}>
                      <SelectTrigger>
                        <SelectValue placeholder="선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="초등 저학년">초등 저학년</SelectItem>
                        <SelectItem value="초등 고학년">초등 고학년</SelectItem>
                        <SelectItem value="중학생">중학생</SelectItem>
                        <SelectItem value="고등학생">고등학생</SelectItem>
                      </SelectContent>
                    </Select>
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
                  <p className="text-xs text-muted-foreground mt-1">학원 생성 후에도 추가할 수 있습니다</p>
                </CardContent>
              </Card>
            ) : (
              <>
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
                {filteredClasses.length === 0 ? (
                  <Card className="shadow-card">
                    <CardContent className="p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        선택한 조건에 맞는 강좌가 없습니다
                      </p>
                    </CardContent>
                  </Card>
                ) : (
              <div className="space-y-3">
                {filteredClasses.map((cls) => (
                  <Card key={cls.id} className="shadow-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-foreground truncate">{cls.name}</h4>
                            <Badge variant="secondary" className="text-[10px]">
                              {cls.is_recruiting ? "모집중" : "마감"}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {cls.subject && <span>과목: {cls.subject}</span>}
                            {cls.target_grade && <span>{cls.subject ? "• " : ""}{cls.target_grade}</span>}
                            {cls.schedule && <span>• {cls.schedule}</span>}
                            {cls.fee && <span>• {cls.fee.toLocaleString()}원</span>}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" onClick={() => openClassDialog(cls)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteClass(cls.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Create Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border p-4">
          <div className="max-w-lg mx-auto">
            <Button 
              className="w-full gap-2" 
              onClick={handleCreateAcademy} 
              disabled={saving || !name.trim() || !subject.trim()}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "생성 중..." : "학원 생성하기"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SuperAdminAcademyCreatePage;
