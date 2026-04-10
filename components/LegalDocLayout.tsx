import Link from "next/link";
import type { ReactNode } from "react";
import { AppBrandLockup } from "@/components/AppBrandLockup";
import { LegalFooter } from "@/components/LegalFooter";

const brandHomeLinkClass =
  "focus-visible:ring-ring hover:brightness-105 mb-8 inline-flex max-w-full rounded-xl outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const h2Class =
  "font-display text-foreground mt-10 scroll-mt-20 text-xl font-bold first:mt-0 sm:text-2xl";
const pClass = "text-muted-foreground text-sm leading-relaxed sm:text-base";
const ulClass = "text-muted-foreground list-inside list-disc space-y-2 text-sm leading-relaxed sm:text-base";

type Props = {
  title: string;
  intro: string;
  children: ReactNode;
};

export function LegalDocLayout({ title, intro, children }: Props) {
  return (
    <main className="vibin-page-bg flex min-h-full flex-col px-[clamp(1rem,4vw,1.75rem)] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto w-full max-w-prose flex-1">
        <Link href="/" aria-label="Back to vibin.click home" className={brandHomeLinkClass}>
          <AppBrandLockup />
        </Link>
        <h1 className="font-display text-foreground text-3xl font-extrabold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className={`${pClass} mt-4`}>{intro}</p>
        <div className="mt-8">{children}</div>
        <div className="mt-16">
          <LegalFooter />
        </div>
      </div>
    </main>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="space-y-3">
      <h2 className={h2Class}>{title}</h2>
      {children}
    </section>
  );
}

export function LegalP({ children }: { children: ReactNode }) {
  return <p className={pClass}>{children}</p>;
}

export function LegalUl({ children }: { children: ReactNode }) {
  return <ul className={ulClass}>{children}</ul>;
}
