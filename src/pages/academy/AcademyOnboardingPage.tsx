import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useBusinessVerification } from "@/hooks/useBusinessVerification";
import { useAcademyMembership } from "@/hooks/useAcademyMembership";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import Logo from "@/components/Logo";
import { ArrowLeft, Building2, Users, Loader2, Lock } from "lucide-react";

const AcademyOnboardingPage = () => {
  const navigate = useNavigate();
  const { isVerified, loading: verificationLoading } = useBusinessVerification();
  const { memberships, loading: membershipLoading, joinByCode } = useAcademyMembership();
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth?role=admin&mode=email");
        return;
      }
      setCheckingAuth(false);
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    // If user already has academy membership, redirect to dashboard
    if (!membershipLoading && memberships.length > 0) {
      navigate("/academy/dashboard");
    }
  }, [memberships, membershipLoading, navigate]);

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      toast.error("참여 코드를 입력해주세요");
      return;
    }

    setJoining(true);
    const result = await joinByCode(joinCode.trim());
    setJoining(false);

    if (result.success) {
      toast.success(`${result.academyName}에 참여했습니다!`);
      navigate("/academy/dashboard");
    } else {
      toast.error(result.error || "참여에 실패했습니다");
    }
  };

  const handleRegisterNewAcademy = () => {
    if (!isVerified) {
      toast.error("새 학원을 등록하려면 사업자 인증이 필요합니다");
      navigate('/admin/verification');
      return;
    }
    navigate('/academy/setup');
  };

  if (checkingAuth || membershipLoading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-muted rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-semibold text-foreground">학원 계정 설정</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4">
            <Logo size="md" showText={false} />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">학원 계정을 설정해주세요</h2>
          <p className="text-sm text-muted-foreground">
            새 학원을 등록하거나, 기존 학원에 참여할 수 있습니다
          </p>
        </div>

        <div className="space-y-4">
          {/* Option 1: Register New Academy */}
          <Card 
            className={`shadow-card border-border cursor-pointer transition-colors ${
              isVerified ? 'hover:border-primary/50' : 'opacity-80'
            }`}
            onClick={handleRegisterNewAcademy}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    새 학원 등록하기
                    {!isVerified && !verificationLoading && (
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    원장으로서 새 학원을 등록합니다
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">
                {isVerified 
                  ? "학원 정보를 입력하고 프로필을 생성합니다. 등록 후 다른 관리자를 초대할 수 있습니다."
                  : "사업자 인증을 완료하면 학원을 등록할 수 있습니다."
                }
              </p>
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
            <CardContent className="space-y-4">
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
        </div>
      </main>
    </div>
  );
};

export default AcademyOnboardingPage;
