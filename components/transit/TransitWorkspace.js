import { SearchPanel, TransitStopPanel, TransitSummary } from "./TransitUI";

export default function TransitWorkspace({ map, search, summary, stop, status }) {
  return (
    <main className="relative flex h-[100dvh] w-full overflow-hidden bg-[#dce3e2]">
      <aside className="pointer-events-none absolute inset-0 z-20 md:pointer-events-auto md:relative md:flex md:h-full md:w-[400px] md:shrink-0 md:flex-col md:border-r md:border-gray-200 md:bg-white">
        <div
          className={`pointer-events-auto absolute left-3 right-3 top-3 max-h-[calc(100dvh-24px)] overflow-hidden rounded-xl border border-white/70 bg-white/96 shadow-[0_14px_45px_rgba(20,36,34,0.16)] backdrop-blur-xl md:static md:min-h-0 md:w-full md:rounded-none md:border-0 md:bg-white md:shadow-none ${stop.selectedStop ? "max-md:hidden md:shrink-0" : "md:flex md:flex-1 md:flex-col"}`}
        >
          <SearchPanel {...search} compact={Boolean(stop.selectedStop)} />

          {search.location && !stop.selectedStop && <TransitSummary {...summary} />}
        </div>

        {stop.selectedStop && <TransitStopPanel {...stop} />}
      </aside>

      <div className="absolute inset-0 md:relative md:min-w-0 md:flex-1">{map}</div>

      <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2" aria-live="polite">
        {(status.loading || status.error) && (
          <div className="rounded-full border border-white/70 bg-white/90 px-4 py-2 text-xs font-medium text-gray-600 shadow-lg backdrop-blur-xl">
            {status.loading ? status.loadingMessage : status.error}
          </div>
        )}
      </div>
    </main>
  );
}
