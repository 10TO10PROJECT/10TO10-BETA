import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useChatRooms } from "@/hooks/useChatRooms";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageCircle, User, Users, Lock } from "lucide-react";
import Logo from "@/components/Logo";

const formatTime = (date: Date | null) => {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return date.toLocaleDateString("ko-KR");
};

const ChatManagementPage = () => {
  const navigate = useNavigate();
  const { chatRooms, loading, userId } = useChatRooms(true, false);
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    const checkOwner = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsOwner(false);
        return;
      }
      const { data } = await supabase
        .from("academies")
        .select("id")
        .eq("owner_id", session.user.id)
        .limit(1);
      setIsOwner(data != null && data.length > 0);
    };
    checkOwner();
  }, []);

  // 원장만: 본인 제외 다른 멤버 담당 채팅만 표시 (staff_user_id != null && staff_user_id !== 본인)
  const otherMembersRooms =
    userId && isOwner
      ? chatRooms.filter(
          (room) =>
            room.staff_user_id != null && room.staff_user_id !== userId
        )
      : [];

  if (isOwner === null || (isOwner && loading)) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-app-shell pb-20">
        <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/home")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Logo size="sm" showText={false} />
            <span className="font-semibold text-foreground">학원 채팅 관리</span>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <Card className="shadow-card border-border">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">원장만 이용할 수 있습니다</h3>
              <p className="text-sm text-muted-foreground mb-4">
                학원 멤버들의 채팅 목록은 원장 계정에서만 확인할 수 있습니다.
              </p>
              <Button variant="outline" onClick={() => navigate("/admin/chats")}>
                <MessageCircle className="w-4 h-4 mr-2" />
                내 채팅 목록 보기
              </Button>
            </CardContent>
          </Card>
        </main>
        <AdminBottomNavigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/home")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Logo size="sm" showText={false} />
          <span className="font-semibold text-foreground">학원 채팅 관리</span>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <p className="text-sm text-muted-foreground mb-4">
          본인을 제외한 학원 멤버(부원장·강사 등) 담당 채팅 목록입니다.
        </p>

        {otherMembersRooms.length === 0 ? (
          <Card className="shadow-card border-border">
            <CardContent className="p-8 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">다른 멤버 담당 채팅이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                학원 멤버에게 할당된 상담이 없습니다.
              </p>
              <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/chats")}>
                <MessageCircle className="w-4 h-4 mr-2" />
                내 채팅 목록 보기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {otherMembersRooms.map((room) => (
              <Card
                key={room.id}
                className="shadow-card cursor-pointer hover:shadow-lg transition-shadow border-border"
                onClick={() => navigate(`/admin/chats/${room.id}`, { state: { from: 'chat-management' } })}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {room.parent_profile?.user_name || "학부모"}
                        </h3>
                        {room.lastMessageAt && (
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatTime(room.lastMessageAt)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground">
                          담당: {room.staff_profile?.user_name ?? "담당자"}
                          {room.staff_role_label && ` (${room.staff_role_label})`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate">
                          {room.lastMessage || "새로운 상담"}
                        </p>
                        {room.unreadCount > 0 && (
                          <Badge className="bg-primary text-primary-foreground shrink-0 ml-2 rounded-full min-w-[20px] h-5 flex items-center justify-center">
                            {room.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <AdminBottomNavigation />
    </div>
  );
};

export default ChatManagementPage;
