export function VideoBlock({
  src,
  poster,
  title,
  summary,
}: {
  src: string;
  poster: string;
  title: string;
  summary: string;
}) {
  return (
    <figure className="inst-card m-0 overflow-hidden p-0">
      {/* No autoplay, no sound-on-load (guide 04 §6). preload="none" keeps
          this off the critical path for Lighthouse — nothing downloads
          until the viewer presses play. */}
      <video controls preload="none" poster={poster} className="block w-full" style={{ background: "var(--bg-dark)" }}>
        <source src={src} type="video/mp4" />
        Your browser does not support embedded video. {summary}
      </video>
      <figcaption className="p-4">
        <p className="m-0 mb-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {title}
        </p>
        <p className="m-0 text-sm" style={{ color: "var(--text-secondary)" }}>
          {summary}
        </p>
      </figcaption>
    </figure>
  );
}
