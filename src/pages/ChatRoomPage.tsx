import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useChatMessages } from "@/hooks/useChatMessages";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, GraduationCap } from "lucide-react";
import { toast } from "sonner";

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const ChatRoomPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const { messages, roomInfo, loading, userId, isAdmin, sendMessage } = useChatMessages(id);
  const isPending = roomInfo?.status === 'pending';
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);

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

  const handleBack = () => {
    if (isAdmin) {
      navigate("/admin/chats");
    } else {
      navigate(`${prefix}/chats`);
    }
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

  return (
    <div className="min-h-screen bg-app-shell flex flex-col">
      {/* Header */}
      <header className="sticky top-0 bg-card/80 backdrop-blur-lg border-b border-border z-40">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <button 
            className="flex items-center gap-2 flex-1 min-w-0"
            onClick={() => navigate(`${prefix}/academy/${roomInfo.academy.id}`)}
          >
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
              {roomInfo.academy.profile_image ? (
                <img
                  src={roomInfo.academy.profile_image}
                  alt={roomInfo.academy.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <GraduationCap className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-foreground truncate">{roomInfo.academy.name}</h1>
              {(roomInfo.staff_profile?.user_name || roomInfo.staff_role_label) && (
                <p className="text-xs text-muted-foreground truncate">
                  {roomInfo.staff_profile?.user_name && roomInfo.staff_role_label
                    ? `${roomInfo.staff_profile.user_name} ${roomInfo.staff_role_label}님`
                    : roomInfo.staff_profile?.user_name
                      ? `${roomInfo.staff_profile.user_name}님`
                      : `${roomInfo.staff_role_label}님`}
                </p>
              )}
            </div>
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
          {isPending && (
            <div className="text-center py-4 px-4 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-sm text-amber-800">강사가 수락할 때까지 기다려주세요.</p>
              <p className="text-xs text-amber-700 mt-1">수락 후 메시지를 보낼 수 있습니다.</p>
            </div>
          )}
          {messages.length === 0 && !isPending ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">메시지를 보내 상담을 시작하세요</p>
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.sender_id === userId;
              const isChatRequest = message.message_type === 'chat_request';
              const isChatAccepted = message.message_type === 'chat_accepted';
              if (isChatRequest) {
                return (
                  <div key={message.id} className="flex justify-center w-full">
                    <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-muted border border-border text-center">
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{message.content}</p>
                    </div>
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
              if (isMe) {
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
              }
              return (
                <div key={message.id} className="flex flex-col items-start w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      {roomInfo.academy.profile_image ? (
                        <img
                          src={roomInfo.academy.profile_image}
                          alt={roomInfo.academy.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <GraduationCap className="w-6 h-6 text-primary" />
                      )}
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {roomInfo.academy.name}
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
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message Input - 강사 수락 대기 중에는 비활성화 */}
      <div className="sticky bottom-0 bg-card border-t border-border p-4">
        <div className="max-w-lg mx-auto flex gap-2">
          <Input
            ref={messageInputRef}
            placeholder={isPending ? "강사가 수락할 때까지 대기 중..." : "메시지를 입력하세요..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1 rounded-full"
            disabled={sending || isPending}
          />
          <Button
            size="icon"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending || isPending}
            className="rounded-full shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatRoomPage;
