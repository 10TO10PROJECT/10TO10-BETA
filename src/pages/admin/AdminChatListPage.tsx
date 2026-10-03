import { useNavigate } from "react-router-dom";
import { useChatRooms } from "@/hooks/useChatRooms";
import AdminBottomNavigation from "@/components/AdminBottomNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, User } from "lucide-react";
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

const AdminChatListPage = () => {
  const navigate = useNavigate();
  const { chatRooms, loading } = useChatRooms(true, true);

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
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-center">
          <Logo size="sm" showText={false} />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <h1 className="text-xl font-bold text-foreground mb-4">학부모 상담 목록</h1>

        {chatRooms.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">진행 중인 상담이 없습니다</h3>
              <p className="text-sm text-muted-foreground">
                학부모가 채팅 상담을 시작하면 여기에 표시됩니다
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {chatRooms.map((room) => (
              <Card
                key={room.id}
                className="shadow-card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/admin/chats/${room.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Parent Icon */}
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      <User className="w-6 h-6 text-primary" />
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-foreground truncate">
                          {room.parent_profile?.user_name || '학부모'}
                        </h3>
                        {room.lastMessageAt && (
                          <span className="text-xs text-muted-foreground shrink-0 ml-2">
                            {formatTime(room.lastMessageAt)}
                          </span>
                        )}
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

export default AdminChatListPage;
