import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import BottomNavigation from "@/components/BottomNavigation";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import StudentBottomNavigation from "@/components/StudentBottomNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  Bell, 
  Moon, 
  Globe, 
  Shield, 
  Smartphone,
  Info
} from "lucide-react";
import { toast } from "sonner";

const SettingsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [marketingEnabled, setMarketingEnabled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Determine which navigation to show based on current path
  const isAdminRoute = location.pathname.startsWith("/admin");
  const isStudentRoute = location.pathname.startsWith("/s/");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
  }, []);

  const handleToggle = (setting: string, value: boolean) => {
    switch (setting) {
      case "push":
        setPushEnabled(value);
        toast.success(value ? "푸시 알림이 활성화되었습니다" : "푸시 알림이 비활성화되었습니다");
        break;
      case "marketing":
        setMarketingEnabled(value);
        toast.success(value ? "마케팅 수신에 동의했습니다" : "마케팅 수신을 거부했습니다");
        break;
      case "darkMode":
        setDarkMode(value);
        toast.info("다크 모드 기능은 준비 중입니다");
        break;
    }
  };

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-foreground">설정</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Notification Settings */}
        <Card className="shadow-card">
          <CardHeader className="pb-6">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              알림 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="push" className="text-sm">푸시 알림</Label>
              <Switch
                id="push"
                checked={pushEnabled}
                onCheckedChange={(v) => handleToggle("push", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="marketing" className="text-sm">마케팅 알림</Label>
              <Switch
                id="marketing"
                checked={marketingEnabled}
                onCheckedChange={(v) => handleToggle("marketing", v)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Display Settings */}
        <Card className="shadow-card">
          <CardHeader className="pb-6">
            <CardTitle className="text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" />
              화면 설정
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-muted-foreground" />
                <Label htmlFor="darkMode" className="text-sm">다크 모드</Label>
              </div>
              <Switch
                id="darkMode"
                checked={darkMode}
                onCheckedChange={(v) => handleToggle("darkMode", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">언어</span>
              </div>
              <span className="text-sm text-muted-foreground">한국어</span>
            </div>
          </CardContent>
        </Card>

        {/* Account & Privacy */}
        <Card className="shadow-card">
          <CardHeader className="pb-6">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              계정 및 개인정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button className="w-full text-left py-2 text-sm hover:text-primary transition-colors">
              개인정보 처리방침
            </button>
            <button className="w-full text-left py-2 text-sm hover:text-primary transition-colors">
              이용약관
            </button>
            {user && (
              <button className="w-full text-left py-2 text-sm text-destructive hover:text-destructive/80 transition-colors">
                회원 탈퇴
              </button>
            )}
          </CardContent>
        </Card>

        {/* App Info */}
        <Card className="shadow-card">
          <CardHeader className="pb-6">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" />
              앱 정보
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">버전</span>
              <span>1.0.0</span>
            </div>
          </CardContent>
        </Card>
      </main>

      {isAdminRoute ? (
        <AdminBottomNavigation />
      ) : isStudentRoute ? (
        <StudentBottomNavigation />
      ) : (
        <BottomNavigation />
      )}
    </div>
  );
};

export default SettingsPage;
