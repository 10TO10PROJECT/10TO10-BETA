import { useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useChatRooms } from "@/hooks/useChatRooms";
import { useChatFolders } from "@/hooks/useChatFolders";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import Logo from "@/components/Logo";
import BottomNavigation from "@/components/BottomNavigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, GraduationCap, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

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

const ChatListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const prefix = useRoutePrefix();
  const { chatRooms, loading, userId } = useChatRooms();
  const { folders, getFolderById } = useChatFolders(userId);
  const folderId = searchParams.get("folder");
  const locationState = location.state as {
    filterFolderName?: string;
    fromFolderManagement?: boolean;
  } | null;

  const isFromFolderManagement = !!locationState?.fromFolderManagement;
  const folder = folderId ? getFolderById(folderId) : null;

  const [selectedChip, setSelectedChip] = useState<string>("all");

  const filteredRooms = (() => {
    if (folderId && folder) {
      return chatRooms.filter((r) => folder.chatRoomIds.includes(r.id));
    }
    if (selectedChip === "all") {
      return chatRooms;
    }
    const selectedFolder = folders.find((f) => f.id === selectedChip);
    if (selectedFolder) {
      return chatRooms.filter((r) => selectedFolder.chatRoomIds.includes(r.id));
    }
    return chatRooms;
  })();

  const filterFolderName =
    locationState?.filterFolderName ?? folder?.name ?? null;
  const showChips = !folderId && !isFromFolderManagement;

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-app-shell">
        <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
          <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-center">
            <Logo size="sm" showText={false} />
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">로그인이 필요합니다</h3>
              <p className="text-sm text-muted-foreground mb-4">
                채팅 상담을 이용하려면 로그인해주세요
              </p>
              <button
                onClick={() => {
                  const redirect = location.pathname + location.search;
                  navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
                }}
                className="text-primary font-medium hover:underline"
              >
                로그인하러 가기
              </button>
            </CardContent>
          </Card>
        </main>
        <BottomNavigation />
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 min-w-0">
            {folderId && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    locationState?.fromFolderManagement
                      ? `${prefix}/chats/folders`
                      : `${prefix}/chats`
                  )
                }
                className="shrink-0 p-1 -ml-1 rounded hover:bg-secondary"
                aria-label="뒤로"
              >
                <span className="text-muted-foreground">←</span>
              </button>
            )}
            <h1 className="text-xl font-bold text-foreground truncate">
              {filterFolderName ?? "채팅"}
            </h1>
          </div>
          {!locationState?.fromFolderManagement && (
            <button
              type="button"
              onClick={() => navigate(`${prefix}/chats/folders`)}
              className="p-2 rounded-lg hover:bg-secondary transition-colors shrink-0"
              aria-label="폴더"
            >
              <Folder className="w-5 h-5 text-foreground" />
            </button>
          )}
        </div>

        {/* Chip 버튼 - 채팅탭 초기화면에서만 표시 */}
        {showChips && (
          <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4">
            <button
              type="button"
              onClick={() => setSelectedChip("all")}
              className={cn(
                "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                selectedChip === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              전체
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedChip(f.id)}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors",
                  selectedChip === f.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
        )}

        {filteredRooms.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">
                {folderId || selectedChip !== "all"
                  ? "이 폴더에 채팅방이 없습니다"
                  : "진행 중인 채팅이 없습니다"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {folderId || selectedChip !== "all"
                  ? "채팅방을 이 폴더에 추가해보세요"
                  : "학원 상세 페이지에서 채팅 상담을 시작해보세요"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredRooms.map((room) => (
              <Card
                key={room.id}
                className="shadow-card cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`${prefix}/chats/${room.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Academy Logo */}
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      {room.academy.profile_image ? (
                        <img
                          src={room.academy.profile_image}
                          alt={room.academy.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <GraduationCap className="w-6 h-6 text-primary" />
                      )}
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <h3 className="font-semibold text-foreground truncate">
                            {room.academy.name}
                          </h3>
                          {(room.staff_profile?.user_name || room.staff_role_label) && (
                            <span className="text-xs text-muted-foreground shrink-0">
                              ·{" "}
                              {room.staff_profile?.user_name && room.staff_role_label
                                ? `${room.staff_profile.user_name} ${room.staff_role_label}`
                                : room.staff_profile?.user_name ?? room.staff_role_label}
                            </span>
                          )}
                        </div>
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

      <BottomNavigation />
    </div>
  );
};

export default ChatListPage;
