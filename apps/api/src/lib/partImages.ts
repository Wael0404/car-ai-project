import { createHash } from "node:crypto";
import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { MODELS_DIR } from "./model3d.js";
import { safeFetch } from "./productPage.js";

/**
 * Part photos are copied to our storage (served like the car photos):
 * shops block hot-linking from the app, and some use AVIF that Android
 * cannot always show. Each image is re-encoded as a small JPEG, which also
 * drops anything unexpected inside the original file.
 */

const MAX_IMAGE_BYTES = 6_000_000;
const SIZE = 480;
const PAD = 24;
const ACCEPTED = /^image\/(jpeg|jpg|png|webp|avif|gif|heic|heif)\b/i;

/** Product photo filling the square: white margins cut, then a small even padding. */
async function encode(input: Buffer): Promise<Buffer> {
  // Two passes: sharp may trim before flattening in a single pipeline, and a
  // transparent background is then never cut.
  const flat = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .png()
    .toBuffer();
  let trimmed: Buffer;
  try {
    // Threshold 30 also removes the light grey boxes some shops put around the part.
    trimmed = await sharp(flat).trim({ background: "#ffffff", threshold: 30 }).png().toBuffer();
  } catch {
    trimmed = flat; // a plain image has nothing to trim
  }
  return sharp(trimmed)
    .resize(SIZE - 2 * PAD, SIZE - 2 * PAD, { fit: "inside", withoutEnlargement: false })
    .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, background: "#ffffff" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
}

/** Returns the file path relative to the models folder ("parts/ab12.jpg"), or null. */
export async function storePartImage(imageUrl: string): Promise<string | null> {
  // "-3": encoding version (trimmed in two passes); older files are simply not reused.
  const name = `${createHash("sha256").update(imageUrl).digest("hex").slice(0, 24)}-3.jpg`;
  const rel = `parts/${name}`;
  const file = path.join(MODELS_DIR, "parts", name);
  try {
    await access(file);
    return rel; // already stored (same photo used by another offer or car)
  } catch {
    // not stored yet
  }

  const res = await safeFetch(imageUrl, "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8", MAX_IMAGE_BYTES);
  if (!res || !ACCEPTED.test(res.contentType)) return null;

  const jpeg = await encode(res.body);
  await mkdir(path.dirname(file), { recursive: true });
  // Write then rename (atomic): a crash or a full disk never leaves a broken
  // file that the "already stored" check above would serve forever.
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  try {
    await writeFile(tmp, jpeg);
    await rename(tmp, file);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
  return rel;
}
