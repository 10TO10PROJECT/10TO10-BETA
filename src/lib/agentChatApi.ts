import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type {
  AgentErrorCode,
  AgentMessage,
  ContentBlock,
  ModelMeta,
} from "@/types/agentChat";

let messageIdCounter = 0;

export function nextMessageId(): string {
  messageIdCounter += 1;
  return `msg-${messageIdCounter}-${Date.now()}`;
}

export function resetMessageIds(): void {
  messageIdCounter = 0;
}

export interface ChatTurnPayload {
  session_id: string;
  turn_index: number;
  role: "assistant";
  content_blocks: ContentBlock[];
  model_meta?: ModelMeta;
}

export interface CreateSessionResponse {
  session_id: string;
  first_turn: ChatTurnPayload;
  turns_remaining: number;
}

export interface SendMessageResponse {
  session_id: string;
  turn_index: number;
  role: "assistant";
  content_blocks: ContentBlock[];
  model_meta?: ModelMeta;
  next_actions: {
    can_continue: boolean;
    turns_remaining: number;
  };
}

export class AgentChatApiError extends Error {
  constructor(
    public readonly code: AgentErrorCode | "SESSION_LIMIT" | "UNKNOWN",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AgentChatApiError";
  }
}

export function buildAssistantMessage(
  turn: Pick<ChatTurnPayload, "turn_index" | "content_blocks">,
  sessionId: string,
  error?: AgentErrorCode,
): AgentMessage {
  return {
    id: nextMessageId(),
    role: "assistant",
    content_blocks: turn.content_blocks,
    turn_index: turn.turn_index,
    error,
  };
}

export function buildErrorMessage(
  sessionId: string,
  turnIndex: number,
  code: AgentErrorCode,
  detail?: string,
): AgentMessage {
  return {
    ...buildAssistantMessage(
      { turn_index: turnIndex, content_blocks: [] },
      sessionId,
      code,
    ),
    errorDetail: detail,
  };
}

/** 홈 Agent 콜드 스타트 환영 블록 (서버 createColdStartBlocks와 동일) */
export const CLIENT_COLD_START_BLOCKS: ContentBlock[] = [
  {
    type: "text",
    text:
      "안녕하세요! 10to10 AI 도우미예요.\n학원 추천, 설명회, 일정, 상담까지 편하게 물어보세요.",
  },
  {
    type: "quick_replies",
    items: [
      { label: "🏫 학원 추천", payload: "action:recommend_academies" },
      { label: "📣 설명회", payload: "action:explore_seminars" },
      { label: "📅 일정 정리", payload: "action:organize_schedule" },
      { label: "💬 상담 예약", payload: "action:book_consult" },
    ],
  },
];

// React StrictMode 등에서 동일 태그로 세션 생성이 겹치면 Solar 호출이 중복된다.
let inflightCreateSession:
  | { key: string; promise: Promise<CreateSessionResponse> }
  | null = null;

export async function createChatSession(
  profileTags: string[],
): Promise<CreateSessionResponse> {
  const key = profileTags.join("\0");
  if (inflightCreateSession?.key === key) {
    return inflightCreateSession.promise;
  }

  const promise = invokeCreateChatSession(profileTags).finally(() => {
    if (inflightCreateSession?.promise === promise) {
      inflightCreateSession = null;
    }
  });
  inflightCreateSession = { key, promise };
  return promise;
}

async function getAccessToken(): Promise<string> {
  const { data: first } = await supabase.auth.getSession();
  let session = first.session;

  if (!session?.access_token) {
    throw new AgentChatApiError("AUTH_REQUIRED");
  }

  // 만료 임박/만료 시 갱신 — 만료 JWT로 invoke하면 게이트웨이/함수에서 Unauthorized가 난다.
  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs && expiresAtMs < Date.now() + 60_000) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error || !refreshed.session?.access_token) {
      throw new AgentChatApiError("AUTH_REQUIRED");
    }
    session = refreshed.session;
  }

  return session.access_token;
}

async function invokeCreateChatSession(
  profileTags: string[],
): Promise<CreateSessionResponse> {
  const isColdStart = profileTags.length === 0;

  // 홈 Agent 콜드 스타트는 API를 건너뛰고 환영 UI만 즉시 표시.
  // (구버전 서버는 빈 태그에 400을 내고, 잘못된 폴백이 Solar→504를 유발했음)
  // 실제 chat-session 생성은 첫 사용자 메시지 전송 때 ensureRemoteChatSession으로 수행.
  if (isColdStart) {
    return buildLocalColdStartSession();
  }

  const accessToken = await getAccessToken();
  return await postChatSession(profileTags, accessToken, false);
}

/** 서버 세션 없이 홈 Agent 환영 UI만 즉시 표시 */
function buildLocalColdStartSession(): CreateSessionResponse {
  return {
    session_id: "",
    first_turn: {
      session_id: "",
      turn_index: 1,
      role: "assistant",
      content_blocks: CLIENT_COLD_START_BLOCKS,
      model_meta: {
        provider: "upstage",
        model: "solar-mini",
        latency_ms: 0,
        tokens: { input: 0, output: 0 },
        cost_krw: 0,
      },
    },
    turns_remaining: 9,
  };
}

/**
 * 로컬 콜드 스타트 이후 첫 메시지 전에 원격 세션을 연다.
 */
export async function ensureRemoteChatSession(
  profileTags: string[],
): Promise<CreateSessionResponse> {
  const accessToken = await getAccessToken();
  const isCold = profileTags.length === 0;
  return await postChatSession(profileTags, accessToken, isCold);
}

async function postChatSession(
  profileTags: string[],
  accessToken: string,
  forceColdStartBlocks: boolean,
): Promise<CreateSessionResponse> {
  const isCold = profileTags.length === 0;
  // 콜드 스타트는 cold_start 플래그를 명시해 구/신 서버 모두에서 의도를 전달
  const body = isCold
    ? { cold_start: true, surface: "agent_home", profile_tags: [] as string[] }
    : { profile_tags: profileTags };

  const { data, error } = await supabase.functions.invoke("chat-session", {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (error) {
    throw await toApiError(error, data);
  }

  if (data && typeof data === "object" && "error" in data && !("session_id" in data)) {
    throw new AgentChatApiError(
      mapServerError(400, String((data as { error: unknown }).error)),
      String((data as { error: unknown }).error),
    );
  }

  const result = data as CreateSessionResponse;

  if (!result?.session_id) {
    throw new AgentChatApiError("UNKNOWN", "Invalid chat-session response");
  }

  // 배포 반영 여부 확인용 (구버전이면 이 필드 없음)
  if ((data as { parser_version?: string })?.parser_version) {
    console.info(
      "[agentChat] chat-session parser",
      (data as { parser_version?: string }).parser_version,
    );
  } else {
    console.warn(
      "[agentChat] chat-session에 parser_version 없음 — 구버전 함수가 배포됐을 수 있습니다.",
    );
  }

  if (forceColdStartBlocks && result.first_turn) {
    return {
      ...result,
      first_turn: {
        ...result.first_turn,
        content_blocks: CLIENT_COLD_START_BLOCKS,
        model_meta: {
          provider: "upstage",
          model: "solar-mini",
          latency_ms: 0,
          tokens: { input: 0, output: 0 },
          cost_krw: 0,
        },
      },
    };
  }

  return result;
}

export async function sendChatMessage(
  sessionId: string,
  userText: string,
  payload?: string,
): Promise<SendMessageResponse> {
  const accessToken = await getAccessToken();
  const body: Record<string, string> = {
    session_id: sessionId,
    user_text: userText,
  };
  if (payload) body.payload = payload;

  const { data, error } = await supabase.functions.invoke("chat-message", {
    body,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    throw await toApiError(error, data);
  }

  if (data && typeof data === "object" && "error" in data && !("session_id" in data)) {
    throw new AgentChatApiError(
      mapServerError(400, String((data as { error: unknown }).error)),
      String((data as { error: unknown }).error),
    );
  }

  return data as SendMessageResponse;
}

async function toApiError(
  error: unknown,
  data?: unknown,
): Promise<AgentChatApiError> {
  if (error instanceof FunctionsHttpError) {
    const status = error.context.status;
    let serverError = "";

    try {
      const payload = await error.context.json();
      if (payload && typeof payload.error === "string") {
        serverError = payload.error;
      } else if (payload && typeof payload.message === "string") {
        // 게이트웨이 JWT 실패 등: { message: "Invalid JWT" }
        serverError = payload.message;
      }
    } catch {
      if (data && typeof data === "object" && data !== null && "error" in data) {
        serverError = String((data as { error: unknown }).error);
      }
    }

    const code = mapServerError(status, serverError);
    if (status >= 400) {
      console.error(`[agentChat] HTTP ${status}:`, serverError || error.message);
    }
    return new AgentChatApiError(code, serverError || error.message);
  }

  if (error instanceof AgentChatApiError) return error;

  return new AgentChatApiError("UNKNOWN", String(error));
}

function mapServerError(
  status: number,
  serverError: string,
): AgentChatApiError["code"] {
  const normalized = serverError.toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    serverError === "Unauthorized" ||
    serverError === "Invalid token" ||
    serverError === "AUTH_REQUIRED" ||
    normalized.includes("unauthorized") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("invalid token")
  ) {
    return "AUTH_REQUIRED";
  }
  if (status === 410 && serverError === "SESSION_EXPIRED") return "SESSION_EXPIRED";
  if (status === 429 && serverError === "BUDGET_EXCEEDED") return "BUDGET_EXCEEDED";
  if (status === 429 && serverError === "SESSION_LIMIT") return "SESSION_LIMIT";
  if (status === 429 && serverError === "RATE_LIMIT") return "RATE_LIMIT";
  if (status === 504 && serverError === "SOLAR_TIMEOUT") return "SOLAR_TIMEOUT";
  if (serverError === "SOLAR_TIMEOUT") return "SOLAR_TIMEOUT";
  // Solar/Upstage 관련만 SOLAR_5XX로 분류 — 그 외 500은 UNKNOWN (세션 저장 실패 등)
  if (
    serverError.startsWith("SOLAR_") ||
    serverError.startsWith("INVALID_CONTENT_BLOCKS") ||
    normalized.includes("upstage")
  ) {
    return "SOLAR_5XX";
  }
  if (status === 502 && serverError.startsWith("SOLAR_")) return "SOLAR_5XX";
  if (status === 502 && serverError.startsWith("INVALID_CONTENT_BLOCKS")) {
    return "SOLAR_5XX";
  }
  if (status >= 500) return "UNKNOWN";
  return "UNKNOWN";
}
