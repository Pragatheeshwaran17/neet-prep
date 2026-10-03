'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

/**
 * Shows a cropped question/solution image at roughly the size it was printed
 * (images are rendered at 2.5x for sharpness). Scrolls sideways on narrow phones.
 */
export default function PaperImage({ src, alt, onZoom }: { src: string; alt: string; onZoom?: () => void }) {
  const [w, setW] = useState<number | null>(null);
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <img
        src={src}
        alt={alt}
        onClick={onZoom}
        onLoad={(e) => setW(Math.round(e.currentTarget.naturalWidth / 1.8))}
        style={w ? { width: w, maxWidth: 'none' } : { maxWidth: '100%' }}
        className={`rounded-lg bg-white ${onZoom ? 'cursor-zoom-in' : ''}`}
      />
    </div>
  );
}
