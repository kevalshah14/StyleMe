import SegmentPlayground from "@/components/SegmentPlayground";

export default function Home() {
  return (
    <div className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
      <main className="flex flex-1 flex-col">
        <SegmentPlayground />
      </main>
    </div>
  );
}
