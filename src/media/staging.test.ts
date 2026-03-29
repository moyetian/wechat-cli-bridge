import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { inferMimeType, MediaStagingError, stageLocalMedia } from './staging';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-media-stage-test',
  Date.now().toString()
);

describe('media staging', () => {
  beforeEach(async () => {
    await fs.ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  it('should infer mime types from common extensions', () => {
    expect(inferMimeType('photo.png')).toBe('image/png');
    expect(inferMimeType('report.pdf')).toBe('application/pdf');
    expect(inferMimeType('unknown.bin')).toBeUndefined();
  });

  it('should stage a local image into bridge attachments directory', async () => {
    const sourcePath = path.join(TEST_DIR, 'screenshot.png');
    await fs.writeFile(sourcePath, 'image-data', 'utf8');

    const staged = await stageLocalMedia(sourcePath, {
      bridgeHome: TEST_DIR,
    });

    expect(staged.kind).toBe('image');
    expect(staged.status).toBe('staged');
    expect(staged.sizeBytes).toBeGreaterThan(0);
    expect(staged.sha256).toBeDefined();
    expect(staged.stagedPath).toContain(path.join(TEST_DIR, 'attachments'));
    expect(await fs.pathExists(staged.stagedPath!)).toBe(true);
  });

  it('should reject missing files', async () => {
    await expect(
      stageLocalMedia(path.join(TEST_DIR, 'missing.txt'), {
        bridgeHome: TEST_DIR,
      })
    ).rejects.toMatchObject<Partial<MediaStagingError>>({
      code: 'NOT_FOUND',
    });
  });

  it('should reject directories', async () => {
    await expect(
      stageLocalMedia(TEST_DIR, {
        bridgeHome: TEST_DIR,
      })
    ).rejects.toMatchObject<Partial<MediaStagingError>>({
      code: 'NOT_FILE',
    });
  });

  it('should enforce max file size when provided', async () => {
    const sourcePath = path.join(TEST_DIR, 'large.txt');
    await fs.writeFile(sourcePath, '1234567890', 'utf8');

    await expect(
      stageLocalMedia(sourcePath, {
        bridgeHome: TEST_DIR,
        maxSizeBytes: 4,
      })
    ).rejects.toMatchObject<Partial<MediaStagingError>>({
      code: 'TOO_LARGE',
    });
  });

  it('should reject protected sensitive paths', async () => {
    const secretDir = path.join(TEST_DIR, '.ssh');
    const secretPath = path.join(secretDir, 'id_rsa');
    await fs.ensureDir(secretDir);
    await fs.writeFile(secretPath, 'private-key', 'utf8');

    await expect(
      stageLocalMedia(secretPath, {
        bridgeHome: TEST_DIR,
      })
    ).rejects.toMatchObject<Partial<MediaStagingError>>({
      code: 'PROTECTED_PATH',
    });
  });

  it('should reject unsupported image transport types', async () => {
    const sourcePath = path.join(TEST_DIR, 'diagram.svg');
    await fs.writeFile(sourcePath, '<svg />', 'utf8');

    await expect(
      stageLocalMedia(sourcePath, {
        bridgeHome: TEST_DIR,
        transportKind: 'image',
      })
    ).rejects.toMatchObject<Partial<MediaStagingError>>({
      code: 'UNSUPPORTED_IMAGE_TYPE',
    });
  });
});
