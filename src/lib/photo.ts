/**
 * Browser-side image downscale, run before upload.
 *
 * Photos live as bytes in Postgres (see the VisitPhoto model comment), so the
 * size of what leaves the phone is the thing that decides how long the storage
 * lasts. A 12MP iPhone shot is 3 to 5MB. At 1400px / quality 0.7 it lands
 * around 120 to 180KB and still reads clearly on a printed record.
 *
 * No dependency: canvas plus toBlob is enough.
 */

export const MAX_EDGE = 1400;
export const JPEG_QUALITY = 0.7;

export type Shrunk = { file: File; width: number; height: number; url: string };

export async function shrinkImage(file: File): Promise<Shrunk> {
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not compress that image"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return {
    file: new File([blob], name, { type: "image/jpeg" }),
    width,
    height,
    url: URL.createObjectURL(blob),
  };
}

/** "1.2 MB" / "184 KB" */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
