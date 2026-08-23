import Image from "next/image";

export interface ScreenshotItem {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
}

export function ScreenshotGrid({ items }: { items: ScreenshotItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      {items.map((item, i) => (
        <figure key={item.src} className="inst-card m-0 overflow-hidden p-0">
          <Image
            src={item.src}
            alt={item.alt}
            width={item.width}
            height={item.height}
            className="block h-auto w-full"
            loading={i === 0 ? "eager" : "lazy"}
            sizes="(min-width: 640px) 33vw, 100vw"
          />
          <figcaption className="p-3 text-xs" style={{ color: "var(--text-secondary)" }}>
            {item.caption}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
