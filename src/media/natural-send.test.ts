import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { resolveNaturalMediaIntent } from './natural-send';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-natural-send-test',
  Date.now().toString()
);

describe('resolveNaturalMediaIntent', () => {
  beforeEach(async () => {
    await fs.ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.remove(TEST_DIR);
  });

  it('should ignore unrelated natural language', async () => {
    const result = await resolveNaturalMediaIntent('帮我看看 auth.ts 的问题', {
      workingDir: TEST_DIR,
      desktopDirs: [TEST_DIR],
    });

    expect(result).toBeNull();
  });

  it('should resolve an explicit local path request', async () => {
    const filePath = path.join(TEST_DIR, 'report.pdf');
    await fs.writeFile(filePath, 'demo', 'utf8');

    const result = await resolveNaturalMediaIntent(`把 "${filePath}" 发给我`, {
      workingDir: TEST_DIR,
      desktopDirs: [TEST_DIR],
    });

    expect(result).toMatchObject({
      kind: 'resolved',
      resolvedPath: filePath,
      mode: 'file',
    });
  });

  it('should resolve a desktop file request by filename', async () => {
    const imagePath = path.join(TEST_DIR, 'screenshot.png');
    await fs.writeFile(imagePath, 'demo', 'utf8');

    const result = await resolveNaturalMediaIntent('把桌面上的 screenshot.png 发给我', {
      workingDir: '/tmp/project',
      desktopDirs: [TEST_DIR],
    });

    expect(result).toMatchObject({
      kind: 'resolved',
      resolvedPath: imagePath,
      mode: 'image',
    });
  });

  it('should ask for clarification when the desktop request is too vague', async () => {
    const result = await resolveNaturalMediaIntent('把桌面上的某个文件发给我', {
      workingDir: TEST_DIR,
      desktopDirs: [TEST_DIR],
    });

    expect(result).toMatchObject({
      kind: 'clarify',
    });
    expect(result?.message).toContain('还没说具体文件名');
  });

  it('should report ambiguity when multiple desktop files match', async () => {
    await fs.writeFile(path.join(TEST_DIR, 'report-final.pdf'), 'a', 'utf8');
    await fs.writeFile(path.join(TEST_DIR, 'report-draft.pdf'), 'b', 'utf8');

    const result = await resolveNaturalMediaIntent('把桌面上的 report 发给我', {
      workingDir: TEST_DIR,
      desktopDirs: [TEST_DIR],
    });

    expect(result).toMatchObject({
      kind: 'ambiguous',
    });
    expect(result?.candidates).toHaveLength(2);
  });
});
