import { JamHome } from "@/components/JamHome";

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-4 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <JamHome />
    </main>
  );
}
