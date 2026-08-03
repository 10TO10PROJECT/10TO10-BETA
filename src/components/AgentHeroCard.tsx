import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useRoutePrefix } from "@/hooks/useRoutePrefix";

export const AGENT_SHORTCUTS = [
  {
    label: "🏫 학원 추천",
    message: "우리 아이에게 맞는 학원 추천해줘",
  },
  {
    label: "📣 설명회",
    message: "지금 신청 가능한 설명회 알려줘",
  },
  {
    label: "📅 일정 정리",
    message: "이번 주 일정 정리해줘",
  },
  {
    label: "💬 상담 예약",
    message: "상담 예약하고 싶어",
  },
] as const;

interface AgentHeroCardProps {
  role?: "parent" | "student";
}

const AgentHeroCard = ({ role = "parent" }: AgentHeroCardProps) => {
  const navigate = useNavigate();
  const prefix = useRoutePrefix();
  const agentPath = `${prefix}/agent`;

  const openAgent = (opts?: { initialMessage?: string; focusInput?: boolean }) => {
    navigate(agentPath, {
      state: {
        initialMessage: opts?.initialMessage,
        focusInput: opts?.focusInput ?? false,
      },
    });
  };

  return (
    <div className="mb-4 rounded-2xl bg-gradient-to-br from-primary to-[#15BDFF] p-4 text-foreground shadow-sm">
      <p className="mb-3 text-sm font-bold">
        {role === "student" ? "무엇을 도와줄까요?" : "무엇을 도와드릴까요?"}
      </p>

      <button
        type="button"
        onClick={() => openAgent({ focusInput: true })}
        className="mb-3 flex w-full items-center gap-2 rounded-full bg-white/75 px-3.5 py-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:bg-white/90"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span>학원, 설명회 뭐든 물어보세요</span>
      </button>

      <div className="grid grid-cols-2 gap-2">
        {AGENT_SHORTCUTS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => openAgent({ initialMessage: chip.message })}
            className="rounded-lg bg-white/60 px-2.5 py-2 text-center text-[11px] font-bold text-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AgentHeroCard;
