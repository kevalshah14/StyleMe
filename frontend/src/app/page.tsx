import SegmentPlayground from "@/components/SegmentPlayground";
import TryOnPlayground from "@/components/TryOnPlayground";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col gap-6 py-2">
        <SegmentPlayground />
        <hr className="mx-auto w-full max-w-3xl border-0 border-t-[3px] border-neo-ink" />
        <TryOnPlayground />
      </main>
    </div>
  );
}
