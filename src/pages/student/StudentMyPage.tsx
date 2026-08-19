import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import StudentBottomNavigation from "@/components/StudentBottomNavigation";
import Logo from "@/components/Logo";
import NicknameSettingsDialog from "@/components/NicknameSettingsDialog";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  Heart, 
  Settings, 
  HelpCircle, 
  LogOut,
  Pencil,
  BookOpen,
  Users,
  FileText,
  Sparkles,
  User,
  UserX
} from "lucide-react";
import { toast } from "sonner";

const StudentMyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [reservationCount, setReservationCount] = useState(0);
  const [seminarCount, setSeminarCount] = useState(0);
  const [isNicknameDialogOpen, setIsNicknameDialogOpen] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchCounts(session.user.id);
          }, 0);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        fetchCounts(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data);
  };

  const fetchCounts = async (userId: string) => {
    try {
      const { count: resCount } = await supabase
        .from("consultation_reservations")
        .select("*", { count: "exact", head: true })
        .eq("parent_id", userId)
        .neq("status", "cancelled");
      setReservationCount(resCount || 0);

      const { count: semCount } = await supabase
        .from("seminar_applications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      setSeminarCount(semCount || 0);
    } catch (error) {
      console.error("Error fetching counts:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("로그아웃되었습니다");
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-center">
          <Logo size="sm" showText={false} />
        </div>
      </header>

      {/* Profile Section */}
      <div className="gradient-primary pt-6 pb-8 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center shadow-soft overflow-hidden">
              {profile?.image_url ? (
                <img
                  src={profile.image_url}
                  alt="프로필 사진"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-primary">
                  {profile?.user_name?.charAt(0) || "U"}
                </span>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-primary-foreground">
                  {profile?.user_name || "사용자"}
                </h2>
                {user && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-6 h-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-card/20"
                    onClick={() => setIsNicknameDialogOpen(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-primary-foreground/80">학생 회원</p>
            </div>
            {!user ? (
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-card/20 text-primary-foreground border-none hover:bg-card/30"
                onClick={() => {
                  const redirect = location.pathname + location.search;
                  navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
                }}
              >
                로그인
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 -mt-4">
        {/* Quick Stats Card */}
        <div 
          className="bg-card rounded-2xl p-4 shadow-card mb-6 cursor-pointer hover:shadow-soft transition-all"
          onClick={() => navigate("/s/my/reservations")}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">내 예약</span>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-primary">{reservationCount}</p>
              <p className="text-xs text-muted-foreground">방문 상담</p>
            </div>
            <div className="text-center py-2">
              <p className="text-2xl font-bold text-accent">{seminarCount}</p>
              <p className="text-xs text-muted-foreground">설명회</p>
            </div>
          </div>
        </div>

        {/* My Activity Menu List */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden mb-6">
          {user && (
            <>
              <MenuItemButton 
                icon={User} 
                label="내 정보" 
                onClick={() => navigate("/s/my/profile")} 
              />
              <MenuItemButton 
                icon={BookOpen} 
                label="MY CLASS" 
                onClick={() => navigate("/s/my/classes")} 
              />
              <MenuItemButton 
                icon={Heart} 
                label="찜한 학원" 
                onClick={() => navigate("/s/my/bookmarks")} 
              />
            </>
          )}
        </div>

        {/* Service Menu List */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden mb-6">
          {user && (
            <>
              <MenuItemButton 
                icon={Users} 
                label="부모님 연결" 
                onClick={() => navigate("/s/parent-connection")} 
              />
              <MenuItemButton 
                icon={FileText} 
                label="성적 등록" 
                onClick={() => toast.info("성적 등록 기능은 준비 중입니다")} 
              />
              <MenuItemButton 
                icon={Sparkles} 
                label="성향 테스트" 
                onClick={() => navigate("/s/preference-test")} 
              />
            </>
          )}
        </div>

        {/* Menu List */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          <MenuItemButton icon={UserX} label="차단 목록 관리" onClick={() => navigate("/s/my/blocked-users")} />
          <MenuItemButton icon={Settings} label="설정" onClick={() => navigate("/s/settings")} />
          <MenuItemButton icon={HelpCircle} label="고객센터" onClick={() => navigate("/s/customer-service")} />
          {user && (
            <MenuItemButton 
              icon={LogOut} 
              label="로그아웃" 
              variant="destructive" 
              onClick={handleLogout}
            />
          )}
        </div>

        {user && (
          <NicknameSettingsDialog
            open={isNicknameDialogOpen}
            onOpenChange={setIsNicknameDialogOpen}
            currentNickname={profile?.user_name || ""}
            userId={user.id}
            onSuccess={(newNickname) => setProfile((prev: any) => ({ ...prev, user_name: newNickname }))}
          />
        )}
      </main>

      <StudentBottomNavigation />
    </div>
  );
};

interface MenuItemButtonProps {
  icon: React.ElementType;
  label: string;
  variant?: "default" | "destructive";
  onClick: () => void;
}

const MenuItemButton = ({ icon: Icon, label, variant = "default", onClick }: MenuItemButtonProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
  >
    <div className="flex items-center gap-3">
      <Icon className={`w-5 h-5 ${variant === "destructive" ? "text-destructive" : "text-muted-foreground"}`} />
      <span className={`text-sm font-medium ${variant === "destructive" ? "text-destructive" : "text-foreground"}`}>
        {label}
      </span>
    </div>
    <ChevronRight className="w-4 h-4 text-muted-foreground" />
  </button>
);

export default StudentMyPage;
