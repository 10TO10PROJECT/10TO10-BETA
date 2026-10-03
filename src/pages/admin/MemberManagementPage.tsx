import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { useAcademyMembership } from "@/hooks/useAcademyMembership";
import AcademyMemberManagement from "@/components/AcademyMemberManagement";
import { Card, CardContent } from "@/components/ui/card";

const MemberManagementPage = () => {
  const navigate = useNavigate();
  const { loading: membershipLoading, primaryAcademy, isOwner, hasPermission } = useAcademyMembership();

  const canManageMembers = useMemo(() => {
    if (!primaryAcademy) return false;
    return isOwner(primaryAcademy.id) || hasPermission(primaryAcademy.id, "manage_members");
  }, [primaryAcademy, isOwner, hasPermission]);

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
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/home')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">학원 멤버 관리</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        {!primaryAcademy ? (
          <Card className="shadow-card border-border">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">등록된 학원이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                학원을 먼저 등록해주세요
              </p>
            </CardContent>
          </Card>
        ) : !canManageMembers ? (
          <Card className="shadow-card border-border">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">권한이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                멤버 관리 권한이 없습니다. 학원 원장님에게 문의해주세요.
              </p>
            </CardContent>
          </Card>
        ) : (
          <AcademyMemberManagement academyId={primaryAcademy.id} />
        )}
      </main>

      <AdminBottomNavigation />
    </div>
  );
};

export default MemberManagementPage;
