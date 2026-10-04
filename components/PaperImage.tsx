'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

/**
 * A question/solution cut from the PDF (stored at 3× resolution).
 * Fits the available width — never wider than ~1.9× print size — and opens a zoomable view on tap.
 */
export default function PaperImage({ src, alt }: { src: string; alt: string; onZoom?: () => void }) {
  const [natural, setNatural] = useState<number | null>(null);
  const [zoom, setZoom] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setZoom(true)} className="block w-full cursor-zoom-in text-left" aria-label={`${alt} — tap to enlarge`}>
        <img
          src={src}
          alt={alt}
          onLoad={(e) => setNatural(e.currentTarget.naturalWidth)}
          style={{ width: '100%', maxWidth: natural ? Math.round(natural / 1.6) : undefined }}
          className="rounded-lg bg-white"
        />
      </button>
      {zoom && (
        <div className="fixed inset-0 z-[60] overflow-auto bg-slate-900/85 p-3" onClick={() => setZoom(false)}>
          <div className="sticky top-0 mb-2 flex justify-end">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-700">Tap anywhere to close · pinch to zoom</span>
          </div>
          <img src={src} alt={alt} className="mx-auto rounded-lg bg-white" style={{ width: natural ? Math.max(natural / 1.5, 0) : '100%', maxWidth: 'none' }} />
        </div>
      )}
    </>
  );
}
