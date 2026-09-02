import { Sidebar } from "@/components/Sidebar";

export default function MangaLoading() {
  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      <Sidebar />

      <main className="w-full pt-8 md:pt-24 lg:pt-28">
        <div className="px-5 sm:px-8 md:px-10 lg:px-12 3xl:px-16 w-full max-w-[1460px] 3xl:max-w-none mx-auto space-y-12">
          
          {/* Header Skeleton */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="w-56 h-7 rounded-full bg-white/[0.05] animate-pulse" />
              <div className="w-80 h-12 rounded-2xl bg-white/[0.08] animate-pulse" />
              <div className="w-96 h-5 rounded-xl bg-white/[0.04] animate-pulse" />
            </div>

            {/* Type selector skeleton */}
            <div className="w-64 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] animate-pulse" />
          </div>

          {/* Search bar skeleton */}
          <div className="space-y-4">
            <div className="max-w-xl h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] animate-pulse" />
            <div className="flex gap-2 overflow-x-hidden pt-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="shrink-0 w-24 h-9 rounded-xl bg-white/[0.04] border border-white/[0.06] animate-pulse" />
              ))}
            </div>
          </div>

          {/* Trending Skeleton Section */}
          <div className="space-y-4">
            <div className="w-48 h-8 rounded-xl bg-white/[0.06] animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-3xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
              ))}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
