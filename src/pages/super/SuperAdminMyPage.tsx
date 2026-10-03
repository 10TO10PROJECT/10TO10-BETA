import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  User, 
  Settings, 
  HelpCircle, 
  LogOut, 
  ChevronRight,
  Loader2,
  Shield
} from "lucide-react";
import { toast } from "sonner";
import SuperAdminBottomNavigation from "@/components/SuperAdminBottomNavigation";
import NicknameSettingsDialog from "@/components/NicknameSettingsDialog";

interface Profile {
  id: string;
  user_name: string | null;
  email: string | null;
}

const SuperAdminMyPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNicknameDialog, setShowNicknameDialog] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const redirect = location.pathname + location.search;
        navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_name, email')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('로그아웃되었습니다');
      navigate('/auth');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('로그아웃에 실패했습니다');
    }
  };

  const menuItems = [
    {
      icon: User,
      label: "내 정보",
      path: "/super/my/profile",
      description: "프로필 관리"
    },
    {
      icon: Settings,
      label: "설정",
      path: "/super/settings",
      description: "앱 설정"
    },
    {
      icon: HelpCircle,
      label: "고객센터",
      path: "/super/customer-service",
      description: "문의 관리"
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center">
          <h1 className="font-semibold text-foreground">마이페이지</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Profile Card */}
        <Card className="shadow-card bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">
                    {profile?.user_name || '슈퍼관리자'}
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-medium bg-primary/20 text-primary rounded-full">
                    슈퍼관리자
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs text-primary"
                  onClick={() => setShowNicknameDialog(true)}
                >
                  닉네임 변경
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Card 
                key={item.path}
                className="shadow-card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(item.path)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground">{item.label}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </Button>
      </main>

      {profile && (
        <NicknameSettingsDialog
          open={showNicknameDialog}
          onOpenChange={setShowNicknameDialog}
          currentNickname={profile.user_name || ''}
          userId={profile.id}
          onSuccess={(newNickname) => {
            setProfile(prev => prev ? { ...prev, user_name: newNickname } : null);
          }}
        />
      )}

      <SuperAdminBottomNavigation />
    </div>
  );
};

export default SuperAdminMyPage;
