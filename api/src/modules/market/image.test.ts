import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Dependencies } from '../../core/dependencies.js';
import { ApiError } from '../../core/errors.js';
import { readHarvestImage, validateHarvestImage, maxHarvestImageBytes } from './image.js';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

test('image reading validates bytes and MIME and returns only model transcription', async () => {
  let seen: { bytes: Buffer; mimeType: string; signal: AbortSignal } | undefined;
  const deps = { mode: 'live', llm: { async readImage(input: typeof seen) {
    seen = input; return 'දඹුල්ලේ තක්කාලි කිලෝ 80';
  } } } as unknown as Dependencies;
  assert.deepEqual(await readHarvestImage(deps, png, 'image/png'), { text: 'දඹුල්ලේ තක්කාලි කිලෝ 80' });
  assert.equal(seen?.mimeType, 'image/png');
  assert.equal(seen?.bytes, png);
  assert.equal(seen?.signal.aborted, false);
  assert.throws(() => validateHarvestImage(png, 'image/jpeg'),
    (error: unknown) => error instanceof ApiError && error.code === 'INVALID_IMAGE');
  assert.throws(() => validateHarvestImage(png, 'application/pdf'),
    (error: unknown) => error instanceof ApiError && error.status === 415);
  assert.throws(() => validateHarvestImage(Buffer.alloc(maxHarvestImageBytes + 1), 'image/png'),
    (error: unknown) => error instanceof ApiError && error.status === 413);
});

test('unconfigured image reading fails explicitly without invented text', async () => {
  const deps = { mode: 'stub', llm: {} } as Dependencies;
  await assert.rejects(readHarvestImage(deps, png, 'image/png'),
    (error: unknown) => error instanceof ApiError && error.code === 'IMAGE_READING_UNAVAILABLE');
});
