import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  UserPlus, 
  Trash2, 
  User, 
  School, 
  GraduationCap,
  Link2,
  Check,
  Smartphone
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BottomNavigation from "@/components/BottomNavigation";

interface StudentProfile {
  id: string;
  user_id: string | null;
  name: string;
  school_name: string | null;
  grade: string | null;
  is_virtual: boolean;
  created_at: string;
}

interface ParentChildRelation {
  id: string;
  parent_user_id: string;
  student_profile_id: string;
  is_primary: boolean;
  created_at: string;
  student_profile?: StudentProfile;
}

interface ConnectionCodeData {
  student_name: string;
  student_grade: string | null;
  student_school: string | null;
  student_profile_id: string;
  code_id: string;
}

const ChildConnectionPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [relations, setRelations] = useState<ParentChildRelation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 수동 등록 다이얼로그
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newChildName, setNewChildName] = useState("");
  const [newChildGrade, setNewChildGrade] = useState("");
  const [newChildSchool, setNewChildSchool] = useState("");
  
  // 코드 연결 다이얼로그
  const [connectionCode, setConnectionCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [foundStudent, setFoundStudent] = useState<ConnectionCodeData | null>(null);
  
  // 병합 다이얼로그
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [similarProfile, setSimilarProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    const fetchUserAndData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        await fetchData(session.user.id);
      }
      setLoading(false);
    };

    fetchUserAndData();
  }, []);

  const fetchData = async (uid: string) => {
    const { data, error } = await supabase
      .from("parent_child_relations")
      .select(`
        *,
        student_profile:student_profiles(*)
      `)
      .eq("parent_user_id", uid)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching relations:", error);
      return;
    }

    const formattedRelations = (data || []).map((r: any) => ({
      ...r,
      student_profile: r.student_profile ? {
        ...r.student_profile,
        is_virtual: r.student_profile.user_id === null,
      } : undefined,
    }));

    setRelations(formattedRelations);
  };

  const handleAddManualChild = async () => {
    if (!userId || !newChildName.trim()) {
      toast.error("자녀 이름을 입력해주세요");
      return;
    }

    try {
      // 1. 가상 프로필 생성
      const { data: profile, error: profileError } = await supabase
        .from("student_profiles")
        .insert({
          name: newChildName.trim(),
          grade: newChildGrade.trim() || null,
          school_name: newChildSchool.trim() || null,
          user_id: null, // 가상 프로필
        })
        .select()
        .single();

      if (profileError) throw profileError;

      // 2. 부모-자녀 관계 생성
      const { error: relationError } = await supabase
        .from("parent_child_relations")
        .insert({
          parent_user_id: userId,
          student_profile_id: profile.id,
          is_primary: relations.length === 0,
        });

      if (relationError) throw relationError;

      await fetchData(userId);
      setShowAddDialog(false);
      setNewChildName("");
      setNewChildGrade("");
      setNewChildSchool("");
      toast.success("자녀 프로필이 추가되었습니다");
    } catch (error) {
      console.error("Error adding child:", error);
      toast.error("자녀 추가에 실패했습니다");
    }
  };

  const handleDeleteProfile = async (profileId: string, isVirtual: boolean) => {
    if (!isVirtual) {
      toast.error("실제 학생 계정과 연결된 프로필은 삭제할 수 없습니다");
      return;
    }

    if (!confirm("이 자녀 프로필을 삭제하시겠습니까? 관련된 수업 등록 정보도 함께 삭제됩니다.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("student_profiles")
        .delete()
        .eq("id", profileId);

      if (error) throw error;

      if (userId) await fetchData(userId);
      toast.success("자녀 프로필이 삭제되었습니다");
    } catch (error) {
      console.error("Error deleting profile:", error);
      toast.error("삭제에 실패했습니다");
    }
  };

  const handleSearchCode = async () => {
    if (!connectionCode.trim() || connectionCode.length !== 6) {
      toast.error("6자리 연결 코드를 입력해주세요");
      return;
    }

    setCodeLoading(true);
    try {
      // 코드로 학생 정보 조회
      const { data: codeData, error } = await supabase
        .from("connection_codes")
        .select(`
          id,
          student_profile_id,
          student_profile:student_profiles(id, name, grade, school_name)
        `)
        .eq("code", connectionCode.toUpperCase().trim())
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();

      if (error) throw error;

      if (!codeData || !codeData.student_profile) {
        toast.error("유효하지 않거나 만료된 코드입니다");
        return;
      }

      const profile = codeData.student_profile as any;
      setFoundStudent({
        student_name: profile.name,
        student_grade: profile.grade,
        student_school: profile.school_name,
        student_profile_id: profile.id,
        code_id: codeData.id,
      });

      // 비슷한 이름의 기존 프로필이 있는지 확인
      const existingProfile = relations.find(
        r => r.student_profile?.name === profile.name && r.student_profile?.is_virtual
      );

      if (existingProfile?.student_profile) {
        setSimilarProfile(existingProfile.student_profile);
        setShowMergeDialog(true);
      } else {
        setShowConfirmDialog(true);
      }
    } catch (error) {
      console.error("Error searching code:", error);
      toast.error("코드 조회에 실패했습니다");
    } finally {
      setCodeLoading(false);
    }
  };

  const handleConfirmConnection = async (mergeWithProfileId?: string) => {
    if (!userId || !foundStudent) return;

    try {
      if (mergeWithProfileId) {
        // 병합: 기존 가상 프로필을 실제 프로필로 업데이트
        // 먼저 기존 관계 삭제
        await supabase
          .from("parent_child_relations")
          .delete()
          .eq("student_profile_id", mergeWithProfileId);

        // 기존 가상 프로필 삭제
        await supabase
          .from("student_profiles")
          .delete()
          .eq("id", mergeWithProfileId);
      }

      // 새 관계 생성
      const { error: relationError } = await supabase
        .from("parent_child_relations")
        .insert({
          parent_user_id: userId,
          student_profile_id: foundStudent.student_profile_id,
          is_primary: relations.length === 0,
        });

      if (relationError) throw relationError;

      // 코드 사용 처리
      const { error: codeError } = await supabase
        .from("connection_codes")
        .update({
          status: "used",
          used_by_parent_id: userId,
        })
        .eq("id", foundStudent.code_id);

      if (codeError) throw codeError;

      await fetchData(userId);
      setShowConfirmDialog(false);
      setShowMergeDialog(false);
      setFoundStudent(null);
      setSimilarProfile(null);
      setConnectionCode("");
      toast.success("자녀와 연결되었습니다!");
    } catch (error) {
      console.error("Error connecting:", error);
      toast.error("연결에 실패했습니다");
    }
  };

  // 가상 자녀 (수동 등록)
  const virtualChildren = relations.filter(r => r.student_profile?.is_virtual);
  // 실제 연결된 자녀
  const connectedChildren = relations.filter(r => !r.student_profile?.is_virtual);

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">자녀 관리</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 자녀 추가 탭 */}
        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="code" className="gap-2">
              <Link2 className="w-4 h-4" />
              코드로 연결
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <UserPlus className="w-4 h-4" />
              직접 입력
            </TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">자녀 앱과 연결</h3>
                    <p className="text-sm text-muted-foreground">
                      자녀가 발급한 6자리 코드를 입력하세요
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <Input
                    value={connectionCode}
                    onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
                    placeholder="예: 7K2L9M"
                    className="font-mono text-center text-xl tracking-[0.5em] uppercase"
                    maxLength={6}
                  />
                  <Button
                    onClick={handleSearchCode}
                    disabled={codeLoading || connectionCode.length !== 6}
                    className="w-full"
                  >
                    {codeLoading ? "조회 중..." : "연결하기"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <UserPlus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">자녀 정보 직접 입력</h3>
                    <p className="text-sm text-muted-foreground">
                      자녀가 앱을 사용하지 않는 경우
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(true)}
                  className="w-full gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  자녀 프로필 추가
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* 연결된 자녀 (실제 계정) */}
        {connectedChildren.length > 0 && (
          <section>
            <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-primary" />
              연결된 자녀
            </h2>
            <div className="space-y-2">
              {connectedChildren.map((relation) => (
                <Card key={relation.id} className="border-primary/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{relation.student_profile?.name}</p>
                          <Badge variant="default" className="text-xs">연결됨</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {relation.student_profile?.school_name && (
                            <span className="flex items-center gap-1">
                              <School className="w-3 h-3" />
                              {relation.student_profile.school_name}
                            </span>
                          )}
                          {relation.student_profile?.grade && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" />
                              {relation.student_profile.grade}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* 수동 등록 자녀 (가상 프로필) */}
        {virtualChildren.length > 0 && (
          <section>
            <h2 className="text-base font-semibold mb-3 text-muted-foreground">
              수동 등록 자녀
            </h2>
            <div className="space-y-2">
              {virtualChildren.map((relation) => (
                <Card key={relation.id} className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{relation.student_profile?.name}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          {relation.student_profile?.school_name && (
                            <span className="flex items-center gap-1">
                              <School className="w-3 h-3" />
                              {relation.student_profile.school_name}
                            </span>
                          )}
                          {relation.student_profile?.grade && (
                            <span className="flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" />
                              {relation.student_profile.grade}
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => relation.student_profile && handleDeleteProfile(
                          relation.student_profile.id, 
                          relation.student_profile.is_virtual
                        )}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* 안내 */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">
              <strong>• 코드로 연결:</strong> 자녀가 앱에서 발급한 코드를 입력하면 데이터가 연동됩니다.<br />
              <strong>• 직접 입력:</strong> 자녀가 앱을 사용하지 않을 때 수동으로 관리할 수 있습니다.<br />
              <strong>• 병합:</strong> 나중에 자녀가 앱을 설치하면 기존 데이터를 자녀 계정에 연결할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* 수동 자녀 추가 다이얼로그 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>자녀 정보 입력</DialogTitle>
            <DialogDescription>
              자녀의 정보를 직접 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>이름 *</Label>
              <Input
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                placeholder="예: 김민수"
              />
            </div>
            <div className="space-y-2">
              <Label>학교 (선택)</Label>
              <Input
                value={newChildSchool}
                onChange={(e) => setNewChildSchool(e.target.value)}
                placeholder="예: 동탄중학교"
              />
            </div>
            <div className="space-y-2">
              <Label>학년 (선택)</Label>
              <Input
                value={newChildGrade}
                onChange={(e) => setNewChildGrade(e.target.value)}
                placeholder="예: 중2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              취소
            </Button>
            <Button onClick={handleAddManualChild} disabled={!newChildName.trim()}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 학생 연결 확인 다이얼로그 */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>자녀 확인</DialogTitle>
            <DialogDescription>
              찾으시는 자녀가 맞나요?
            </DialogDescription>
          </DialogHeader>
          {foundStudent && (
            <div className="py-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{foundStudent.student_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {foundStudent.student_school && `${foundStudent.student_school} `}
                        {foundStudent.student_grade && foundStudent.student_grade}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => handleConfirmConnection()} className="w-full">
              네, 맞습니다
            </Button>
            <Button variant="outline" onClick={() => {
              setShowConfirmDialog(false);
              setFoundStudent(null);
              setConnectionCode("");
            }} className="w-full">
              아니요, 다시 입력할게요
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 병합 다이얼로그 */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-sm">
          <DialogHeader>
            <DialogTitle>기존 프로필과 합치기</DialogTitle>
            <DialogDescription>
              기존에 등록하신 '{similarProfile?.name}' 프로필과 합치시겠습니까?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <Card className="bg-muted/30">
              <CardContent className="p-3">
                <p className="text-sm font-medium">기존 수동 프로필</p>
                <p className="text-xs text-muted-foreground">{similarProfile?.name}</p>
              </CardContent>
            </Card>
            <div className="text-center text-muted-foreground">↓</div>
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-3">
                <p className="text-sm font-medium text-primary">실제 학생 계정</p>
                <p className="text-xs text-muted-foreground">{foundStudent?.student_name}</p>
              </CardContent>
            </Card>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button onClick={() => handleConfirmConnection(similarProfile?.id)} className="w-full">
              합치기
            </Button>
            <Button variant="outline" onClick={() => {
              setShowMergeDialog(false);
              setShowConfirmDialog(true);
            }} className="w-full">
              새로 추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default ChildConnectionPage;
