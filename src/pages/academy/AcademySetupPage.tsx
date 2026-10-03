import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessVerification } from "@/hooks/useBusinessVerification";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import Logo from "@/components/Logo";
import ImageUpload from "@/components/ImageUpload";
import AddressSearch from "@/components/AddressSearch";
import { loadNaverMapScript, geocodeAddress } from "@/utils/naverMap";
import { ArrowLeft, Building2, MapPin, BookOpen, GraduationCap, FileCheck, ShieldAlert } from "lucide-react";

const SUBJECTS = ["수학", "영어", "국어", "과학", "사회", "음악", "미술", "체육", "코딩", "기타"];

const TARGET_GRADES = [
  { id: "kindergarten", label: "유아" },
  { id: "elementary", label: "초등" },
  { id: "middle", label: "중등" },
  { id: "high", label: "고등" },
];

const AcademySetupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isVerified, loading: verificationLoading } = useBusinessVerification();
  const [loading, setLoading] = useState(false);
  const [checkingAcademy, setCheckingAcademy] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [subject, setSubject] = useState("");
  const [targetGrades, setTargetGrades] = useState<string[]>([]);
  const [profileImage, setProfileImage] = useState("");
  const [bannerImage, setBannerImage] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const redirect = location.pathname + location.search;
        navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
        return;
      }
      
      setUser(session.user);

      // Check if user already has an academy
      const { data: existingAcademy } = await supabase
        .from("academies")
        .select("id")
        .eq("owner_id", session.user.id)
        .maybeSingle();

      if (existingAcademy) {
        // "/" 는 AuthPage(로그인)라 학원 계정이 로그아웃된 것처럼 보임 → 관리자 메인 홈으로 이동
        navigate("/admin/home", { replace: true });
        return;
      }

      setCheckingAcademy(false);
    };

    checkAuth();
  }, [navigate]);

  const handleTargetGradeChange = (gradeId: string, checked: boolean) => {
    if (checked) {
      setTargetGrades([...targetGrades, gradeId]);
    } else {
      setTargetGrades(targetGrades.filter(g => g !== gradeId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: "학원명을 입력해주세요", variant: "destructive" });
      return;
    }
    if (!address.trim()) {
      toast({ title: "학원 주소를 입력해주세요", variant: "destructive" });
      return;
    }
    if (!subject) {
      toast({ title: "대표 과목을 선택해주세요", variant: "destructive" });
      return;
    }
    if (targetGrades.length === 0) {
      toast({ title: "대상 학년을 선택해주세요", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const targetGradeStr = targetGrades
        .map(id => TARGET_GRADES.find(g => g.id === id)?.label)
        .join("/");

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

      // Create academy
      const { data: academyData, error: academyError } = await supabase
        .from("academies")
        .insert({
          name: name.trim(),
          address: trimmedAddress,
          subject,
          target_grade: targetGradeStr,
          profile_image: profileImage || null,
          banner_image: bannerImage || null,
          description: description.trim() || null,
          owner_id: user.id,
          tags: [],
          ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
        })
        .select('id')
        .single();

      if (academyError) throw academyError;

      // Add user as owner in academy_members (is_academy_owner now includes academies.owner_id so this succeeds)
      const { error: memberError } = await supabase
        .from("academy_members")
        .insert({
          academy_id: academyData.id,
          user_id: user.id,
          role: 'owner',
          status: 'approved',
          permissions: {
            manage_classes: true,
            manage_teachers: true,
            manage_posts: true,
            manage_seminars: true,
            manage_consultations: true,
            view_analytics: true,
            manage_settings: true,
            manage_members: true,
            edit_profile: true,
          },
        });

      if (memberError) {
        console.error("Error adding owner to academy_members:", memberError);
        toast({ title: "학원은 등록되었으나 멤버 등록에 실패했습니다. 관리자에게 문의하세요.", variant: "destructive" });
      }

      toast({ title: "학원이 성공적으로 등록되었습니다!" });
      navigate("/admin/home", { replace: true });
    } catch (error: any) {
      console.error("Error creating academy:", error);
      toast({ 
        title: "학원 등록 중 오류가 발생했습니다", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAcademy || verificationLoading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">확인 중...</div>
      </div>
    );
  }

  // Show verification required message if not verified
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-app-shell">
        {/* Header */}
        <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <h1 className="font-semibold text-foreground">내 학원 등록</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 py-6">
          <Card className="shadow-card border-border">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
                <ShieldAlert className="w-8 h-8 text-warning" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">사업자 인증이 필요합니다</h2>
              <p className="text-muted-foreground mb-6">
                학원 프로필을 등록하려면 먼저 사업자등록증 인증을 완료해야 합니다.
              </p>
              <Button 
                onClick={() => navigate('/admin/verification')}
                className="w-full"
                size="lg"
              >
                <FileCheck className="w-5 h-5 mr-2" />
                사업자 인증하러 가기
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-app-shell">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-semibold text-foreground">내 학원 등록</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4">
            <Logo size="md" showText={false} />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">학원 정보를 등록해주세요</h2>
          <p className="text-sm text-muted-foreground">
            등록하신 정보는 학부모님들에게 노출됩니다
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Academy Name */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                기본 정보
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="name">학원명 *</Label>
                <Input
                  id="name"
                  placeholder="예: 에듀플러스 수학학원"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="space-y-1">
                <Label>학원 로고 이미지 (정사각형)</Label>
                <ImageUpload
                  value={profileImage}
                  onChange={setProfileImage}
                  folder="academy-profiles"
                  className="mt-2"
                />
              </div>

              <div className="space-y-1">
                <Label>학원 배너 이미지 (직사각형)</Label>
                <ImageUpload
                  value={bannerImage}
                  onChange={setBannerImage}
                  folder="academy-profiles"
                  className="mt-2"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="description">학원 소개</Label>
                <Textarea
                  id="description"
                  placeholder="학원의 특장점, 교육 철학 등을 소개해주세요"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {description.length}/500자
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Location */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                위치 정보 *
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AddressSearch
                value={address}
                onChange={setAddress}
                placeholder="학원 주소를 검색해주세요"
              />
            </CardContent>
          </Card>

          {/* Subject & Target */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                과목 및 대상
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1">
                <Label>대표 과목 *</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="과목을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <GraduationCap className="w-4 h-4" />
                  대상 학년 *
                </Label>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {TARGET_GRADES.map((grade) => (
                    <div key={grade.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={grade.id}
                        checked={targetGrades.includes(grade.id)}
                        onCheckedChange={(checked) => 
                          handleTargetGradeChange(grade.id, checked as boolean)
                        }
                      />
                      <Label htmlFor={grade.id} className="text-sm font-normal cursor-pointer">
                        {grade.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            type="submit" 
            className="w-full h-12 text-base font-medium"
            disabled={loading}
          >
            {loading ? "등록 중..." : "학원 등록하기"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default AcademySetupPage;
