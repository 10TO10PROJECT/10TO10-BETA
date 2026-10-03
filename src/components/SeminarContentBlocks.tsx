import type { ReactNode } from "react";
import type { SeminarContent } from "@/content/seminarContent";

function getDeadlineBadge(deadlineAt: string) {
  const deadline = new Date(deadlineAt);
  const now = new Date();
  if (now.getTime() > deadline.getTime()) return "마감";
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(deadline) - startOfDay(now)) / 86_400_000);
  return days === 0 ? "D-Day" : `D-${days}`;
}

export const SeminarDeadlineBand = ({ deadline }: { deadline: NonNullable<SeminarContent["deadline"]> }) => (
  <div className="mb-3 flex items-center justify-between gap-3 break-keep rounded-xl bg-primary/10 px-4 py-3">
    <span className="text-sm font-bold text-secondary-foreground">{deadline.text}</span>
    <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-foreground">
      {getDeadlineBadge(deadline.deadlineAt)}
    </span>
  </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="mb-8 break-keep">
    <h2 className="mb-3 text-lg font-bold text-foreground">{title}</h2>
    {children}
  </section>
);

export const SeminarContentSections = ({ content }: { content: SeminarContent }) => {
  const { takeaways, speakers, program, faq } = content;

  return (
    <>
      {takeaways && takeaways.items.length > 0 && (
        <Section title={takeaways.title}>
          <ol className="space-y-3.5">
            {takeaways.items.map((item, idx) => (
              <li key={idx} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {idx + 1}
                </span>
                <div>
                  <p className="text-[15px] font-bold leading-snug text-foreground">{item.title}</p>
                  {item.desc && <p className="mt-0.5 text-sm text-muted-foreground">{item.desc}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {speakers && speakers.items.length > 0 && (
        <Section title={speakers.title}>
          <div className="grid grid-cols-2 gap-3">
            {speakers.items.map((speaker, idx) => (
              <div key={idx} className="rounded-2xl border border-border px-3 py-4 text-center">
                {speaker.photo ? (
                  <img
                    src={speaker.photo}
                    alt={speaker.name}
                    loading="lazy"
                    className="mx-auto h-20 w-20 rounded-full object-cover ring-2 ring-primary ring-offset-2 ring-offset-background"
                  />
                ) : (
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-secondary text-xl font-bold text-secondary-foreground">
                    {speaker.name.charAt(0)}
                  </div>
                )}
                <p className="mt-3 text-[15px] font-bold text-foreground">{speaker.name}</p>
                {speaker.org && <p className="text-xs font-medium text-muted-foreground">{speaker.org}</p>}
                {speaker.note && (
                  <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-snug text-secondary-foreground">
                    {speaker.note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {program && program.items.length > 0 && (
        <Section title={program.title}>
          <ol className="ml-1.5 space-y-3 border-l-2 border-border pl-5">
            {program.items.map((item, idx) => (
              <li key={idx} className="relative text-sm leading-relaxed text-muted-foreground">
                <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                <span className="font-bold text-foreground">{item.title}</span>
                {item.desc && <> — {item.desc}</>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {faq && faq.items.length > 0 && (
        <Section title={faq.title}>
          <div className="space-y-2">
            {faq.items.map((item, idx) => (
              <div key={idx} className="rounded-xl bg-muted px-4 py-3">
                <p className="text-sm font-bold text-foreground">{item.q}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.a}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
};

export const SeminarContentFooter = ({ footer }: { footer: NonNullable<SeminarContent["footer"]> }) => {
  const parts = [
    footer.host && `주최 ${footer.host}`,
    footer.organizer && `기획·운영 ${footer.organizer}`,
    footer.contact && `문의 ${footer.contact}`,
  ].filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <footer className="mb-6 break-keep border-t border-border pt-4 text-xs text-muted-foreground">
      {parts.join(" · ")}
    </footer>
  );
};
