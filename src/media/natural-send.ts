import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { inferMediaKindFromPath } from './contract';
import { LocalMediaTransportKind } from './staging';

const SEND_PATTERNS = [
  /发给我/,
  /发我/,
  /发过来/,
  /传给我/,
  /传我/,
  /发送给我/,
  /发到微信/,
  /\bsend\s+me\b/i,
];

const DESKTOP_PATTERNS = [
  /桌面/,
  /\bdesktop\b/i,
];

const IMAGE_HINT_PATTERNS = [
  /图片/,
  /照片/,
  /截图/,
  /\bimage\b/i,
  /\bphoto\b/i,
];

const GENERIC_FILE_HINTS = new Set([
  '某个文件',
  '一个文件',
  '文件',
  '某个图片',
  '一个图片',
  '图片',
  '某张图片',
  '一张图片',
  '某个照片',
  '一个照片',
  '照片',
]);

export interface NaturalMediaIntentOptions {
  workingDir: string;
  desktopDirs?: string[];
}

export interface NaturalMediaIntent {
  kind: 'resolved' | 'clarify' | 'not_found' | 'ambiguous';
  mode?: LocalMediaTransportKind;
  resolvedPath?: string;
  message: string;
  candidates?: string[];
}

function includesAnyPattern(input: string, patterns: RegExp[]): boolean {
  return patterns.some(pattern => pattern.test(input));
}

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function looksLikePathFragment(input: string): boolean {
  return (
    input.startsWith('/') ||
    input.startsWith('./') ||
    input.startsWith('../') ||
    input.startsWith('~/') ||
    /^[A-Za-z]:\\/.test(input) ||
    input.includes('/') ||
    input.includes('\\') ||
    /\.[A-Za-z0-9]{1,8}$/.test(input)
  );
}

function extractQuotedValues(input: string): string[] {
  const values: string[] = [];
  const pattern = /"([^"]+)"|'([^']+)'/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    values.push((match[1] || match[2] || '').trim());
  }

  return values.filter(Boolean);
}

function extractPathLikeValues(input: string): string[] {
  const values = new Set<string>();

  for (const quoted of extractQuotedValues(input)) {
    if (looksLikePathFragment(quoted)) {
      values.add(quoted);
    }
  }

  const pattern =
    /(?:~\/|\.\.?\/|\/)[^\s"'，。；：！？]+|[A-Za-z]:\\[^\s"'，。；：！？]+|\b[^\s"'，。；：！？]+\.[A-Za-z0-9]{1,8}\b/g;
  const matches = input.match(pattern) || [];
  for (const match of matches) {
    values.add(match.trim());
  }

  return [...values];
}

function inferRequestedMode(input: string, resolvedPath?: string): LocalMediaTransportKind {
  if (resolvedPath && inferMediaKindFromPath(resolvedPath) === 'image') {
    if (includesAnyPattern(input, IMAGE_HINT_PATTERNS)) {
      return 'image';
    }

    return 'image';
  }

  if (includesAnyPattern(input, IMAGE_HINT_PATTERNS)) {
    return 'image';
  }

  return 'file';
}

function cleanupDesktopQuery(rawQuery: string): string {
  return rawQuery
    .replace(/^(上|上的|里|里的|中|中的|有|有个|有一个|那个|这个|那份|这份|一份|一个|某个)+/, '')
    .replace(/^(文件|图片|照片|截图)+/, '')
    .replace(/(文件|图片|照片|截图|给我|发给我|发我|发过来|传给我|传我|发送给我)+$/, '')
    .replace(/[“”"'`]/g, '')
    .trim();
}

async function resolveDesktopDirs(explicitDirs?: string[]): Promise<string[]> {
  if (explicitDirs && explicitDirs.length > 0) {
    return explicitDirs;
  }

  const candidates = new Set<string>([
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), '桌面'),
  ]);

  try {
    const windowsUsersRoot = '/mnt/c/Users';
    const entries = await fs.readdir(windowsUsersRoot);
    for (const entry of entries) {
      candidates.add(path.join(windowsUsersRoot, entry, 'Desktop'));
      candidates.add(path.join(windowsUsersRoot, entry, 'OneDrive', 'Desktop'));
    }
  } catch {
    // Ignore environments without Windows-mounted user folders.
  }

  const resolved: string[] = [];
  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(candidate);
      if (stats.isDirectory()) {
        resolved.push(candidate);
      }
    } catch {
      // Ignore missing candidates.
    }
  }

  return resolved;
}

async function findDesktopMatches(query: string, dirs: string[]): Promise<string[]> {
  const queryLower = query.toLowerCase();
  const matches = new Set<string>();

  for (const dir of dirs) {
    const entries = await fs.readdir(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      let stats;
      try {
        stats = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (!stats.isFile()) {
        continue;
      }

      const entryLower = entry.toLowerCase();
      const stemLower = path.parse(entry).name.toLowerCase();
      if (
        entryLower === queryLower ||
        stemLower === queryLower ||
        entryLower.includes(queryLower) ||
        stemLower.includes(queryLower)
      ) {
        matches.add(fullPath);
      }
    }
  }

  return [...matches];
}

function buildAmbiguousMessage(candidates: string[]): string {
  const lines = ['⚠️ 找到了多个可能的文件，请说得更具体：', ''];
  for (const candidate of candidates.slice(0, 5)) {
    lines.push(`- ${candidate}`);
  }
  lines.push('');
  lines.push('可以直接说完整文件名，或改用 `/sendfile "<path>"` / `/sendimage "<path>"`。');
  return lines.join('\n');
}

function buildClarifyMessage(): string {
  return [
    '⚠️ 我知道你是想让我直接发文件，但你还没说具体文件名。',
    '',
    '可以这样说：',
    '- 把桌面上的 report.pdf 发给我',
    '- 把 "./build/report.pdf" 发给我',
    '- 把桌面上的 screenshot.png 发给我',
  ].join('\n');
}

export async function resolveNaturalMediaIntent(
  input: string,
  options: NaturalMediaIntentOptions
): Promise<NaturalMediaIntent | null> {
  const normalized = normalizeWhitespace(input);

  if (!includesAnyPattern(normalized, SEND_PATTERNS)) {
    return null;
  }

  const pathCandidates = extractPathLikeValues(normalized);
  for (const rawPath of pathCandidates) {
    const expandedPath = rawPath.startsWith('~/')
      ? path.join(os.homedir(), rawPath.slice(2))
      : rawPath;
    const resolvedPath = path.resolve(options.workingDir, expandedPath);
    if (await fs.pathExists(resolvedPath)) {
      return {
        kind: 'resolved',
        resolvedPath,
        mode: inferRequestedMode(normalized, resolvedPath),
        message: `已识别为直接发文件请求: ${resolvedPath}`,
      };
    }
  }

  if (!includesAnyPattern(normalized, DESKTOP_PATTERNS)) {
    return null;
  }

  const sendPattern =
    /(桌面(?:上|上的|里|里的|中|中的)?|desktop(?:\s+folder)?)(?:的)?(.+?)(?:发给我|发我|发过来|传给我|传我|发送给我|发到微信|send me)/i;
  const match = normalized.match(sendPattern);
  const rawQuery = cleanupDesktopQuery(match?.[2] || '');

  if (!rawQuery || GENERIC_FILE_HINTS.has(rawQuery)) {
    return {
      kind: 'clarify',
      message: buildClarifyMessage(),
    };
  }

  const desktopDirs = await resolveDesktopDirs(options.desktopDirs);
  const matches = await findDesktopMatches(rawQuery, desktopDirs);

  if (matches.length === 0) {
    return {
      kind: 'not_found',
      message: `❌ 在桌面没有找到匹配文件: ${rawQuery}`,
    };
  }

  if (matches.length > 1) {
    return {
      kind: 'ambiguous',
      message: buildAmbiguousMessage(matches),
      candidates: matches,
    };
  }

  return {
    kind: 'resolved',
    resolvedPath: matches[0],
    mode: inferRequestedMode(normalized, matches[0]),
    message: `已识别桌面文件请求: ${matches[0]}`,
  };
}
