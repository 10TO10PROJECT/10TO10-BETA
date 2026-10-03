import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useChatRooms } from "@/hooks/useChatRooms";
import { useChatFolders } from "@/hooks/useChatFolders";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";

const FolderManagementPage = () => {
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const { loading: chatLoading, userId } = useChatRooms();
  const { folders } = useChatFolders(userId);

  const handleAddFolder = () => {
    navigate(`${prefix}/chats/folders/create`);
  };

  const handleFolderClick = (folderId: string, folderName: string) => {
    navigate(`${prefix}/chats?folder=${folderId}`, {
      state: { filterFolderName: folderName, fromFolderManagement: true },
    });
  };

  useEffect(() => {
    if (!chatLoading && !userId) {
      navigate(`${prefix}/chats`, { replace: true });
    }
  }, [chatLoading, userId, navigate, prefix]);

  if (!userId && !chatLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-app-shell pb-20">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`${prefix}/chats`)}
            aria-label="뒤로"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">폴더 관리</h1>
          <button
            type="button"
            onClick={handleAddFolder}
            className="text-sm font-medium text-primary"
          >
            추가
          </button>
        </div>
      </header>

      {/* Folder List */}
      <main className="max-w-lg mx-auto px-4 py-4">
        {folders.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">
              폴더가 없습니다. 추가 버튼을 눌러 새 폴더를 만들어보세요.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => handleFolderClick(folder.id, folder.name)}
                className="w-full flex items-center justify-between py-4 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="font-medium text-foreground truncate flex-1 mr-2">
                  {folder.name}
                </span>
                <span className="text-muted-foreground text-sm shrink-0 flex items-center gap-1">
                  {folder.chatRoomIds.length}
                  <ChevronRight className="w-4 h-4" />
                </span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FolderManagementPage;
