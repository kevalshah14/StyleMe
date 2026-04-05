import SegmentPlayground from "@/components/SegmentPlayground";
import TryOnPlayground from "@/components/TryOnPlayground";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 flex-col gap-4">
        <SegmentPlayground />
        <hr className="mx-auto w-full max-w-3xl border-zinc-200 dark:border-zinc-800" />
        <TryOnPlayground />
      </main>
    </div>
  );
}
