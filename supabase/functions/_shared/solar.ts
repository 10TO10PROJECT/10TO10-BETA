import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────

export interface TextBlock {
  type: "text";
  text: string;
}

export interface AcademyCard {
  id: string;
  name: string;
  match_score: number;
  thumbnail: string;
  reason_tags: string[];
  price_monthly: number | null;
}

export interface AcademyCardsBlock {
  type: "academy_cards";
  items: AcademyCard[];
}

export interface QuickReplyItem {
  label: string;
  payload: string;
}

export interface QuickRepliesBlock {
  type: "quick_replies";
  items: QuickReplyItem[];
}

export type ContentBlock = TextBlock | AcademyCardsBlock | QuickRepliesBlock;

export interface ModelMeta {
  provider: "upstage";
  model: string;
  latency_ms: number;
  tokens: { input: number; output: number };
  cost_krw: number;
}

export interface SolarReply {
  content_blocks: ContentBlock[];
  model_meta: ModelMeta;
}

export interface SolarMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CallSolarOptions {
  timeoutMs?: number;
  promptCacheKey?: string;
}

export interface ParseContentBlockOptions {
  allowedAcademyIds?: Set<string>;
  maxAcademyCards?: number;
}

// ─── Constants ───────────────────────────────────────────────────

const SOLAR_API_URL = "https://api.upstage.ai/v1/chat/completions";
export const SOLAR_MODEL = "solar-mini";
export const MAX_ACADEMY_CARDS_PER_TURN = 3;
export const MAX_ACADEMY_CARDS_PER_SESSION = 6;

// solar-mini: input/output $0.15 per 1M tokens, USD→KRW 1300 기준.
const KRW_PER_1K_INPUT = 0.195;
const KRW_PER_1K_OUTPUT = 0.195;

export const BOOTSTRAP_PROMPT = `당신은 에듀플로 AI 학원 매칭 어시스턴트입니다.
사용자의 학습 선호도 태그와 제공된 학원 목록을 바탕으로 맞춤 추천을 제공합니다.

출력 규칙:
1. 반드시 아래 JSON 형식만 출력합니다. 마크다운, 코드블록, 설명 텍스트 없이 JSON만.
2. text 블록: 개행(\\n)만 허용. 마크다운 금지.
3. academy_cards: 제공된 학원 목록에서만 선택 (없는 학원 만들기 금지).
4. academy_cards items는 최대 3개.
5. quick_replies items는 최대 4개.
6. price_monthly를 알 수 없으면 0으로 출력합니다.
7. quick_replies payload는 반드시 filter:, relax:, action: 중 하나로 시작합니다.

출력 형식:
{"content_blocks":[{"type":"text","text":"..."},{"type":"academy_cards","items":[{"id":"...","name":"...","match_score":90,"thumbnail":"📐","reason_tags":["소수정예"],"price_monthly":450000}]},{"type":"quick_replies","items":[{"label":"수학만 보기","payload":"filter:subject=math"}]}]}`;

const CONTENT_BLOCKS_RESPONSE_FORMAT = {
  // json_schema는 일부 응답에서 content가 object로 와 JSON.parse가 깨진다.
  // json_object는 content가 JSON 문자열로 오는 경우가 많아 파싱이 안정적이다.
  type: "json_object",
};

// ─── Solar API ───────────────────────────────────────────────────

export async function callSolar(
  messages: SolarMessage[],
  options: CallSolarOptions = {},
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const apiKey = Deno.env.get("UPSTAGE_API_KEY");
  if (!apiKey) throw new Error("UPSTAGE_API_KEY not set");

  const controller = new AbortController();
  // json_schema 구조화 출력은 8초 안에 자주 못 끝나 504 SOLAR_TIMEOUT이 난다.
  const timeoutMs = options.timeoutMs ?? 20_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const body: Record<string, unknown> = {
    model: SOLAR_MODEL,
    messages,
    temperature: 0.3,
    response_format: CONTENT_BLOCKS_RESPONSE_FORMAT,
  };
  if (options.promptCacheKey) body.prompt_cache_key = options.promptCacheKey;

  try {
    const res = await fetch(SOLAR_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SOLAR_${res.status}: ${body}`);
    }

    const json = await res.json();
    const message = json.choices?.[0]?.message ?? {};
    // provider에 따라 content / parsed 중 하나에 실릴 수 있음
    const rawContent = message.content ?? message.parsed ?? null;
    const text = normalizeSolarContent(rawContent);
    return {
      text,
      usage: {
        input: json.usage?.prompt_tokens ?? 0,
        output: json.usage?.completion_tokens ?? 0,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Solar content → 항상 JSON 문자열로 정규화 (object면 stringify) */
function normalizeSolarContent(content: unknown): string {
  if (typeof content === "string") {
    // 이미 잘못된 coerce가 된 경우 조기 실패 (구버전 혼선 방지)
    if (content.trim() === "[object Object]") {
      throw new Error(
        "INVALID_CONTENT_BLOCKS: content was stringified as [object Object]; redeploy solar parser v3",
      );
    }
    return content;
  }
  if (content == null) return "";
  if (Array.isArray(content)) {
    // multimodal parts: [{type:'text', text:'...'}]
    const textPart = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && typeof (part as any).text === "string") {
          return (part as any).text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
    return textPart || JSON.stringify(content);
  }
  if (typeof content === "object") return JSON.stringify(content);
  return String(content);
}

export function calcCostKrw(input: number, output: number): number {
  return Math.ceil(
    (input / 1000) * KRW_PER_1K_INPUT + (output / 1000) * KRW_PER_1K_OUTPUT,
  );
}

// ─── Content Blocks Parser ────────────────────────────────────────

export function parseContentBlocks(solarText: string): ContentBlock[] {
  return parseContentBlocksWithOptions(solarText);
}

export function parseContentBlocksWithOptions(
  solarText: string | Record<string, unknown>,
  options: ParseContentBlockOptions = {},
): ContentBlock[] {
  try {
    const parsed = coerceSolarJson(solarText);
    if (!isRecord(parsed) || !Array.isArray(parsed.content_blocks)) {
      throw new Error("content_blocks must be an array");
    }
    return validateContentBlocks(parsed.content_blocks, options);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(`INVALID_CONTENT_BLOCKS: ${detail}`);
  }
}

/** string/object 모두 받아 JSON 객체로 만든다. JSON.parse(object) 절대 금지. */
function coerceSolarJson(input: unknown): unknown {
  if (input && typeof input === "object") return input;
  if (typeof input !== "string") {
    throw new Error(`unexpected content type: ${typeof input}`);
  }

  let cleaned = input.trim();
  if (!cleaned || cleaned === "[object Object]") {
    throw new Error(
      "empty or invalid content ([object Object]) — redeploy chat-message with solar parser v3",
    );
  }

  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 앞뒤 잡텍스트가 있어도 첫 { ... } 만 추출
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    const repaired = repairLlmJson(cleaned);
    try {
      return JSON.parse(repaired);
    } catch {
      const snippet = cleaned.slice(0, 240).replace(/\s+/g, " ");
      console.error(
        "coerceSolarJson failed:",
        firstError instanceof Error ? firstError.message : firstError,
        "snippet:",
        snippet,
      );
      throw firstError;
    }
  }
}

/**
 * Solar(LLM)이 자주 내는 JSON 문법 오류 보정:
 * - 배열/객체 요소 사이 누락 콤마 (`} {`, `"a" "b"`)
 * - trailing comma
 * - 문자열 안 미이스케이프 제어문자(개행 등)
 */
function repairLlmJson(text: string): string {
  let s = escapeControlCharsInStrings(text);

  // trailing commas: [1,] {a:1,}
  s = s.replace(/,\s*([\]}])/g, "$1");

  // missing commas between structural tokens
  s = s.replace(/\}\s*\{/g, "},{");
  s = s.replace(/\]\s*\[/g, "],[");
  s = s.replace(/\}\s*\[/g, "},[");
  s = s.replace(/\]\s*\{/g, "],{");

  // missing commas before next property/string: 90\n"thumbnail" / "소수정예" "강남"
  s = s.replace(/"\s+"/g, '","');
  s = s.replace(/([0-9]|true|false|null)\s+"/gi, '$1,"');
  s = s.replace(/([}\]])\s+"/g, '$1,"');

  // trailing commas again (repair may reintroduce edge cases)
  s = s.replace(/,\s*([\]}])/g, "$1");

  return s;
}

/** JSON 문자열 리터럴 내부의 raw 제어문자를 이스케이프 */
function escapeControlCharsInStrings(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        out += ch;
        escaped = true;
        continue;
      }
      if (ch === '"') {
        out += ch;
        inString = false;
        continue;
      }
      if (ch === "\n") {
        out += "\\n";
        continue;
      }
      if (ch === "\r") {
        out += "\\r";
        continue;
      }
      if (ch === "\t") {
        out += "\\t";
        continue;
      }
      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        out += `\\u${code.toString(16).padStart(4, "0")}`;
        continue;
      }
      out += ch;
      continue;
    }

    if (ch === '"') inString = true;
    out += ch;
  }

  return out;
}

function validateContentBlocks(
  blocks: unknown[],
  options: ParseContentBlockOptions,
): ContentBlock[] {
  let academyCardCount = 0;

  return blocks.map((block, index) => {
    if (!isRecord(block) || typeof block.type !== "string") {
      throw new Error(`block ${index} missing type`);
    }

    if (block.type === "text") {
      if (typeof block.text !== "string" || !block.text.trim()) {
        throw new Error(`text block ${index} missing text`);
      }
      return { type: "text", text: block.text };
    }

    if (block.type === "academy_cards") {
      const maxCards = options.maxAcademyCards ?? MAX_ACADEMY_CARDS_PER_TURN;
      if (!Array.isArray(block.items) || block.items.length > maxCards) {
        throw new Error(
          `academy_cards block ${index} must have 0-${maxCards} items`,
        );
      }
      const items = block.items.map((item, itemIndex) => {
        if (!isRecord(item)) {
          throw new Error(
            `academy card ${index}.${itemIndex} must be an object`,
          );
        }
        if (
          typeof item.id !== "string" ||
          typeof item.name !== "string" ||
          typeof item.match_score !== "number" ||
          typeof item.thumbnail !== "string" ||
          !Array.isArray(item.reason_tags) ||
          !item.reason_tags.every((tag) => typeof tag === "string") ||
          !(typeof item.price_monthly === "number" ||
            item.price_monthly === null)
        ) {
          throw new Error(
            `academy card ${index}.${itemIndex} has invalid schema`,
          );
        }
        if (
          options.allowedAcademyIds &&
          !options.allowedAcademyIds.has(item.id)
        ) {
          throw new Error(
            `academy card ${index}.${itemIndex} references unknown academy`,
          );
        }
        academyCardCount += 1;
        if (academyCardCount > maxCards) {
          throw new Error(`academy_cards exceed limit ${maxCards}`);
        }
        return {
          id: item.id,
          name: item.name,
          match_score: item.match_score,
          thumbnail: item.thumbnail,
          reason_tags: item.reason_tags,
          price_monthly: item.price_monthly,
        };
      });
      return { type: "academy_cards", items };
    }

    if (block.type === "quick_replies") {
      if (!Array.isArray(block.items) || block.items.length > 4) {
        throw new Error(`quick_replies block ${index} must have 1-4 items`);
      }
      const items = block.items.map((item, itemIndex) => {
        if (
          !isRecord(item) ||
          typeof item.label !== "string" ||
          typeof item.payload !== "string" ||
          !isValidQuickReplyPayload(item.payload)
        ) {
          throw new Error(
            `quick reply ${index}.${itemIndex} has invalid schema`,
          );
        }
        return { label: item.label, payload: item.payload };
      });
      return { type: "quick_replies", items };
    }

    throw new Error(`unsupported block type: ${block.type}`);
  });
}

export function countAcademyCards(blocks: ContentBlock[]): number {
  return blocks.reduce((sum, block) => {
    if (block.type !== "academy_cards") return sum;
    return sum + block.items.length;
  }, 0);
}

export function collectAcademyCardIdsFromRows(
  rows: { content_blocks: unknown }[],
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!Array.isArray(row.content_blocks)) continue;
    for (const block of row.content_blocks) {
      if (!isRecord(block) || block.type !== "academy_cards") continue;
      if (!Array.isArray(block.items)) continue;
      for (const item of block.items) {
        if (isRecord(item) && typeof item.id === "string") ids.add(item.id);
      }
    }
  }
  return ids;
}

export function createNoMatchBlocks(): ContentBlock[] {
  return [
    {
      type: "text",
      text:
        "조건에 딱 맞는 학원을 찾지 못했어요.\n조건을 조금 넓히면 다시 추천해드릴 수 있어요.",
    },
    {
      type: "quick_replies",
      items: [
        { label: "지역 넓히기", payload: "relax:region" },
        { label: "가격대 넓히기", payload: "relax:price" },
        { label: "과목만 유지", payload: "relax:subject_only" },
      ],
    },
  ];
}

/**
 * Solar JSON 파싱 실패 시 DB 학원 목록으로 카드 블록을 구성한다.
 * (세션이 502로 깨지지 않도록 하는 최후 폴백)
 */
export function createAcademyRecommendationFallback(
  academies: object[],
  maxCards = MAX_ACADEMY_CARDS_PER_TURN,
): ContentBlock[] {
  if (!academies.length) return createNoMatchBlocks();

  const items: AcademyCard[] = academies.slice(0, maxCards).map((raw, index) => {
    const academy = raw as Record<string, unknown>;
    const tags = Array.isArray(academy.tags)
      ? academy.tags.filter((t): t is string => typeof t === "string").slice(0, 3)
      : [];
    const classes = Array.isArray(academy.classes) ? academy.classes : [];
    const fee = classes
      .map((c) => (isRecord(c) && typeof c.fee === "number" ? c.fee : null))
      .find((v) => v != null) ?? 0;
    const subject = typeof academy.subject === "string" ? academy.subject : "";
    const thumbnail = subject.includes("영어")
      ? "✏️"
      : subject.includes("과학")
      ? "🔬"
      : "📐";

    return {
      id: String(academy.id ?? ""),
      name: typeof academy.name === "string" ? academy.name : "학원",
      match_score: Math.max(70, 95 - index * 4),
      thumbnail,
      reason_tags: tags.length
        ? tags
        : [subject || "추천", "맞춤"].filter(Boolean).slice(0, 3),
      price_monthly: fee,
    };
  }).filter((card) => card.id.length > 0);

  if (!items.length) return createNoMatchBlocks();

  return [
    {
      type: "text",
      text:
        "선호도에 맞는 학원을 찾아봤어요.\n카드를 눌러 자세히 확인해보세요.",
    },
    { type: "academy_cards", items },
    {
      type: "quick_replies",
      items: [
        { label: "다른 학원 보기", payload: "action:recommend_academies" },
        { label: "지역 넓히기", payload: "relax:region" },
        { label: "가격대 넓히기", payload: "relax:price" },
      ],
    },
  ];
}

/** 홈 Agent 콜드 스타트 — Solar 호출 없이 환영 + 숏컷 칩만 반환 */
export function createColdStartBlocks(): ContentBlock[] {
  return [
    {
      type: "text",
      text:
        "안녕하세요! 에듀플로 AI 도우미예요.\n학원 추천, 설명회, 일정, 상담까지 편하게 물어보세요.",
    },
    {
      type: "quick_replies",
      items: [
        {
          label: "🏫 학원 추천",
          payload: "action:recommend_academies",
        },
        {
          label: "📣 설명회",
          payload: "action:explore_seminars",
        },
        {
          label: "📅 일정 정리",
          payload: "action:organize_schedule",
        },
        {
          label: "💬 상담 예약",
          payload: "action:book_consult",
        },
      ],
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidQuickReplyPayload(payload: string): boolean {
  return payload.startsWith("filter:") ||
    payload.startsWith("relax:") ||
    payload.startsWith("action:");
}

// ─── Academy DB Query ─────────────────────────────────────────────

export interface AcademyQueryArgs {
  subject?: string;
  region?: string;
  fee_max?: number;
  target_grade?: string;
  exclude_ids?: string[];
}

export async function queryAcademies(
  supa: SupabaseClient,
  args: AcademyQueryArgs,
): Promise<object[]> {
  let q = supa
    .from("academies")
    .select(
      "id, name, description, address, subject, target_grade, tags, classes(fee, is_recruiting)",
    )
    .limit(5); // Solar가 최종 3개 선택

  if (args.region) q = q.ilike("address", `%${args.region}%`);
  if (args.subject) q = q.ilike("subject", `%${args.subject}%`);
  if (args.target_grade) q = q.ilike("target_grade", `%${args.target_grade}%`);
  if (args.exclude_ids?.length) {
    q = q.not("id", "in", `(${args.exclude_ids.join(",")})`);
  }

  const { data, error } = await q;
  if (error) {
    console.error("queryAcademies error:", error.message);
    return [];
  }

  const academies = data ?? [];
  if (args.fee_max != null) {
    return academies.filter((a: any) =>
      (a.classes as any[])?.some((c: any) =>
        c.is_recruiting && (!c.fee || c.fee <= args.fee_max!)
      )
    );
  }
  return academies;
}

// ─── Profile Tags → Query Args ────────────────────────────────────

// profile_tags는 "category:value" 형식(tagDictionary.ts 기준)으로 들어온다.
// 예: "subject:math", "grade:mid_2", "budget:mid" — 한글 원문이 아니므로 키워드 스캔 대신 값 매핑이 필요하다.
const SUBJECT_TAG_TO_LABEL: Record<string, string> = {
  math: "수학",
  english: "영어",
  korean: "국어",
  science: "과학",
  social: "사회",
  coding: "코딩",
};

// academies.target_grade는 "초등/중등/고등" 같은 넓은 범주 라벨로 저장되므로,
// grade:mid_2 같은 세부 학년 태그는 초/중/고 범주로 축약해서 매칭한다.
const GRADE_PREFIX_TO_LABEL: Record<string, string> = {
  elem: "초등",
  mid: "중등",
  high: "고등",
};

const BUDGET_TAG_TO_FEE_MAX: Record<string, number> = {
  low: 300000,
  mid: 500000,
  high: 800000,
};

// chat-message에서는 profile_tags 뒤에 사용자의 자유 발화(userText)도 함께 넘어온다.
// 자유 발화는 "category:value" 형식이 아니므로, 그 안의 한글 언급은 기존 방식대로 키워드 스캔한다.
const REGION_KEYWORDS = [
  "강남",
  "서초",
  "송파",
  "마포",
  "분당",
  "판교",
  "목동",
  "노원",
  "용산",
];
const FREE_TEXT_SUBJECT_KEYWORDS = Object.values(SUBJECT_TAG_TO_LABEL);

export function extractQueryArgs(profileTags: string[]): AcademyQueryArgs {
  let subject: string | undefined;
  let region: string | undefined;
  let target_grade: string | undefined;
  let fee_max: number | undefined;

  for (const tag of profileTags) {
    if (tag.includes(":")) {
      const [category, value] = tag.split(":");
      if (category === "subject" && !subject) {
        subject = SUBJECT_TAG_TO_LABEL[value];
      } else if (category === "grade" && !target_grade) {
        target_grade = GRADE_PREFIX_TO_LABEL[value?.split("_")[0]];
      } else if (category === "budget" && fee_max === undefined) {
        fee_max = BUDGET_TAG_TO_FEE_MAX[value];
      }
      continue;
    }

    // 자유 발화 (예: chat-message의 userText) — 한글 키워드 스캔으로 보완
    if (!subject) {
      subject = FREE_TEXT_SUBJECT_KEYWORDS.find((k) => tag.includes(k));
    }
    if (!region) {
      region = REGION_KEYWORDS.find((k) => tag.includes(k));
    }
    if (fee_max === undefined) {
      const feeMatch = tag.match(/월\s*(\d+)만/);
      if (feeMatch) fee_max = parseInt(feeMatch[1]) * 10000;
    }
  }

  return { subject, region, target_grade, fee_max };
}

// ─── Academy List → Solar Context String ──────────────────────────

export function academyListToContext(academies: object[]): string {
  if (!academies.length) return "현재 조건에 맞는 학원 데이터가 없습니다.";
  return JSON.stringify(academies, null, 2);
}
