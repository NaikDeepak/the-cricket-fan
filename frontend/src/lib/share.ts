// frontend/src/lib/share.ts
import { toPng } from "html-to-image";

export async function captureCard(el: HTMLElement): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts) {
    await document.fonts.ready;
  }

  const dataUrl = await toPng(el, {
    width: el.offsetWidth,
    height: el.offsetHeight,
    pixelRatio: 2,
    cacheBust: true,
  });

  const res = await fetch(dataUrl);
  return res.blob();
}

export async function copyImageToClipboard(blob: Blob): Promise<void> {
  if (!navigator.clipboard?.write) {
    throw new Error("Clipboard write API not supported in this environment");
  }
  const item = new ClipboardItem({ "image/png": blob });
  await navigator.clipboard.write([item]);
}

export async function downloadCard(blob: Blob, filename: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareCard(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "The Cricket Fan" });
  } else {
    await downloadCard(blob, filename);
  }
}
