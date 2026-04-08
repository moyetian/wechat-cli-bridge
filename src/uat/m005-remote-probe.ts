import http from 'http';
import https from 'https';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  createDefaultResearchExecutorConfig,
  normalizeResearchExecutorConfig,
} from '../research';
import { getBridgePaths, resolveBridgeHome } from '../utils/paths';
import { DoctorStatus } from './m005-doctor';

export interface RemoteProbeCheck {
  id: string;
  status: DoctorStatus;
  summary: string;
  detail: string;
}

export interface RemoteProbeResult {
  homeDir: string;
  endpoint: string;
  reportPath: string;
  checks: RemoteProbeCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  nextActions: string[];
}

interface ParsedArgs {
  homeDir?: string;
  endpoint?: string;
  apiKey?: string;
  timeoutMs?: number;
}

interface ProbeHttpResponse {
  statusCode: number;
  elapsedMs: number;
  contentType: string;
  bodySnippet: string;
}

function summarizeChecks(checks: RemoteProbeCheck[]): RemoteProbeResult['summary'] {
  return checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.round(value)
    : fallback;
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--home':
        parsed.homeDir = next;
        index++;
        break;
      case '--endpoint':
        parsed.endpoint = next;
        index++;
        break;
      case '--api-key':
        parsed.apiKey = next;
        index++;
        break;
      case '--timeout-ms':
        parsed.timeoutMs = Number.parseInt(next || '', 10);
        index++;
        break;
      default:
        break;
    }
  }

  return parsed;
}

async function resolveWritableReportDir(homeDir: string): Promise<string> {
  const preferred = path.join(homeDir, 'uat-reports');
  try {
    await fs.ensureDir(preferred);
    return preferred;
  } catch {
    const fallback = path.join(
      os.tmpdir(),
      'wechat-cli-bridge-uat-reports',
      path.basename(homeDir) || 'default-home'
    );
    await fs.ensureDir(fallback);
    return fallback;
  }
}

function buildEndpointUrl(endpoint: string, pathname: string): string {
  const url = new URL(endpoint);
  const basePath = url.pathname.endsWith('/')
    ? url.pathname.slice(0, -1)
    : url.pathname === '/'
      ? ''
      : url.pathname;
  url.pathname = `${basePath}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function isPrivateIpv4(hostname: string): boolean {
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return false;
  }

  const parts = hostname.split('.').map(part => Number.parseInt(part, 10));
  if (parts.some(part => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) {
    return true;
  }

  if (parts[0] === 192 && parts[1] === 168) {
    return true;
  }

  return parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

function classifyEndpointScope(endpoint: string): RemoteProbeCheck {
  const url = new URL(endpoint);
  const { hostname } = url;

  if (isLoopbackHost(hostname)) {
    return {
      id: 'endpoint_scope',
      status: 'warn',
      summary: '当前 endpoint 仅验证本机回环或 SSH tunnel',
      detail: `Endpoint host=${hostname}；这能验证本机 port-forward，但不能证明公网直连已经可用。`,
    };
  }

  if (isPrivateIpv4(hostname)) {
    return {
      id: 'endpoint_scope',
      status: 'warn',
      summary: '当前 endpoint 指向私网地址',
      detail: `Endpoint host=${hostname}；这能验证内网访问，但不能直接作为公网 release-ready 证据。`,
    };
  }

  return {
    id: 'endpoint_scope',
    status: 'pass',
    summary: '当前 endpoint 不是 loopback/private 地址',
    detail: `Endpoint host=${hostname}`,
  };
}

function createNetworkFailureCheck(
  checkId: string,
  requestUrl: string,
  error: NodeJS.ErrnoException
): RemoteProbeCheck {
  const code = error.code || 'UNKNOWN';
  const message = error.message || String(error);
  const normalizedMessage = message.toLowerCase();

  if (code === 'ECONNREFUSED') {
    return {
      id: checkId,
      status: 'fail',
      summary: 'TCP 连接被拒绝',
      detail: `${requestUrl} -> ECONNREFUSED (${message})；常见原因是服务未监听、Docker 端口未映射，或主机未放行该端口。`,
    };
  }

  if (code === 'ETIMEDOUT') {
    return {
      id: checkId,
      status: 'fail',
      summary: '连接超时',
      detail: `${requestUrl} -> ETIMEDOUT；常见原因是安全组、防火墙或路由层直接丢弃了请求。`,
    };
  }

  if (
    code === 'ECONNRESET' ||
    normalizedMessage.includes('socket hang up') ||
    normalizedMessage.includes('econnreset')
  ) {
    return {
      id: checkId,
      status: 'fail',
      summary: '连接在返回 HTTP 响应前被重置',
      detail: `${requestUrl} -> ECONNRESET (${message})；这通常就是 curl 所说的 empty reply / socket hang up，需要检查反向代理、云端网络层或上游进程异常退出。`,
    };
  }

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return {
      id: checkId,
      status: 'fail',
      summary: '主机名解析失败',
      detail: `${requestUrl} -> ${code} (${message})；请先确认域名或 DNS 配置。`,
    };
  }

  return {
    id: checkId,
    status: 'fail',
    summary: '请求失败',
    detail: `${requestUrl} -> ${code} (${message})`,
  };
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function probeRequest(
  requestUrl: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs: number;
  }
): Promise<ProbeHttpResponse> {
  const parsedUrl = new URL(requestUrl);
  const transport = parsedUrl.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const request = transport.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: options.headers,
      },
      response => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const maxBytes = 2048;

        response.on('data', chunk => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          if (totalBytes >= maxBytes) {
            return;
          }

          const remaining = maxBytes - totalBytes;
          chunks.push(buffer.subarray(0, remaining));
          totalBytes += Math.min(buffer.length, remaining);
        });

        response.on('end', () => {
          resolve({
            statusCode: response.statusCode || 0,
            elapsedMs: Date.now() - startedAt,
            contentType:
              typeof response.headers['content-type'] === 'string'
                ? response.headers['content-type']
                : '',
            bodySnippet: Buffer.concat(chunks).toString('utf8').trim(),
          });
        });
      }
    );

    request.setTimeout(options.timeoutMs, () => {
      const timeoutError = new Error(
        `request timed out after ${options.timeoutMs}ms`
      ) as NodeJS.ErrnoException;
      timeoutError.code = 'ETIMEDOUT';
      request.destroy(timeoutError);
    });
    request.on('error', error => {
      reject(error);
    });
    request.end();
  });
}

function classifyHealthResponse(requestUrl: string, response: ProbeHttpResponse): RemoteProbeCheck {
  const detail = `${requestUrl} -> HTTP ${response.statusCode} in ${response.elapsedMs}ms${
    response.contentType ? `; content-type=${response.contentType}` : ''
  }${response.bodySnippet ? `; body=${truncateText(response.bodySnippet, 240)}` : ''}`;

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return {
      id: 'health',
      status: 'pass',
      summary: '远端 health check 返回成功响应',
      detail,
    };
  }

  if (response.statusCode === 401 || response.statusCode === 403) {
    return {
      id: 'health',
      status: 'fail',
      summary: 'health endpoint 意外要求鉴权',
      detail,
    };
  }

  return {
    id: 'health',
    status: 'fail',
    summary: `health endpoint 返回 HTTP ${response.statusCode}`,
    detail,
  };
}

function classifyApiResponse(
  requestUrl: string,
  response: ProbeHttpResponse,
  hasApiKey: boolean
): RemoteProbeCheck {
  const detail = `${requestUrl} -> HTTP ${response.statusCode} in ${response.elapsedMs}ms${
    response.contentType ? `; content-type=${response.contentType}` : ''
  }${response.bodySnippet ? `; body=${truncateText(response.bodySnippet, 240)}` : ''}`;

  if (response.statusCode === 404) {
    return {
      id: 'api_route',
      status: 'pass',
      summary: 'research API 路由可达，鉴权链路正常',
      detail,
    };
  }

  if (response.statusCode === 401 || response.statusCode === 403) {
    return {
      id: 'api_route',
      status: 'fail',
      summary: hasApiKey ? '提供的 API key 未通过鉴权' : 'research API 需要 Bearer token',
      detail,
    };
  }

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return {
      id: 'api_route',
      status: 'pass',
      summary: 'research API 路由返回成功响应',
      detail,
    };
  }

  return {
    id: 'api_route',
    status: 'warn',
    summary: `research API 路由返回 HTTP ${response.statusCode}`,
    detail,
  };
}

export async function runM005RemoteProbe(options: ParsedArgs = {}): Promise<RemoteProbeResult> {
  const homeDir = resolveBridgeHome(options.homeDir);
  const paths = getBridgePaths(homeDir);
  const timeoutMs = readPositiveInteger(options.timeoutMs, 5000);
  const configExists = await fs.pathExists(paths.configPath);
  const config = configExists ? await fs.readJson(paths.configPath) : {};
  const research = normalizeResearchExecutorConfig(
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>).research
      : createDefaultResearchExecutorConfig()
  );

  const endpoint = options.endpoint || research.executor.remoteHttp.endpoint;
  const apiKey = options.apiKey ?? research.executor.remoteHttp.apiKey;

  if (!endpoint) {
    throw new Error(
      'remote endpoint missing; pass `--endpoint` or configure `research.executor.remoteHttp.endpoint`'
    );
  }

  const checks: RemoteProbeCheck[] = [classifyEndpointScope(endpoint)];
  const healthUrl = buildEndpointUrl(endpoint, '/health');

  try {
    const healthResponse = await probeRequest(healthUrl, { timeoutMs });
    checks.push(classifyHealthResponse(healthUrl, healthResponse));
  } catch (error) {
    checks.push(
      createNetworkFailureCheck(
        'health',
        healthUrl,
        error instanceof Error ? (error as NodeJS.ErrnoException) : new Error(String(error))
      )
    );
  }

  const healthFailed = checks.some(check => check.id === 'health' && check.status === 'fail');
  const apiUrl = buildEndpointUrl(endpoint, '/research-runs/__m005_probe__');
  if (healthFailed) {
    checks.push({
      id: 'api_route',
      status: 'warn',
      summary: '跳过 research API 路由探测',
      detail: '由于 `/health` 未成功返回标准响应，当前先不继续发起受保护 API 探测。',
    });
  } else {
    try {
      const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;
      const apiResponse = await probeRequest(apiUrl, { headers, timeoutMs });
      checks.push(classifyApiResponse(apiUrl, apiResponse, Boolean(apiKey)));
    } catch (error) {
      checks.push(
        createNetworkFailureCheck(
          'api_route',
          apiUrl,
          error instanceof Error ? (error as NodeJS.ErrnoException) : new Error(String(error))
        )
      );
    }
  }

  const nextActions: string[] = [];
  if (checks.some(check => check.id === 'endpoint_scope' && check.status === 'warn')) {
    nextActions.push(
      '当前 endpoint 更像本机 tunnel / 内网地址；若要判断 M005 是否 release ready，请再对公网地址单独执行一次 probe。'
    );
  }
  if (checks.some(check => check.id === 'health' && check.summary.includes('TCP 连接被拒绝'))) {
    nextActions.push('在云端执行 `ss -ltnp | grep 8081`、`docker ps`、`docker logs wechat-research-remote-executor` 检查监听与映射。');
  }
  if (checks.some(check => check.id === 'health' && check.summary.includes('连接超时'))) {
    nextActions.push('检查腾讯云安全组、主机防火墙与上游网络策略，确认 `8081/tcp` 没有被静默丢弃。');
  }
  if (
    checks.some(
      check => check.id === 'health' && check.summary.includes('连接在返回 HTTP 响应前被重置')
    )
  ) {
    nextActions.push(
      '重点检查“公网入口 -> 容器”之间是否存在 reset：云厂商 4 层策略、反向代理、端口转发或上游进程异常退出。'
    );
    nextActions.push(
      '在服务器上分三层对比：`curl 127.0.0.1:8081/health`、`curl <server-private-ip>:8081/health`、从外部主机 `curl <public-endpoint>/health`。'
    );
  }
  if (
    checks.some(
      check => check.id === 'api_route' && check.summary === 'research API 需要 Bearer token'
    )
  ) {
    nextActions.push('为 probe 传入 `--api-key`，或确认 bridge 配置中的 `research.executor.remoteHttp.apiKey` 与服务端一致。');
  }
  if (
    checks.some(
      check => check.id === 'api_route' && check.summary === '提供的 API key 未通过鉴权'
    )
  ) {
    nextActions.push('确认 bridge 与 remote executor 使用的是同一个 Bearer token。');
  }
  if (nextActions.length === 0) {
    nextActions.push('当前 probe 未发现直接 blocker；下一步可以基于该 endpoint 继续做真实微信 research UAT 或 release-ready 判定。');
  }

  const reportDir = await resolveWritableReportDir(homeDir);
  const reportPath = path.join(reportDir, 'm005-remote-probe.md');
  const summary = summarizeChecks(checks);
  const report = [
    '# M005 Remote Probe',
    '',
    `- Home: ${homeDir}`,
    `- Endpoint: ${endpoint}`,
    `- TimeoutMs: ${timeoutMs}`,
    `- Pass: ${summary.pass}`,
    `- Warn: ${summary.warn}`,
    `- Fail: ${summary.fail}`,
    '',
    '## Checks',
    ...checks.flatMap(check => [
      `- [${check.status.toUpperCase()}] ${check.id}: ${check.summary}`,
      `  ${check.detail}`,
    ]),
    '',
    '## Next Actions',
    ...nextActions.map(item => `- ${item}`),
    '',
  ].join('\n');
  await fs.writeFile(reportPath, report, 'utf8');

  return {
    homeDir,
    endpoint,
    reportPath,
    checks,
    summary,
    nextActions,
  };
}

async function main(): Promise<void> {
  const result = await runM005RemoteProbe(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nReport: ${result.reportPath}`);
}

if (require.main === module) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[m005-remote-probe] failed: ${message}`);
    process.exit(1);
  });
}
