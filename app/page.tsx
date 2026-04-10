import { VibinHome } from "@/components/VibinHome";

export default function Home() {
  return (
    <main className="vibin-page-bg flex min-h-[100dvh] w-full flex-col items-center px-[clamp(1rem,4vw,1.5rem)] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:py-8">
      <VibinHome />
    </main>
  );
}
