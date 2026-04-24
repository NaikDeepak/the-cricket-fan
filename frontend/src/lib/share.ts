// frontend/src/lib/share.ts
import { toPng } from "html-to-image";

export async function captureCard(el: HTMLElement): Promise<Blob> {
  const font = new FontFace(
    "Space Grotesk",
    "url(https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mF71Q-gowFX.woff2)"
  );
  await font.load();
  document.fonts.add(font);

  const dataUrl = await toPng(el, {
    width: el.offsetWidth,
    height: el.offsetHeight,
    pixelRatio: 2,
  });

  const res = await fetch(dataUrl);
  return res.blob();
}

export async function shareCard(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: "The Cricket Fan" });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
