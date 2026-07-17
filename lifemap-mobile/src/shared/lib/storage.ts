import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  deleteObject,
  getDownloadURL,
  listAll,
  ref,
  uploadBytes,
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

/**
 * Read a local file into a **native** Blob via XHR.
 *
 * Load-bearing: React Native cannot construct a Blob from an ArrayBuffer
 * ("Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not
 * supported"), which rules out `uploadString(base64)` and `uploadBytes(bytes)`
 * — the Firebase SDK converts both to a Blob internally. An XHR-fetched Blob is
 * backed by native blob data, so `uploadBytes` forwards it untouched.
 */
function uriToBlob(uri: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response as Blob);
    xhr.onerror = () => reject(new Error('Could not read the photo.'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

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
    base64: false,
  });

  const blob = await uriToBlob(result.uri);
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, blob, { contentType: 'image/jpeg' });
  // RN blobs hold native memory until closed.
  (blob as Blob & { close?: () => void }).close?.();

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
