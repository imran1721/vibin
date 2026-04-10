"use client";

/**
 * Decorative preview of the in-room experience (sync, faces, reaction).
 * Not interactive — visual only for the landing page.
 */
export function HomeHeroMock() {
  return (
    <div
      className="mx-auto w-full max-w-[min(100%,320px)]"
      aria-hidden
    >
      <div className="border-border/80 bg-card/80 relative rounded-[1.35rem] border p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.28)] backdrop-blur-[2px] dark:shadow-black/50">
        <div className="relative overflow-hidden rounded-xl">
          <div className="from-muted/90 to-card aspect-video bg-gradient-to-br via-background/30 relative flex items-center justify-center">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h24v24H0z' fill='none'/%3E%3Ccircle cx='12' cy='12' r='1.2' fill='currentColor'/%3E%3C/svg%3E")`,
                backgroundSize: "18px 18px",
              }}
            />
            <div className="border-primary/25 bg-primary/15 relative flex size-[3.25rem] items-center justify-center rounded-full border shadow-inner">
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-primary ml-0.5 size-7"
                aria-hidden
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </div>
            <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
              <div className="bg-background/55 h-1 flex-1 overflow-hidden rounded-full">
                <div className="bg-primary h-full w-[38%] rounded-full" />
              </div>
              <span className="text-[0.65rem] font-medium tabular-nums text-white/90">
                1:24
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              {[
                "bg-sky-400/90",
                "bg-violet-400/90",
                "bg-amber-400/90",
              ].map((bg, i) => (
                <span
                  key={i}
                  className={`ring-background inline-flex size-7 items-center justify-center rounded-full text-[0.65rem] font-bold text-white ring-2 ${bg}`}
                >
                  {String.fromCharCode(65 + i)}
                </span>
              ))}
            </div>
            <span className="text-muted-foreground text-[0.7rem] font-medium">
              +3 vibing
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-lg leading-none drop-shadow-sm">🔥</span>
            <span className="text-lg leading-none drop-shadow-sm">👏</span>
          </div>
        </div>
      </div>
    </div>
  );
}
