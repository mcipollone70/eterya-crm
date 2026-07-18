import { ImageIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface ManualMediaProps {
  src?: string | null;
  alt?: string;
  caption?: string;
  type?: "image" | "video";
  className?: string;
}

/** Media riutilizzabile per guide del manuale con fallback placeholder. */
export function ManualMedia({
  src,
  alt = "Immagine guida",
  caption,
  type = "image",
  className,
}: ManualMediaProps) {
  if (!src) {
    return (
      <figure className={cn("overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50", className)}>
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <ImageIcon className="h-8 w-8 text-slate-300" aria-hidden="true" />
          <p className="text-sm text-slate-500">Immagine guida in preparazione</p>
        </div>
        {caption && (
          <figcaption className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  }

  return (
    <figure className={cn("overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      {type === "video" ? (
        <video
          src={src}
          controls
          className="w-full"
          aria-label={alt}
        >
          <track kind="captions" />
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="w-full object-cover" loading="lazy" />
      )}
      {caption && (
        <figcaption className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
