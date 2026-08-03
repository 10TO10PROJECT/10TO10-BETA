import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MoreHorizontal, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";
import { MAX_RETRY_COUNT, useAgentChatSession } from "@/hooks/useAgentChatSession";
import { ProfileTagStrip } from "@/components/agent-chat/ProfileTagStrip";
import { SessionWarnBanner } from "@/components/agent-chat/SessionWarnBanner";
import { AgentChatMessageList } from "@/components/agent-chat/AgentChatMessage";
import { AgentTypingIndicator } from "@/components/agent-chat/AgentTypingIndicator";
import { AcademyCardsSkeleton } from "@/components/agent-chat/AcademyCardsSkeleton";
import { AgentChatInput } from "@/components/agent-chat/AgentChatInput";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ChatSurfaceProps {
  profileTags?: string[];
  title?: string;
  initialMessage?: string;
  autoFocus?: boolean;
  showPreferenceMenu?: boolean;
}

export function ChatSurface({
  profileTags = [],
  title = "AI 도우미",
  initialMessage,
  autoFocus = false,
  showPreferenceMenu = false,
}: ChatSurfaceProps) {
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    sessionId,
    messages,
    phase,
    turnsRemaining,
    showSessionWarn,
    sessionCountdown,
    inputDisabled,
    inputPlaceholder,
    consumedQuickReplyIds,
    expandedCardIds,
    retryCount,
    rateLimitCountdown,
    sendTurn,
    sendQuickReply,
    retryLastTurn,
    resetSession,
    toggleCardExpand,
  } = useAgentChatSession(profileTags, { initialMessage });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  const handleBack = () => {
    navigate(`${prefix}/home`);
  };

  const handleCardConsult = (_academyId: string, academyName: string) => {
    toast.success(`「${academyName}」 상담 신청으로 이동합니다.`);
  };

  const handleCardViewDetail = (academyId: string) => {
    navigate(`${prefix}/academy/${academyId}`, {
      state: { from: "chat", session_id: sessionId },
    });
  };

  const isLoading = phase === "loading";
  const isTyping = phase === "typing";
  const isSessionLimit = phase === "session_limit";

  return (
    <div className="min-h-screen bg-muted flex flex-col max-w-lg mx-auto">
      <header className="sticky top-0 z-40 bg-card border-b border-border shrink-0">
        <div className="h-[52px] px-3.5 flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="h-[30px] w-[30px] shrink-0" onClick={handleBack}>
            <ArrowLeft className="w-5 h-5 text-muted-foreground" />
          </Button>
          <h1 className="flex-1 text-[15px] font-bold text-foreground">{title}</h1>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-[30px] w-[30px] text-muted-foreground"
              onClick={resetSession}
              title="새 대화 시작"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-[30px] w-[30px] text-muted-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {showPreferenceMenu && (
                  <DropdownMenuItem onClick={() => navigate(`${prefix}/preference-test`)}>
                    선호도 테스트 다시하기
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(`${prefix}/explore`)}>
                  탐색으로 이동
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBack}>홈으로</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <ProfileTagStrip profileTags={profileTags} />

      {showSessionWarn && (
        <SessionWarnBanner countdown={sessionCountdown} turnsRemaining={turnsRemaining} />
      )}

      <main className="flex-1 overflow-y-auto px-3.5 py-3.5 bg-muted/90">
        <div className="space-y-3">
          {isLoading && (
            profileTags.length === 0 ? (
              <AgentTypingIndicator />
            ) : (
              <>
                <AgentTypingIndicator />
                <AcademyCardsSkeleton />
              </>
            )
          )}

          <AgentChatMessageList
            messages={messages}
            consumedQuickReplyIds={consumedQuickReplyIds}
            expandedCardIds={expandedCardIds}
            onQuickReplySelect={sendQuickReply}
            onToggleCard={toggleCardExpand}
            onCardConsult={handleCardConsult}
            onCardViewDetail={handleCardViewDetail}
            onRetry={retryLastTurn}
            onReset={resetSession}
            retryDisabled={isTyping}
            retryCountdown={rateLimitCountdown}
            maxRetriesReached={retryCount >= MAX_RETRY_COUNT}
          />

          {isTyping && <AgentTypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {isSessionLimit && (
        <div className="shrink-0 px-3.5 py-2 bg-card border-t border-border">
          <Button className="w-full gap-2" onClick={resetSession}>
            <Sparkles className="w-4 h-4" />
            새 대화 시작
          </Button>
        </div>
      )}

      <AgentChatInput
        placeholder={inputPlaceholder}
        disabled={inputDisabled}
        onSend={sendTurn}
        autoFocus={autoFocus}
      />
    </div>
  );
}
