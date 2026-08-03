import { useLocation } from "react-router-dom";
import { ChatSurface } from "@/components/ChatSurface";

interface AgentLocationState {
  initialMessage?: string;
  focusInput?: boolean;
}

const AgentPage = () => {
  const location = useLocation();
  const state = (location.state as AgentLocationState | null) ?? {};

  return (
    <ChatSurface
      profileTags={[]}
      title="AI 도우미"
      initialMessage={state.initialMessage}
      autoFocus={Boolean(state.focusInput) && !state.initialMessage}
      showPreferenceMenu={false}
    />
  );
};

export default AgentPage;
