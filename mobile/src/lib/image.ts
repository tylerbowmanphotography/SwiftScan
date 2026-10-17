import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Shrinks a photo to a size the scan API handles quickly and returns JPEG base64. */
export async function prepareForScan(uri: string, width?: number): Promise<{ uri: string; base64: string; mimeType: string }> {
  const ctx = ImageManipulator.manipulate(uri);
  if (!width || width > 1280) ctx.resize({ width: 1280 });
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.72, base64: true });
  if (!out.base64) throw new Error('Could not read the photo.');
  return { uri: out.uri, base64: out.base64, mimeType: 'image/jpeg' };
}
