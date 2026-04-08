import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { getDefaultAgents } from '../agents';
import {
  createDefaultResearchExecutorConfig,
  normalizeResearchExecutorConfig,
} from '../research';
import {
  getDefaultWeWritePathCandidates,
  resolveWeWritePath,
} from '../writing/wewrite-adapter';
import { WEWRITE_MOCK_MODE_ENV } from '../writing';
import { getBridgePaths, resolveBridgeHome } from '../utils/paths';

export type DoctorStatus = 'pass' | 'warn' | 'fail';

export interface DoctorCheck {
  id: string;
  status: DoctorStatus;
  summary: string;
  detail: string;
}

export interface M005DoctorResult {
  homeDir: string;
  reportPath: string;
  checks: DoctorCheck[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  nextActions: string[];
}

interface RemoteResearchEndpointCheckResult {
  status: DoctorStatus;
  detail: string;
  nextAction?: string;
}

const REMOTE_RESEARCH_ENDPOINT_TIMEOUT_MS = 4000;

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

function summarizeChecks(checks: DoctorCheck[]): M005DoctorResult['summary'] {
  return checks.reduce(
    (acc, check) => {
      acc[check.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 }
  );
}

function parseArgs(argv: string[]): { homeDir?: string } {
  const parsed: { homeDir?: string } = {};

  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    const next = argv[index + 1];
    if (token === '--home') {
      parsed.homeDir = next;
      index++;
    }
  }

  return parsed;
}

function normalizeFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function buildRemoteEndpointUrl(endpoint: string, pathname: string): string {
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

async function readResponseSnippet(response: Response): Promise<string> {
  const text = (await response.text().catch(() => '')).trim();
  return text.length <= 200 ? text : `${text.slice(0, 200)}...`;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = REMOTE_RESEARCH_ENDPOINT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkRemoteResearchEndpoint(options: {
  endpoint: string;
  apiKey?: string;
}): Promise<RemoteResearchEndpointCheckResult> {
  const healthUrl = buildRemoteEndpointUrl(options.endpoint, '/health');

  try {
    const healthResponse = await fetchWithTimeout(healthUrl);
    const healthSnippet = await readResponseSnippet(healthResponse);
    if (!healthResponse.ok) {
      return {
        status: 'fail',
        detail: `remote_http health failed: HTTP ${healthResponse.status} @ ${healthUrl}${healthSnippet ? `; body=${healthSnippet}` : ''}`,
        nextAction:
          '运行 `npm run uat:m005-remote-probe -- --timeout-ms 4000`，确认公网 health 与 research API 路由是否都可达。',
      };
    }

    const apiUrl = buildRemoteEndpointUrl(options.endpoint, '/research-runs/__m005_doctor__');
    const apiHeaders = options.apiKey
      ? {
          Authorization: `Bearer ${options.apiKey}`,
        }
      : undefined;
    const apiResponse = await fetchWithTimeout(apiUrl, {
      headers: apiHeaders,
    });
    const apiSnippet = await readResponseSnippet(apiResponse);

    if (apiResponse.status === 404 || apiResponse.ok) {
      return {
        status: 'pass',
        detail: `remote_http endpoint reachable: health=${healthResponse.status}, api=${apiResponse.status}, endpoint=${options.endpoint}`,
      };
    }

    if (apiResponse.status === 401 || apiResponse.status === 403) {
      return {
        status: 'fail',
        detail: `remote_http auth failed: HTTP ${apiResponse.status} @ ${apiUrl}${apiSnippet ? `; body=${apiSnippet}` : ''}`,
        nextAction:
          '确认 `research.executor.remoteHttp.apiKey` 与服务端 Bearer token 一致，然后重新运行 `npm run uat:m005-remote-probe`。',
      };
    }

    return {
      status: 'fail',
      detail: `remote_http route probe failed: HTTP ${apiResponse.status} @ ${apiUrl}${apiSnippet ? `; body=${apiSnippet}` : ''}`,
      nextAction:
        '运行 `npm run uat:m005-remote-probe -- --timeout-ms 4000`，确认 research API 路由与反向代理配置。',
    };
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `timed out after ${REMOTE_RESEARCH_ENDPOINT_TIMEOUT_MS}ms`
        : error instanceof Error
          ? error.message
          : String(error);
    return {
      status: 'fail',
      detail: `remote_http endpoint unreachable: ${message} @ ${options.endpoint}`,
      nextAction:
        '运行 `npm run uat:m005-remote-probe -- --timeout-ms 4000`，确认公网 endpoint、health 与 research API 路由是否都可达。',
    };
  }
}

async function commandExists(command: string): Promise<boolean> {
  const delimiter = os.platform() === 'win32' ? ';' : ':';
  const envPath = process.env.PATH || '';
  const pathEntries = envPath.split(delimiter).filter(Boolean);
  const extensions =
    os.platform() === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
          .split(';')
          .filter(Boolean)
      : [''];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, `${command}${extension}`);
      if (await fs.pathExists(candidate)) {
        return true;
      }
    }
  }

  return false;
}

export async function runM005Doctor(options: {
  homeDir?: string;
} = {}): Promise<M005DoctorResult> {
  const homeDir = resolveBridgeHome(options.homeDir);
  const paths = getBridgePaths(homeDir);
  const checks: DoctorCheck[] = [];

  const configExists = await fs.pathExists(paths.configPath);
  const config = configExists ? await fs.readJson(paths.configPath) : {};
  const mergedAgents = {
    ...getDefaultAgents(),
    ...(config && typeof config === 'object' && !Array.isArray(config)
      ? ((config as Record<string, unknown>).agents as Record<string, unknown>) || {}
      : {}),
  } as Record<string, { type?: string; command?: string; endpoint?: string }>;
  const defaultAgent =
    config && typeof config === 'object' && !Array.isArray(config)
      ? ((config as Record<string, unknown>).defaultAgent as string) || 'iflow'
      : 'iflow';
  const research = normalizeResearchExecutorConfig(
    config && typeof config === 'object' && !Array.isArray(config)
      ? (config as Record<string, unknown>).research
      : createDefaultResearchExecutorConfig()
  );

  checks.push({
    id: 'config',
    status: configExists ? 'pass' : 'fail',
    summary: configExists ? '检测到 bridge 配置文件' : '未检测到 bridge 配置文件',
    detail: configExists
      ? `Config: ${paths.configPath}`
      : `请先运行 setup 或准备 config.json：${paths.configPath}`,
  });

  const hasEnvCredentials = Boolean(
    process.env.ILINK_BOT_TOKEN && process.env.ILINK_ACCOUNT_ID
  );
  const hasStoredAccount =
    (await fs.pathExists(paths.accountsDir)) &&
    (await fs.readdir(paths.accountsDir).catch(() => [])).some(name =>
      name.endsWith('.json')
    );
  checks.push({
    id: 'ilink_credentials',
    status: hasEnvCredentials || hasStoredAccount ? 'pass' : 'fail',
    summary:
      hasEnvCredentials || hasStoredAccount
        ? '检测到 iLink 凭据'
        : '未检测到 iLink 凭据',
    detail: hasEnvCredentials
      ? '来自环境变量 `ILINK_BOT_TOKEN` / `ILINK_ACCOUNT_ID`'
      : hasStoredAccount
        ? `来自账号目录：${paths.accountsDir}`
        : '请先运行 `npm run setup` 或配置环境变量。',
  });

  const defaultAgentConfig = mergedAgents[defaultAgent];
  let defaultAgentReady = false;
  let defaultAgentDetail = `未找到默认 agent 配置：${defaultAgent}`;
  if (defaultAgentConfig) {
    if (defaultAgentConfig.type === 'cli' && defaultAgentConfig.command) {
      defaultAgentReady = await commandExists(defaultAgentConfig.command);
      defaultAgentDetail = defaultAgentReady
        ? `已检测到 CLI 命令：${defaultAgentConfig.command}`
        : `PATH 中未找到默认 agent 命令：${defaultAgentConfig.command}`;
    } else if (defaultAgentConfig.type === 'http') {
      defaultAgentReady = Boolean(defaultAgentConfig.endpoint);
      defaultAgentDetail = defaultAgentReady
        ? `默认 HTTP agent endpoint: ${defaultAgentConfig.endpoint}`
        : '默认 HTTP agent 未配置 endpoint';
    }
  }
  checks.push({
    id: 'default_agent',
    status: defaultAgentReady ? 'pass' : 'warn',
    summary: defaultAgentReady
      ? `默认 agent ${defaultAgent} 可用`
      : `默认 agent ${defaultAgent} 尚未确认可用`,
    detail: defaultAgentDetail,
  });

  const realWeWritePath = await resolveWeWritePath(getDefaultWeWritePathCandidates());
  const writingAgents = ['claude', 'openclaw', 'codex'];
  const availableWritingAgents: string[] = [];
  for (const agentName of writingAgents) {
    const agentConfig = mergedAgents[agentName];
    if (!agentConfig) {
      continue;
    }

    if (agentConfig.type === 'cli' && agentConfig.command) {
      if (await commandExists(agentConfig.command)) {
        availableWritingAgents.push(agentName);
      }
      continue;
    }

    if (agentConfig.type === 'http' && agentConfig.endpoint) {
      availableWritingAgents.push(agentName);
    }
  }

  const writingMockMode = normalizeFlag(process.env[WEWRITE_MOCK_MODE_ENV]);
  const writingStatus: DoctorStatus =
    realWeWritePath && availableWritingAgents.length > 0
      ? 'pass'
      : writingMockMode
        ? 'warn'
        : 'fail';
  checks.push({
    id: 'writing_lane',
    status: writingStatus,
    summary:
      writingStatus === 'pass'
        ? 'writing lane 具备真实运行条件'
        : writingStatus === 'warn'
          ? 'writing lane 当前依赖 mock mode'
          : 'writing lane 缺少真实运行条件',
    detail:
      writingStatus === 'pass'
        ? `WeWrite: ${realWeWritePath}; writing agents: ${availableWritingAgents.join(', ')}`
        : writingMockMode
          ? `已启用 ${WEWRITE_MOCK_MODE_ENV}；真实 WeWrite=${realWeWritePath || '(missing)'}, agents=${availableWritingAgents.join(', ') || '(missing)'}`
          : `WeWrite path missing; 可用 writing agent=${availableWritingAgents.join(', ') || '(none)'}`,
  });

  const queueDir = research.executor.localGpu.queueDir;
  const statusDir = research.executor.localGpu.statusDir;
  let localResearchWritable = true;
  try {
    await fs.ensureDir(queueDir);
    await fs.ensureDir(statusDir);
  } catch {
    localResearchWritable = false;
  }

  const remoteResearchCheck =
    research.enabled &&
    research.executor.backend === 'remote_http' &&
    research.executor.remoteHttp.endpoint
      ? await checkRemoteResearchEndpoint({
          endpoint: research.executor.remoteHttp.endpoint,
          apiKey: research.executor.remoteHttp.apiKey,
        })
      : null;

  const researchEnabled = research.enabled;
  const researchStatus: DoctorStatus =
    !researchEnabled
      ? 'warn'
      : research.executor.backend === 'remote_http'
      ? research.executor.remoteHttp.endpoint
        ? remoteResearchCheck?.status || 'fail'
        : localResearchWritable
          ? 'warn'
          : 'fail'
      : localResearchWritable
        ? 'pass'
        : 'fail';
  checks.push({
    id: 'research_lane',
    status: researchStatus,
    summary:
      researchStatus === 'pass'
        ? 'research lane 已具备当前配置所需运行条件'
        : !researchEnabled
          ? 'research lane 执行器已配置，但当前仍处于 disabled 状态'
        : researchStatus === 'warn'
          ? 'research lane 当前可用 mock/local UAT，但真实远端未配置'
          : 'research lane 当前缺少运行条件',
    detail:
      !researchEnabled
        ? research.executor.backend === 'remote_http'
          ? research.executor.remoteHttp.endpoint
            ? `research.enabled=false; remote_http endpoint: ${research.executor.remoteHttp.endpoint}`
            : 'research.enabled=false; remote_http endpoint missing'
          : `research.enabled=false; local_gpu queueDir=${queueDir}; statusDir=${statusDir}; writable=${localResearchWritable}`
        : research.executor.backend === 'remote_http'
        ? research.executor.remoteHttp.endpoint
          ? remoteResearchCheck?.detail ||
            `remote_http endpoint: ${research.executor.remoteHttp.endpoint}`
          : `remote_http endpoint missing; local queue/status 可写=${localResearchWritable}`
        : `local_gpu queueDir=${queueDir}; statusDir=${statusDir}; writable=${localResearchWritable}`,
  });

  checks.push({
    id: 'local_uat_runner',
    status: 'pass',
    summary: '本地 M005 UAT runner 可用',
    detail: '可运行 `npm run uat:m005-local` 与 `npm run uat:m005-bridge`',
  });

  const nextActions: string[] = [];
  if (!configExists) {
    nextActions.push('运行 `npm run setup` 或准备 bridge `config.json`。');
  }
  if (!hasEnvCredentials && !hasStoredAccount) {
    nextActions.push('补齐 iLink 凭据，供真实 bridge UAT 使用。');
  }
  if (!(realWeWritePath && availableWritingAgents.length > 0)) {
    nextActions.push(
      `安装真实 WeWrite skill 或设置 \`WEWRITE_SKILL_PATH\`；若先做本地 UAT，可启用 \`${WEWRITE_MOCK_MODE_ENV}=true\`。`
    );
  }
  if (!researchEnabled) {
    nextActions.push('若要验证真实 research lane，请将 `research.enabled` 设为 `true`。');
  }
  if (!research.executor.remoteHttp.endpoint && research.executor.backend === 'remote_http') {
    nextActions.push('若要验证 remote research executor，请配置 `research.executor.remoteHttp.endpoint`。');
  }
  if (remoteResearchCheck?.nextAction) {
    nextActions.push(remoteResearchCheck.nextAction);
  }
  if (!localResearchWritable) {
    nextActions.push('修复 local research queue/status 目录权限或配置路径。');
  }
  if (nextActions.length === 0) {
    nextActions.push('环境已基本就绪，优先运行 `npm run uat:m005-bridge` 进行 bridge 等价 UAT。');
  }

  const reportDir = await resolveWritableReportDir(homeDir);
  const reportPath = path.join(reportDir, 'm005-doctor.md');
  const summary = summarizeChecks(checks);
  const report = [
    '# M005 Doctor',
    '',
    `- Home: ${homeDir}`,
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
    reportPath,
    checks,
    summary,
    nextActions,
  };
}

async function main(): Promise<void> {
  const result = await runM005Doctor(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nReport: ${result.reportPath}`);
}

if (require.main === module) {
  main().catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[m005-doctor] failed: ${message}`);
    process.exit(1);
  });
}
