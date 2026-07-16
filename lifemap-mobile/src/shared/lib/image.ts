import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Compress a picked image to a small JPEG data URI.
 *
 * Photos are stored **inline in Firestore docs** (the free tier has no
 * Storage bucket), so size must stay bounded. At 900px / q0.55 a photo lands
 * around 60–150 KB; callers cap the count to keep docs under Firestore's
 * 1 MiB limit. If the project ever moves to Blaze, swap the call sites for
 * real Storage uploads and delete this.
 */
const MAX_WIDTH = 900;
const QUALITY = 0.55;

export async function compressToDataUri(uri: string): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: MAX_WIDTH });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALITY,
    base64: true,
  });
  if (!result.base64) throw new Error('Could not compress photo.');
  return `data:image/jpeg;base64,${result.base64}`;
}
