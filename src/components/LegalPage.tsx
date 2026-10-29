import Link from "next/link";
import { t } from "@/lib/i18n";

interface Section {
  /** Anchor, for links to one section (/legal/confidentialite#temoins) */
  id?: string;
  title: string;
  paragraphs: string[];
}

/** Legal text page. DRAFT until reviewed by a lawyer (PLAN.md task 15). */
export function LegalPage({ title, version, sections }: { title: string; version: string; sections: Section[] }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 p-4 pb-12">
      <Link
        href="/"
        className="flex min-h-11 items-center self-start rounded-full font-medium text-blue-800 hover:underline focus-visible:outline-2 focus-visible:outline-blue-700"
      >
        {t.account.backToMap}
      </Link>
      <p role="note" className="rounded-xl bg-amber-100 p-3 font-medium text-amber-950">
        {t.legal.draft}
      </p>
      <header>
        <h1 className="text-2xl font-semibold text-zinc-950">{title}</h1>
        <p className="text-sm text-zinc-600">{version}</p>
      </header>
      {sections.map((section) => (
        <section key={section.title} id={section.id} className="flex scroll-mt-4 flex-col gap-2">
          <h2 className="text-lg font-semibold text-zinc-950">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-zinc-800">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </main>
  );
}
