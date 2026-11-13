'use client';

import { RefObject, useEffect, useRef } from 'react';

function isPointerOutsideDialog(e: PointerEvent, dialog: HTMLDialogElement): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    e.clientX < rect.left ||
    e.clientX > rect.right ||
    e.clientY < rect.top ||
    e.clientY > rect.bottom
  );
}

/**
 * Progressive light-dismiss fallback for native `<dialog closedby="any">` modals
 * on browsers where `HTMLDialogElement.prototype.closedBy` is unsupported (e.g. Safari),
 * plus synchronized `close` cleanup and `returnValue` reset.
 */
export function useDialogLightDismiss(
  dialogRef: RefObject<HTMLDialogElement | null>,
  onClose?: () => void
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onCloseRef.current?.();
    };
    dialog.addEventListener('close', handleClose);

    if ('closedBy' in HTMLDialogElement.prototype) {
      return () => {
        dialog.removeEventListener('close', handleClose);
      };
    }

    let pressedOutside = false;
    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = dialog.open && isPointerOutsideDialog(e, dialog);
    };
    const handlePointerUp = (e: PointerEvent) => {
      if (pressedOutside && dialog.open && isPointerOutsideDialog(e, dialog)) {
        dialog.close();
      }
      pressedOutside = false;
    };

    dialog.addEventListener('pointerdown', handlePointerDown);
    dialog.addEventListener('pointerup', handlePointerUp);

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('pointerdown', handlePointerDown);
      dialog.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dialogRef]);
}

/**
 * Resizes and JPEG-compresses receipt photos client-side so multi-MB smartphone
 * screenshots stay fast to transfer and well under reverse-proxy upload limits.
 */
export async function prepareReceiptUploadDataUrl(
  file: File,
  maxDimension = 1280,
  quality = 0.82
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar (JPG, PNG, WEBP).');
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar bukti pembayaran.'));
    reader.readAsDataURL(file);
  });

  if (file.type === 'image/svg+xml' && rawDataUrl.length < 512 * 1024) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const largestSide = Math.max(img.width, img.height);
      const scale = largestSide > maxDimension ? maxDimension / largestSide : 1;
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }

      // White matte ensures transparent PNG screenshots stay readable on dark/light backgrounds
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const compressed = canvas.toDataURL('image/jpeg', quality);
      if (compressed.length > 4 * 1024 * 1024) {
        reject(new Error('Ukuran gambar terlalu besar. Pilih foto maksimal 4 MB.'));
        return;
      }
      resolve(compressed);
    };
    img.onerror = () => {
      if (rawDataUrl.length <= 1.5 * 1024 * 1024) {
        resolve(rawDataUrl);
      } else {
        reject(new Error('Format gambar tidak didukung browser. Gunakan JPG atau PNG.'));
      }
    };
    img.src = rawDataUrl;
  });
}
