import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useChatRoomsForSelect } from "@/hooks/useChatRooms";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Check, GraduationCap, Search, X } from "lucide-react";

interface ChatRoomSelectLocationState {
  folderName?: string;
  selectedRoomIds?: string[];
}

const ChatRoomSelectPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useRoutePrefix();
  const { chatRooms, loading, userId } = useChatRoomsForSelect();

  const locationState = location.state as ChatRoomSelectLocationState | null;
  const [selectedIds, setSelectedIds] = useState<string[]>(
    locationState?.selectedRoomIds ?? []
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (locationState?.selectedRoomIds) {
      setSelectedIds(locationState.selectedRoomIds);
    }
  }, [locationState?.selectedRoomIds]);

  const toggleRoom = (roomId: string) => {
    setSelectedIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const removeRoom = (roomId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== roomId));
  };

  const handleDone = () => {
    navigate(`${prefix}/chats/folders/create`, {
      state: {
        folderName: locationState?.folderName ?? "",
        selectedRoomIds: selectedIds,
      },
    });
  };

  const handleBack = () => {
    navigate(`${prefix}/chats/folders/create`, {
      state: {
        folderName: locationState?.folderName ?? "",
        selectedRoomIds: selectedIds,
      },
    });
  };

  const filteredRooms = chatRooms.filter((room) => {
    const name = `[${room.academy.name}] ${room.staff_profile?.user_name ?? ""} ${room.staff_role_label ?? ""}`.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    return !query || name.includes(query);
  });

  const selectedRooms = chatRooms.filter((r) => selectedIds.includes(r.id));

  useEffect(() => {
    if (!loading && !userId) {
      navigate(`${prefix}/chats`, { replace: true });
    }
  }, [loading, userId, navigate, prefix]);

  if (!userId && !loading) return null;

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleBack} aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">채팅방 선택</h1>
          <button
            type="button"
            onClick={handleDone}
            className="text-sm font-medium text-primary flex items-center gap-1"
          >
            {selectedIds.length > 0 && (
              <span>{selectedIds.length}</span>
            )}
            완료
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* 선택된 채팅방 (가로 스크롤) */}
        {selectedRooms.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
            {selectedRooms.map((room) => (
              <div
                key={room.id}
                className="relative shrink-0 flex flex-col items-center gap-1"
              >
                <button
                  type="button"
                  onClick={() => removeRoom(room.id)}
                  className="absolute -top-1 -right-1 z-10 w-5 h-5 rounded-full bg-muted flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
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
                <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                  {room.academy.name}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="채팅방 이름, 참여자로 검색하세요"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* 채팅방 목록 */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl animate-pulse"
              >
                <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
                <div className="w-6 h-6 rounded-full bg-muted shrink-0" />
              </div>
            ))
          ) : (
          filteredRooms.map((room) => {
            const isSelected = selectedIds.includes(room.id);
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => toggleRoom(room.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
              >
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    [{room.academy.name}]
                    {(room.staff_profile?.user_name || room.staff_role_label) &&
                      ` ${room.staff_profile?.user_name ?? room.staff_role_label}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {room.lastMessage || "새로운 상담"}
                  </p>
                </div>
                <div
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-primary border-primary"
                      : "border-muted-foreground"
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                </div>
              </button>
            );
          })
          )}
        </div>

        {!loading && filteredRooms.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchQuery ? "검색 결과가 없습니다" : "채팅방이 없습니다"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ChatRoomSelectPage;
