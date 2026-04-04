import { JamHome } from "@/components/JamHome";

export default function Home() {
  return (
    <main className="jam-page-bg flex min-h-full flex-col items-center justify-center px-[clamp(1rem,4vw,1.75rem)] pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <JamHome />
    </main>
  );
}
