/**
 * 설명회별 상세 블록 콘텐츠.
 * `src/content/seminars/<설명회 id>.json` 파일이 있으면 상세 화면이 긴 본문 대신 블록으로 그려진다.
 */

export interface SeminarContent {
  deadline?: {
    text: string;
    /** ISO 8601, D-n 배지 계산 기준 */
    deadlineAt: string;
  };
  takeaways?: {
    title: string;
    items: { title: string; desc?: string }[];
  };
  speakers?: {
    title: string;
    items: { name: string; org?: string; note?: string; photo?: string }[];
  };
  program?: {
    title: string;
    items: { title: string; desc?: string }[];
  };
  faq?: {
    title: string;
    items: { q: string; a: string }[];
  };
  footer?: {
    host?: string;
    organizer?: string;
    contact?: string | null;
  };
  cta?: {
    note?: string;
    label: string;
    sub?: string;
  };
}

const modules = import.meta.glob<SeminarContent>("./seminars/*.json", {
  eager: true,
  import: "default",
});

const contentById: Record<string, SeminarContent> = Object.fromEntries(
  Object.entries(modules).map(([path, content]) => [
    path.replace("./seminars/", "").replace(/\.json$/, ""),
    content,
  ])
);

export function getSeminarContent(seminarId: string | undefined): SeminarContent | null {
  if (!seminarId) return null;
  return contentById[seminarId] ?? null;
}
