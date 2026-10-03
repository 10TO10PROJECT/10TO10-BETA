import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useChatMessages } from "@/hooks/useChatMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, User } from "lucide-react";
import { toast } from "sonner";

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const AdminChatRoomPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const fromChatManagement = (location.state as { from?: string } | null)?.from === 'chat-management';
  const { messages, roomInfo, loading, userId, sendMessage, acceptChatRequest, isStaffForThisRoom } = useChatMessages(id);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

  const isPending = roomInfo?.status === 'pending';
  const showAcceptButton = isPending && isStaffForThisRoom;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const result = await sendMessage(newMessage);
    if (result.success) {
      setNewMessage("");
      requestAnimationFrame(() => {
        messageInputRef.current?.focus();
      });
    } else if (result.error) {
      toast.error(result.error);
    }
    setSending(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAccept = async () => {
    if (accepting) return;
    setAccepting(true);
    const result = await acceptChatRequest();
    if (result.success) {
      toast.success("채팅 상담을 수락했습니다. 이제 메시지를 주고받을 수 있습니다.");
    } else if (result.error) {
      toast.error(result.error);
    }
    setAccepting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!roomInfo) {
    return (
      <div className="min-h-screen bg-app-shell flex items-center justify-center">
        <p className="text-muted-foreground">채팅방을 찾을 수 없습니다</p>
      </div>
    );
  }

  const parentName = roomInfo.parent_profile?.user_name || '학부모';

  return (
    <div className="min-h-screen bg-app-shell flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(fromChatManagement ? "/admin/chat-management" : "/admin/chats")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-foreground truncate">{parentName}</h1>
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">관리자</Badge>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">아직 메시지가 없습니다</p>
            </div>
          ) : (
            messages.map((message) => {
              const isChatRequest = message.message_type === 'chat_request';
              const isChatAccepted = message.message_type === 'chat_accepted';
              if (isChatRequest) {
                return (
                  <div key={message.id} className="flex flex-col items-center w-full space-y-3">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted border border-border text-center">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message.content}</p>
                    </div>
                    {showAcceptButton && (
                      <Button
                        onClick={handleAccept}
                        disabled={accepting}
                        className="rounded-full"
                      >
                        {accepting ? "처리 중..." : "수락"}
                      </Button>
                    )}
                  </div>
                );
              }
              if (isChatAccepted) {
                return (
                  <div key={message.id} className="flex justify-center w-full">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-primary/10 border border-primary/20 text-center">
                      <p className="text-sm text-primary whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                );
              }
              const isParentMessage = message.sender_id === roomInfo.parent_id;

              // 학부모 메시지: 왼쪽, 프로필 + 닉네임 표시
              if (isParentMessage) {
                return (
                  <div key={message.id} className="flex flex-col items-start w-full">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">
                        {parentName}
                      </span>
                    </div>
                    <div className="ml-11 max-w-[75%] rounded-2xl px-4 py-2.5 bg-card border border-border text-foreground rounded-tl-sm">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              }

              // 학원 멤버(원장/강사 등) 메시지: 오른쪽, 프로필/닉네임 없이 말풍선만
              return (
                <div key={message.id} className="flex justify-end w-full">
                  <div className="max-w-[75%] rounded-2xl px-4 py-2.5 bg-primary text-primary-foreground rounded-tr-sm">
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs mt-1 text-primary-foreground/70">
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message Input - 수락 대기 중(강사)일 때는 수락 후 입력 가능 */}
      <div className="sticky bottom-0 bg-card border-t border-border p-4">
        <div className="max-w-lg mx-auto flex gap-2">
          <Input
            ref={messageInputRef}
            placeholder={showAcceptButton ? "위에서 수락한 후 메시지를 보낼 수 있습니다" : "메시지를 입력하세요..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 rounded-full"
            disabled={sending || showAcceptButton}
          />
          <Button
            size="icon"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending || showAcceptButton}
            className="rounded-full shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminChatRoomPage;
