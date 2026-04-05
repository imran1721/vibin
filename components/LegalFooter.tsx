import Link from "next/link";

const linkClass =
  "text-accent hover:brightness-110 focus-visible:ring-ring text-sm font-semibold underline underline-offset-4 transition-[filter] focus-visible:rounded focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function LegalFooter() {
  return (
    <footer className="border-border flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t pt-8 text-center">
      <Link href="/privacy" className={linkClass}>
        Privacy Policy
      </Link>
      <span className="text-muted-foreground text-sm" aria-hidden>
        ·
      </span>
      <Link href="/terms" className={linkClass}>
        Terms of Service
      </Link>
    </footer>
  );
}
