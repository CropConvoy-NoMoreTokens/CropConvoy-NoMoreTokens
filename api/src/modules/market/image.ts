import type { Dependencies } from '../../core/dependencies.js';
import { ApiError } from '../../core/errors.js';

export const maxHarvestImageBytes = 3 * 1024 * 1024;
export type HarvestImageType = 'image/jpeg' | 'image/png' | 'image/webp';
const validTypes = new Set<HarvestImageType>(['image/jpeg', 'image/png', 'image/webp']);

export function validateHarvestImage(body: unknown, contentType: string | undefined):
  { bytes: Buffer; mimeType: HarvestImageType } {
  const mimeType = contentType?.split(';', 1)[0]?.trim().toLowerCase() as HarvestImageType | undefined;
  if (!mimeType || !validTypes.has(mimeType))
    throw new ApiError(415, 'UNSUPPORTED_IMAGE', 'Upload a JPEG, PNG, or WebP image');
  if (!Buffer.isBuffer(body) || !body.length)
    throw new ApiError(422, 'EMPTY_IMAGE', 'Choose an image containing readable text');
  if (body.length > maxHarvestImageBytes)
    throw new ApiError(413, 'IMAGE_TOO_LARGE', 'Choose an image smaller than 3 MB');
  const jpeg = mimeType === 'image/jpeg' && body.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  const png = mimeType === 'image/png' && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = mimeType === 'image/webp' && body.toString('ascii', 0, 4) === 'RIFF' && body.toString('ascii', 8, 12) === 'WEBP';
  if (!jpeg && !png && !webp)
    throw new ApiError(422, 'INVALID_IMAGE', 'The file does not match its image format');
  return { bytes: body, mimeType };
}

export async function readHarvestImage(deps: Dependencies, body: unknown, contentType: string | undefined) {
  const image = validateHarvestImage(body, contentType);
  if (deps.mode !== 'live' || !deps.llm.readImage)
    throw new ApiError(503, 'IMAGE_READING_UNAVAILABLE', 'Image reading requires the configured Gemini model');
  try {
    return { text: await deps.llm.readImage({ ...image, signal: AbortSignal.timeout(30000) }) };
  } catch {
    throw new ApiError(503, 'IMAGE_READING_UNAVAILABLE', 'Image reading failed. Type the description manually or try another image');
  }
}
