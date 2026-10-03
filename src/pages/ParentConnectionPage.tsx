import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, RefreshCw, Check, User, Clock, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import StudentBottomNavigation from "@/components/StudentBottomNavigation";

interface StudentProfile {
  id: string;
  name: string;
  school_name: string | null;
  grade: string | null;
}

interface ConnectionCode {
  id: string;
  code: string;
  status: string;
  expires_at: string;
  created_at: string;
}

interface ConnectedParent {
  id: string;
  parent_user_id: string;
  created_at: string;
}

const ParentConnectionPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [activeCode, setActiveCode] = useState<ConnectionCode | null>(null);
  const [connectedParents, setConnectedParents] = useState<ConnectedParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string>("");

  const fetchData = useCallback(async (uid: string) => {
    // 1. 자신의 student_profile 조회 (없으면 생성)
    let { data: profileData, error: profileError } = await supabase
      .from("student_profiles")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      console.error("Error fetching profile:", profileError);
    }

    // 프로필이 없으면 생성
    if (!profileData) {
      const { data: userData } = await supabase
        .from("profiles")
        .select("user_name")
        .eq("id", uid)
        .maybeSingle();

      const { data: newProfile, error: createError } = await supabase
        .from("student_profiles")
        .insert({
          user_id: uid,
          name: userData?.user_name || "학생",
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
      } else {
        profileData = newProfile;
      }
    }

    setProfile(profileData);

    // 2. 활성 코드 조회
    const { data: codeData } = await supabase
      .from("connection_codes")
      .select("*")
      .eq("issuer_user_id", uid)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setActiveCode(codeData);

    // 3. 연결된 부모 조회
    if (profileData) {
      const { data: parentsData } = await supabase
        .from("parent_child_relations")
        .select("*")
        .eq("student_profile_id", profileData.id);

      setConnectedParents(parentsData || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        fetchData(session.user.id);
      } else {
        setLoading(false);
      }
    };

    fetchUser();
  }, [fetchData]);

  // 실시간 코드 갱신 구독
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("connection_codes_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "connection_codes",
          filter: `issuer_user_id=eq.${userId}`,
        },
        () => {
          fetchData(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  // 타이머 업데이트
  useEffect(() => {
    if (!activeCode) {
      setTimeRemaining("");
      return;
    }

    const updateTimer = () => {
      const expiry = new Date(activeCode.expires_at);
      const now = new Date();
      const diff = expiry.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining("만료됨");
        setActiveCode(null);
        return;
      }

      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeCode]);

  const handleGenerateCode = async () => {
    if (!userId || !profile) return;

    setGeneratingCode(true);
    try {
      // 기존 pending 코드 만료 처리
      await supabase
        .from("connection_codes")
        .update({ status: "expired" })
        .eq("issuer_user_id", userId)
        .eq("status", "pending");

      // 새 코드 생성
      const { data: codeValue, error: codeError } = await supabase.rpc("generate_student_connection_code");
      if (codeError) throw codeError;

      const { data: newCode, error: insertError } = await supabase
        .from("connection_codes")
        .insert({
          code: codeValue,
          issuer_user_id: userId,
          student_profile_id: profile.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setActiveCode(newCode);
      toast.success("연결 코드가 생성되었습니다");
    } catch (error) {
      console.error("Error generating code:", error);
      toast.error("코드 생성에 실패했습니다");
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode.code);
      toast.success("코드가 복사되었습니다");
    } catch {
      toast.error("코드 복사에 실패했습니다");
    }
  };

  const handleShare = async () => {
    if (!activeCode) return;
    
    const shareText = `부모님 앱의 [자녀 관리] 화면에서 이 코드를 입력해주세요: ${activeCode.code}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "부모님 연결 코드",
          text: shareText,
        });
      } catch (error) {
        // 사용자가 취소한 경우 무시
        if ((error as Error).name !== "AbortError") {
          handleCopyCode();
        }
      }
    } else {
      handleCopyCode();
    }
  };

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
          <h1 className="text-lg font-semibold">부모님 연결</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 코드 발급 섹션 */}
        <section>
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-5">
              <h2 className="font-semibold text-center mb-1">부모님께 전달할 코드</h2>
              <p className="text-sm text-muted-foreground text-center">
                부모님 앱의 [자녀 관리] 화면에 입력하세요
              </p>
            </div>
            
            <CardContent className="p-5 space-y-4">
              {activeCode ? (
                <>
                  {/* 코드 표시 */}
                  <div className="bg-muted rounded-2xl p-6 text-center">
                    <p className="font-mono text-4xl font-bold tracking-[0.3em] text-primary mb-2">
                      {activeCode.code}
                    </p>
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      <span>유효시간 {timeRemaining}</span>
                    </div>
                  </div>

                  {/* 버튼들 */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleCopyCode}
                      className="gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      코드 복사
                    </Button>
                    <Button
                      onClick={handleShare}
                      className="gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      공유하기
                    </Button>
                  </div>

                  {/* 새 코드 생성 */}
                  <Button
                    variant="ghost"
                    onClick={handleGenerateCode}
                    disabled={generatingCode}
                    className="w-full gap-2 text-muted-foreground"
                  >
                    <RefreshCw className={`w-4 h-4 ${generatingCode ? "animate-spin" : ""}`} />
                    새 코드 생성
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleGenerateCode}
                  disabled={generatingCode}
                  className="w-full h-16 text-lg gap-2"
                >
                  {generatingCode ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                  연결 코드 생성
                </Button>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 연결된 부모님 */}
        <section>
          <h2 className="text-base font-semibold mb-3">연결된 부모님</h2>

          {connectedParents.length === 0 ? (
            <Card className="bg-muted/30">
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  아직 연결된 부모님이 없습니다.
                </p>
                <p className="text-muted-foreground text-xs mt-1">
                  위에서 코드를 생성하여 부모님께 전달하세요.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {connectedParents.map((parent) => (
                <Card key={parent.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">부모님</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(parent.created_at).toLocaleDateString("ko-KR")} 연결됨
                        </p>
                      </div>
                      <Badge variant="default" className="gap-1">
                        <Check className="w-3 h-3" />
                        연결됨
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* 안내 */}
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <p className="text-xs text-muted-foreground">
              • 연결 코드는 10분간 유효합니다.<br />
              • 부모님이 코드를 입력하면 자동으로 연결됩니다.<br />
              • 연결되면 부모님이 시간표, 수업 정보 등을 함께 확인할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </main>

      <StudentBottomNavigation />
    </div>
  );
};

export default ParentConnectionPage;
