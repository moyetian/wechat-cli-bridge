import readline from 'readline';
import path from 'path';
import fs from 'fs-extra';
import { getBridgePaths } from './utils/paths';
import { createDefaultMailChannelConfig, normalizeMailChannelConfig } from './mail';
import {
  createDefaultResearchExecutorConfig,
  normalizeResearchExecutorConfig,
} from './research';

const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com';

// ── Login API Types ─────────────────────────────────────────────────────────

interface QrCodeResponse {
  ret: number;
  qrcode?: string;
  qrcode_img_content?: string;
}

interface QrStatusResponse {
  ret: number;
  status: string;
  retmsg?: string;
  bot_token?: string;
  ilink_bot_id?: string;
  baseurl?: string;
  ilink_user_id?: string;
}

interface AccountData {
  botToken: string;
  accountId: string;
  baseUrl: string;
  userId: string;
  createdAt: string;
}

// ── Helper Functions ────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// ── Login Functions ─────────────────────────────────────────────────────────

async function startQrLogin(): Promise<{ qrcodeUrl: string; qrcodeId: string }> {
  console.log('📱 正在获取二维码...');

  const res = await fetch(`${DEFAULT_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`);
  if (!res.ok) {
    throw new Error(`获取二维码失败: HTTP ${res.status}`);
  }

  const data = (await res.json()) as QrCodeResponse;

  if (data.ret !== 0 || !data.qrcode_img_content || !data.qrcode) {
    throw new Error(`获取二维码失败 (ret=${data.ret})`);
  }

  return {
    qrcodeUrl: data.qrcode_img_content,
    qrcodeId: data.qrcode,
  };
}

async function waitForQrScan(qrcodeId: string): Promise<AccountData> {
  const statusUrl = `${DEFAULT_BASE_URL}/ilink/bot/get_qrcode_status`;

  while (true) {
    const url = `${statusUrl}?qrcode=${encodeURIComponent(qrcodeId)}`;
    
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`检查二维码状态失败: HTTP ${res.status}`);
    }

    const data = (await res.json()) as QrStatusResponse;

    switch (data.status) {
      case 'wait':
        process.stdout.write('.');
        break;

      case 'scaned':
        console.log('\n✅ 已扫描，等待确认...');
        break;

      case 'confirmed': {
        if (!data.bot_token || !data.ilink_bot_id || !data.ilink_user_id) {
          throw new Error('二维码已确认但缺少必要字段');
        }

        return {
          botToken: data.bot_token,
          accountId: data.ilink_bot_id,
          baseUrl: data.baseurl || DEFAULT_BASE_URL,
          userId: data.ilink_user_id,
          createdAt: new Date().toISOString(),
        };
      }

      case 'expired':
        throw new Error('二维码已过期，请重新运行 setup');

      default:
        if (data.retmsg) {
          console.log(`\n⚠️ 状态: ${data.status} - ${data.retmsg}`);
        }
    }

    await sleep(3000);
  }
}

function saveAccount(data: AccountData): void {
  const paths = getBridgePaths();
  fs.ensureDirSync(paths.accountsDir);
  const filePath = path.join(paths.accountsDir, `${data.accountId}.json`);
  fs.writeJsonSync(filePath, data, { spaces: 2 });
  console.log(`✅ 账户已保存: ${data.accountId}`);
}

function loadLatestAccount(): AccountData | null {
  const paths = getBridgePaths();

  try {
    const files = fs.readdirSync(paths.accountsDir).filter(f => f.endsWith('.json'));
    if (files.length === 0) return null;

    let latestFile = files[0];
    let latestMtime = 0;

    for (const file of files) {
      const stat = fs.statSync(path.join(paths.accountsDir, file));
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestFile = file;
      }
    }

    return fs.readJsonSync(path.join(paths.accountsDir, latestFile));
  } catch {
    return null;
  }
}

async function loadExistingConfig(): Promise<Record<string, unknown>> {
  const paths = getBridgePaths();

  try {
    if (await fs.pathExists(paths.configPath)) {
      const loaded = await fs.readJson(paths.configPath);
      if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
        return loaded as Record<string, unknown>;
      }
    }
  } catch {
    // Fall back to defaults when the config is missing or unreadable.
  }

  return {};
}

// ── Setup Wizard ────────────────────────────────────────────────────────────

async function setup(): Promise<void> {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     WeChat CLI Bridge Setup           ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const existingConfig = await loadExistingConfig();

  // Step 1: Check for existing account or login
  console.log('📱 Step 1: 连接微信 ClawBot');
  console.log();

  let account = loadLatestAccount();

  if (account) {
    console.log(`发现已有账户: ${account.accountId}`);
    const useExisting = await question(rl, '使用现有账户？(y/n): ');
    
    if (useExisting.toLowerCase() !== 'y') {
      account = null;
    }
  }

  if (!account) {
    console.log('请使用微信扫描以下二维码登录:');
    console.log();

    try {
      const { qrcodeUrl, qrcodeId } = await startQrLogin();
      
      // Print QR code URL (or show as text QR if possible)
      console.log('二维码链接:', qrcodeUrl);
      console.log();
      console.log('请用微信扫描二维码，或复制链接到浏览器查看');
      console.log('等待扫描');

      account = await waitForQrScan(qrcodeId);
      
      saveAccount(account);
    } catch (error) {
      console.log();
      console.log('❌ 登录失败:', error instanceof Error ? error.message : String(error));
      rl.close();
      return;
    }
  }

  // Step 2: Configure working directory
  console.log();
  console.log('📁 Step 2: 配置工作目录');
  console.log();

  const defaultDir = process.cwd();
  const existingWorkingDir =
    typeof existingConfig.workingDirectory === 'string'
      ? existingConfig.workingDirectory
      : undefined;
  const initialDir = existingWorkingDir || defaultDir;
  const workingDir = await question(rl, `工作目录 (默认: ${initialDir}): `);
  const finalDir = workingDir.trim() || initialDir;

  if (!fs.pathExistsSync(finalDir)) {
    console.log(`❌ 目录不存在: ${finalDir}`);
    rl.close();
    return;
  }

  // Step 3: Configure default agent
  console.log();
  console.log('🤖 Step 3: 选择默认 Agent');
  console.log();
  console.log('可用的 Agent:');
  console.log('  1. iflow    - iFlow CLI');
  console.log('  2. claude   - Claude Code');
  console.log('  3. codex    - Codex CLI');
  console.log('  4. gemini   - Gemini CLI');
  console.log('  5. openclaw - OpenClaw (HTTP)');
  console.log();

  const existingDefaultAgent =
    typeof existingConfig.defaultAgent === 'string'
      ? existingConfig.defaultAgent
      : 'iflow';
  const reverseAgentMap: Record<string, string> = {
    iflow: '1',
    claude: '2',
    codex: '3',
    gemini: '4',
    openclaw: '5',
  };
  const defaultAgentChoice = reverseAgentMap[existingDefaultAgent] || '1';
  const agentChoice = await question(
    rl,
    `选择默认 Agent (1-5, 默认: ${defaultAgentChoice}): `
  );
  const agentMap: Record<string, string> = {
    '1': 'iflow',
    '2': 'claude',
    '3': 'codex',
    '4': 'gemini',
    '5': 'openclaw',
  };
  const defaultAgent =
    agentMap[agentChoice.trim() || defaultAgentChoice] || existingDefaultAgent;

  const existingContext =
    existingConfig.context &&
    typeof existingConfig.context === 'object' &&
    !Array.isArray(existingConfig.context)
      ? (existingConfig.context as Record<string, unknown>)
      : {};
  const existingPermission =
    existingConfig.permission &&
    typeof existingConfig.permission === 'object' &&
    !Array.isArray(existingConfig.permission)
      ? (existingConfig.permission as Record<string, unknown>)
      : {};
  const existingMedia =
    existingConfig.media &&
    typeof existingConfig.media === 'object' &&
    !Array.isArray(existingConfig.media)
      ? (existingConfig.media as Record<string, unknown>)
      : {};
  const existingMail = normalizeMailChannelConfig(existingConfig.mail);
  const defaultMail = createDefaultMailChannelConfig();
  const existingResearch = normalizeResearchExecutorConfig(existingConfig.research);
  const defaultResearch = createDefaultResearchExecutorConfig();

  // Save configuration
  const config = {
    defaultAgent,
    workingDirectory: finalDir,
    context: {
      maxHistory:
        typeof existingContext.maxHistory === 'number' ? existingContext.maxHistory : 50,
      summarizeThreshold:
        typeof existingContext.summarizeThreshold === 'number'
          ? existingContext.summarizeThreshold
          : 20000,
    },
    permission: {
      mode:
        typeof existingPermission.mode === 'string' ? existingPermission.mode : 'auto',
      timeout:
        typeof existingPermission.timeout === 'number'
          ? existingPermission.timeout
          : 120,
    },
    media: {
      maxImageSizeMB:
        typeof existingMedia.maxImageSizeMB === 'number'
          ? existingMedia.maxImageSizeMB
          : 10,
      maxFileSizeMB:
        typeof existingMedia.maxFileSizeMB === 'number'
          ? existingMedia.maxFileSizeMB
          : 25,
    },
    mail: {
      enabled: existingMail.enabled,
      provider: existingMail.provider,
      ...(existingMail.from ? { from: existingMail.from.address } : {}),
      ...(existingMail.replyTo ? { replyTo: existingMail.replyTo.address } : {}),
      defaultTo: existingMail.defaultTo.map(item => item.address),
      maxAttachmentSizeMB: existingMail.maxAttachmentSizeMB,
      smtp: {
        host: existingMail.smtp.host || defaultMail.smtp.host,
        port: existingMail.smtp.port || defaultMail.smtp.port,
        secure: existingMail.smtp.secure,
        user: existingMail.smtp.user || defaultMail.smtp.user,
        pass: existingMail.smtp.pass || defaultMail.smtp.pass,
      },
    },
    research: {
      enabled: existingResearch.enabled,
      executor: {
        backend: existingResearch.executor.backend,
        maxBudgetUSD: existingResearch.executor.maxBudgetUSD,
        maxRuntimeMinutes: existingResearch.executor.maxRuntimeMinutes,
        allowNetwork: existingResearch.executor.allowNetwork,
        remoteHttp: existingResearch.executor.remoteHttp,
        localGpu: {
          queueDir:
            existingResearch.executor.localGpu.queueDir ||
            defaultResearch.executor.localGpu.queueDir,
          statusDir:
            existingResearch.executor.localGpu.statusDir ||
            defaultResearch.executor.localGpu.statusDir,
          recoveryDir:
            existingResearch.executor.localGpu.recoveryDir ||
            defaultResearch.executor.localGpu.recoveryDir,
          pythonBin:
            existingResearch.executor.localGpu.pythonBin ||
            defaultResearch.executor.localGpu.pythonBin,
        },
      },
    },
  };

  const paths = getBridgePaths();
  await fs.ensureDir(paths.homeDir);
  await fs.writeJson(paths.configPath, config, { spaces: 2 });

  console.log();
  console.log('✅ 配置已保存');
  console.log();
  console.log('═══════════════════════════════════════');
  console.log('🎉 设置完成！');
  console.log();
  console.log('启动 Bridge:');
  console.log('  npm start');
  console.log('  或');
  console.log('  npx wechat-cli-bridge');
  console.log();
  console.log('发送 /help 到微信查看可用命令');
  console.log('═══════════════════════════════════════');

  rl.close();
}

// Run setup
setup().catch(error => {
  console.error('Setup failed:', error);
  process.exit(1);
});
