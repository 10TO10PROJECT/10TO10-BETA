import { useNavigate } from "react-router-dom";
import { Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Logo from "@/components/Logo";
import SuperAdminBottomNavigation from "@/components/SuperAdminBottomNavigation";

const SuperAdminHomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">슈퍼관리자</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Welcome Card */}
        <Card className="shadow-card bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                <Shield className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">슈퍼관리자님 환영합니다</h2>
                <p className="text-sm text-muted-foreground">
                  플랫폼 전체를 관리할 수 있는 권한이 있습니다
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Super Admin Center Button */}
        <Button
          className="w-full h-16 text-lg gap-3"
          onClick={() => navigate("/super/center")}
        >
          <Shield className="w-6 h-6" />
          슈퍼관리자 센터
        </Button>
      </main>

      <SuperAdminBottomNavigation />
    </div>
  );
};

export default SuperAdminHomePage;
