import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadString,
} from 'firebase/storage';

import { storage } from '@/shared/lib/firebase';

/**
 * Compress a picked image and upload it to Firebase Storage, returning the
 * path and a tokenised download URL.
 *
 * Storage (not inline base64 in Firestore) is what lets photos be higher-res
 * and unbounded in count, and the returned download URL renders for a partner
 * too — the token grants read regardless of Storage rules, so a shared memory's
 * photos load for whoever can read its Firestore doc.
 */
const MAX_WIDTH = 1600;
const QUALITY = 0.7;

export async function uploadImage(
  uri: string,
  storagePath: string,
): Promise<{ downloadUrl: string; storagePath: string }> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: MAX_WIDTH });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({
    format: SaveFormat.JPEG,
    compress: QUALITY,
    base64: true,
  });
  if (!result.base64) throw new Error('Could not read the compressed photo.');

  // uploadString(base64) rather than uploadBytes(blob): RN Blobs are flaky with
  // the Firebase JS SDK on this Hermes runtime; base64 upload is reliable.
  const fileRef = ref(storage, storagePath);
  await uploadString(fileRef, result.base64, 'base64', {
    contentType: 'image/jpeg',
  });

  return { downloadUrl: await getDownloadURL(fileRef), storagePath };
}

/** Best-effort delete; a missing object (e.g. old inline photo) is not an error. */
export async function deleteImage(storagePath: string): Promise<void> {
  if (!storagePath || storagePath === 'inline') return;
  try {
    await deleteObject(ref(storage, storagePath));
  } catch {
    // object already gone or never in Storage — ignore
  }
}

/**
 * Delete every object under a prefix. Used where the doc stores download URLs
 * rather than storage paths (food/stay entries), so we clean up by folder.
 */
export async function deleteFolder(prefix: string): Promise<void> {
  try {
    const listing = await listAll(ref(storage, prefix));
    await Promise.all(listing.items.map((item) => deleteObject(item)));
  } catch {
    // nothing there — ignore
  }
}
