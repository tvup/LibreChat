import React, { useState, useEffect, useCallback } from 'react';
import { X, ZoomIn, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';

export interface GalleryImage {
  src: string;
  alt: string;
  fileId: string;
}

function isImageType(type: string, filename: string): boolean {
  if (!type && !filename) {
    return false;
  }
  const imageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
  if (imageTypes.includes(type)) {
    return true;
  }
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

export function ImageThumbnail({
  src,
  alt,
  type,
  filename,
  galleryImages,
  galleryIndex,
  onDelete,
}: {
  src: string;
  alt: string;
  type: string;
  filename: string;
  galleryImages?: GalleryImage[];
  galleryIndex?: number;
  onDelete?: (fileId: string) => void;
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  if (!isImageType(type, filename) || imgError) {
    return null;
  }

  return (
    <>
      <button
        onClick={() => setLightboxOpen(true)}
        className="group relative inline-flex size-8 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-border-light bg-surface-hover"
        title="Preview image"
      >
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          onError={() => setImgError(true)}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/30">
          <ZoomIn className="size-3 text-white opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </button>
      {lightboxOpen && galleryImages && galleryIndex != null && galleryIndex >= 0 ? (
        <ImageGalleryLightbox
          images={galleryImages}
          startIndex={galleryIndex}
          onClose={() => setLightboxOpen(false)}
          onDelete={onDelete}
        />
      ) : lightboxOpen ? (
        <ImageLightbox src={src} alt={alt} onClose={() => setLightboxOpen(false)} />
      ) : null}
    </>
  );
}

export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
        aria-label="Close preview"
      >
        <X className="size-6" />
      </button>
      <div className="max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
        />
        <p className="mt-2 text-center text-sm text-white/70">{alt}</p>
      </div>
    </div>
  );
}

export function ImageGalleryLightbox({
  images,
  startIndex,
  onClose,
  onDelete,
}: {
  images: GalleryImage[];
  startIndex: number;
  onClose: () => void;
  onDelete?: (fileId: string) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const safeIndex = Math.min(currentIndex, images.length - 1);
  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < images.length - 1;

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, images.length - 1));
  }, [images.length]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const handleDelete = useCallback(() => {
    if (!onDelete || images.length === 0) {
      return;
    }
    const current = images[safeIndex];
    onDelete(current.fileId);

    // After deletion, the images array will shrink by 1 via React Query invalidation.
    // If we're at the last image, step back so we don't go out of bounds.
    // If only 1 image remains after delete (length was 1), close the lightbox.
    if (images.length <= 1) {
      onClose();
    } else if (safeIndex >= images.length - 1) {
      setCurrentIndex(safeIndex - 1);
    }
    // Otherwise keep currentIndex — the next image slides into this position.
    setConfirmingDelete(false);
  }, [onDelete, images, safeIndex, onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (confirmingDelete) {
        if (e.key === 'Escape') {
          setConfirmingDelete(false);
        } else if (e.key === 'Enter') {
          handleDelete();
        }
        return;
      }
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && hasNext) {
        goNext();
      } else if (e.key === 'ArrowLeft' && hasPrev) {
        goPrev();
      } else if (e.key === 'Delete' && onDelete) {
        setConfirmingDelete(true);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev, hasNext, hasPrev, onDelete, confirmingDelete, handleDelete]);

  // Preload adjacent images
  useEffect(() => {
    for (const offset of [-1, 1]) {
      const idx = safeIndex + offset;
      if (idx >= 0 && idx < images.length) {
        const img = new Image();
        img.src = images[idx].src;
      }
    }
  }, [safeIndex, images]);

  if (images.length === 0) {
    return null;
  }

  const current = images[safeIndex];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      {/* Top bar: close + delete */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); setConfirmingDelete(true); }}
            className="rounded-full bg-black/50 p-2 text-red-400 transition-colors hover:bg-red-500/30 hover:text-red-300"
            aria-label="Delete image"
          >
            <Trash2 className="size-5" />
          </button>
        )}
        <button
          onClick={onClose}
          className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
          aria-label="Close preview"
        >
          <X className="size-6" />
        </button>
      </div>

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70"
          aria-label="Previous image"
        >
          <ChevronLeft className="size-6" />
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-3 text-white transition-colors hover:bg-black/70"
          aria-label="Next image"
        >
          <ChevronRight className="size-6" />
        </button>
      )}

      {/* Image */}
      <div className="max-h-[90vh] max-w-[85vw]" onClick={(e) => e.stopPropagation()}>
        <img
          src={current.src}
          alt={current.alt}
          className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl"
        />
        <div className="mt-2 flex items-center justify-center gap-3">
          <p className="text-sm text-white/70">{current.alt}</p>
          <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-white/80">
            {safeIndex + 1} / {images.length}
          </span>
        </div>
      </div>

      {/* Delete confirmation overlay */}
      {confirmingDelete && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
          onClick={(e) => { e.stopPropagation(); setConfirmingDelete(false); }}
        >
          <div
            className="rounded-xl bg-surface-primary p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-base font-semibold text-text-primary">Delete this image?</p>
            <p className="mb-4 text-sm text-text-secondary">{current.alt}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-lg border border-border-light px-4 py-2 text-sm text-text-primary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                autoFocus
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-surface-primary"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { isImageType };
