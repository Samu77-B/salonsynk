import type { HowItWorksVideo } from "@/config/how-it-works-videos";

export function HowItWorksVideoCard({ video }: { video: HowItWorksVideo }) {
  const ready = Boolean(video.src) && !video.comingSoon;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="relative aspect-video w-full bg-zinc-100">
        {ready ? (
          <video
            className="h-full w-full object-cover"
            controls
            playsInline
            preload="metadata"
            src={video.src}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600">
              Coming soon
            </span>
            <p className="text-sm text-zinc-500">Walkthrough video in progress</p>
          </div>
        )}
        {video.durationLabel && ready ? (
          <span className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
            {video.durationLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">{video.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{video.summary}</p>
        <ul className="mt-4 space-y-2 text-sm text-zinc-600">
          {video.bullets.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-[#808080]">✓</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}
