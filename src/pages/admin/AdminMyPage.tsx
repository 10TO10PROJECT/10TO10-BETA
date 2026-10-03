import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, LogOut, Pencil, Building2, Users, FileCheck, Loader2, Lock, Clock, Settings, Headphones, UserX } from "lucide-react";
import { toast } from "sonner";
import NicknameSettingsDialog from "@/components/NicknameSettingsDialog";
import { useAcademyMembership } from "@/hooks/useAcademyMembership";
import { useBusinessVerification } from "@/hooks/useBusinessVerification";

const AdminMyPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);

  const { memberships, loading: membershipLoading, joinByCode } = useAcademyMembership();
  const { isVerified, isPending } = useBusinessVerification();

  const hasAcademy = memberships.length > 0;
  const hasApprovedAcademy = memberships.some(m => m.membership.status === 'approved');
  const hasPendingMembership = memberships.some(m => m.membership.status === 'pending');

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_name, image_url")
          .eq("id", session.user.id)
          .maybeSingle();
        
        setUserName(profile?.user_name || null);
        setUserImage((profile as any)?.image_url || null);
      }
    };
    fetchUserData();
  }, []);

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success("로그아웃되었습니다");
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error("로그아웃에 실패했습니다");
    }
  };

  const handleNicknameUpdate = (newName: string) => {
    setUserName(newName);
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      toast.error("참여 코드를 입력해주세요");
      return;
    }

    setJoining(true);
    const result = await joinByCode(joinCode.trim());
    setJoining(false);

    if (result.success) {
      if (result.pending) {
        toast.success(`${result.academyName}에 참여 요청을 보냈습니다. 원장님의 승인을 기다려주세요.`);
      } else {
        toast.success(`${result.academyName}에 참여했습니다`);
      }
      setJoinCode("");
    } else {
      toast.error(result.error || "참여에 실패했습니다");
    }
  };

  const handleRegisterNewAcademy = () => {
    if (!isVerified) {
      navigate("/admin/verification");
      return;
    }
    navigate("/academy/setup");
  };

  if (membershipLoading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Profile Section */}
        <Card className="shadow-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
                {userImage ? (
                  <img
                    src={userImage}
                    alt="프로필 사진"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-primary" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    {userName || "원장님"}
                  </h2>
                  <button
                    onClick={() => setIsNicknameDialogOpen(true)}
                    className="p-1 hover:bg-secondary rounded-full transition-colors"
                  >
                    <Pencil className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {user?.email || ""}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pending Membership Notice */}
        {hasPendingMembership && !hasApprovedAcademy && (
          <Card className="shadow-card border-amber-200 bg-amber-50 dark:bg-amber-950/30">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-amber-800 dark:text-amber-200">승인 대기 중</h4>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  학원 원장님의 승인을 기다리고 있습니다
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Academy Setup Section - Only show if no approved academy */}
        {!hasApprovedAcademy && !hasPendingMembership && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">학원 등록</h3>
            
            {/* Register New Academy */}
            <Card 
              className={`shadow-card border-border cursor-pointer hover:shadow-soft transition-all duration-200 ${!isVerified ? 'opacity-80' : ''}`}
              onClick={handleRegisterNewAcademy}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {!isVerified ? (
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <Building2 className="w-5 h-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground">새 학원 등록하기</h4>
                  <p className="text-sm text-muted-foreground">
                    {!isVerified 
                      ? isPending 
                        ? "사업자 인증 검토 중입니다" 
                        : "사업자 인증이 필요합니다"
                      : "직접 학원을 등록하고 운영하세요"
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Join Existing Academy */}
            <Card className="shadow-card border-border">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">기존 학원에 참여하기</h4>
                    <p className="text-sm text-muted-foreground">
                      참여 코드를 입력하여 관리자로 합류하세요
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="6자리 참여 코드"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="font-mono text-center tracking-widest"
                  />
                  <Button 
                    onClick={handleJoinByCode} 
                    disabled={joining || joinCode.length < 6}
                  >
                    {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : "참여"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Business Verification Card - Only if not verified */}
            {!isVerified && (
              <Card 
                className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all duration-200"
                onClick={() => navigate("/admin/verification")}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                    <FileCheck className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-foreground">사업자 인증하기</h4>
                    <p className="text-sm text-muted-foreground">
                      {isPending ? "인증 검토 중입니다" : "새 학원 등록을 위해 인증하세요"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Menu Items */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">내 계정</h3>
          
          {/* Profile Management */}
          <Card
            className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all duration-200"
            onClick={() => navigate("/admin/my/profile")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">내 정보</h4>
                <p className="text-sm text-muted-foreground">
                  개인정보를 관리합니다
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card
            className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all duration-200"
            onClick={() => navigate("/admin/my/blocked-users")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <UserX className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">차단 목록 관리</h4>
                <p className="text-sm text-muted-foreground">
                  차단한 사용자 목록을 관리합니다
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card
            className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all duration-200"
            onClick={() => navigate("/admin/settings")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">설정</h4>
                <p className="text-sm text-muted-foreground">
                  앱 설정을 변경합니다
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Customer Service */}
          <Card
            className="shadow-card border-border cursor-pointer hover:shadow-soft transition-all duration-200"
            onClick={() => navigate("/admin/customer-service")}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
                <Headphones className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">고객센터</h4>
                <p className="text-sm text-muted-foreground">
                  문의 및 도움말
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Logout */}
          <Card
            className="shadow-card border-destructive/20 cursor-pointer hover:shadow-soft transition-all duration-200"
            onClick={handleLogout}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <LogOut className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-destructive">로그아웃</h4>
                <p className="text-sm text-muted-foreground">
                  계정에서 로그아웃합니다
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <NicknameSettingsDialog
        open={isNicknameDialogOpen}
        onOpenChange={setIsNicknameDialogOpen}
        currentNickname={userName || ""}
        userId={user?.id || ""}
        onSuccess={handleNicknameUpdate}
      />

      <AdminBottomNavigation />
    </div>
  );
};

export default AdminMyPage;