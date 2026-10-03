import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useChatRooms } from "@/hooks/useChatRooms";
import { useChatFolders } from "@/hooks/useChatFolders";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, GraduationCap, Plus } from "lucide-react";
import { toast } from "sonner";

interface CreateFolderLocationState {
  folderName?: string;
  selectedRoomIds?: string[];
}

const CreateFolderPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefix = useRoutePrefix();
  const { chatRooms, loading: chatLoading, userId } = useChatRooms();
  const { addFolder } = useChatFolders(userId);

  const locationState = location.state as CreateFolderLocationState | null;
  const [folderName, setFolderName] = useState(locationState?.folderName ?? "");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(
    locationState?.selectedRoomIds ?? []
  );

  useEffect(() => {
    if (locationState?.folderName !== undefined) {
      setFolderName(locationState.folderName);
    }
    if (locationState?.selectedRoomIds) {
      setSelectedRoomIds(locationState.selectedRoomIds);
    }
  }, [locationState?.folderName, locationState?.selectedRoomIds]);

  const handleAddChatRooms = () => {
    navigate(`${prefix}/chats/folders/create/select`, {
      state: { folderName, selectedRoomIds },
    });
  };

  const handleRemoveRoom = (roomId: string) => {
    setSelectedRoomIds((prev) => prev.filter((id) => id !== roomId));
  };

  const handleDeselectAll = () => {
    setSelectedRoomIds([]);
  };

  const handleDone = () => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      toast.error("폴더 이름을 입력해주세요.");
      return;
    }
    addFolder(trimmed, selectedRoomIds);
    toast.success("폴더가 생성되었습니다.");
    navigate(`${prefix}/chats/folders`, { replace: true });
  };

  const handleBack = () => {
    navigate(`${prefix}/chats/folders`);
  };

  const selectedRooms = chatRooms.filter((r) => selectedRoomIds.includes(r.id));

  useEffect(() => {
    if (!chatLoading && !userId) {
      navigate(`${prefix}/chats`, { replace: true });
    }
  }, [chatLoading, userId, navigate, prefix]);

  if (!userId && !chatLoading) return null;

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={handleBack} aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">폴더 만들기</h1>
          <button
            type="button"
            onClick={handleDone}
            className="text-sm font-medium text-primary"
          >
            완료
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* 폴더 이름 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            폴더 이름 <span className="text-destructive">*</span>
          </label>
          <Input
            placeholder="채팅방 폴더의 이름을 입력해주세요"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            className="border-border"
          />
        </div>

        {/* 등록한 채팅방 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              등록한 채팅방 {selectedRoomIds.length}
            </label>
            {selectedRoomIds.length > 0 && (
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                전체 해제
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleAddChatRooms}
            className="w-full flex items-center gap-3 p-4 rounded-xl border border-dashed border-border hover:bg-muted/50 transition-colors"
          >
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Plus className="w-6 h-6 text-muted-foreground" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              채팅방 추가하기
            </span>
          </button>

          {selectedRooms.length > 0 && (
            <div className="space-y-2">
              {selectedRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border"
                >
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                    {room.academy.profile_image ? (
                      <img
                        src={room.academy.profile_image}
                        alt={room.academy.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <GraduationCap className="w-5 h-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      [{room.academy.name}]
                      {(room.staff_profile?.user_name || room.staff_role_label) &&
                        ` ${room.staff_profile?.user_name ?? room.staff_role_label}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveRoom(room.id)}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                  >
                    해제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CreateFolderPage;
