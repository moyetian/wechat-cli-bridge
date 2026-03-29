import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';
import { Bridge } from './bridge/core';
import { BridgeConfig } from './types';
import { getDefaultAgents } from './agents';
import {
  createDefaultMailChannelConfig,
  normalizeMailChannelConfig,
} from './mail';
import logger, { initLogger } from './utils/logger';
import { getBridgePaths } from './utils/paths';
import { initStorage } from './utils/storage';

// Load environment
dotenv.config();

const DEFAULT_MAX_IMAGE_SIZE_MB = 10;
const DEFAULT_MAX_FILE_SIZE_MB = 25;

/**
 * Account data structure (new format)
 */
interface AccountData {
  botToken: string;
  accountId: string;
  baseUrl: string;
  userId: string;
  createdAt: string;
}

/**
 * Legacy account data structure (old format)
 */
interface LegacyAccountData {
  botId?: string;
  token?: string;
  createdAt?: string;
}

function readPositiveNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/**
 * Load or create configuration
 */
async function loadConfig(): Promise<BridgeConfig> {
  const paths = getBridgePaths();
  const configPath = paths.configPath;
  
  if (await fs.pathExists(configPath)) {
    const config = await fs.readJson(configPath);
    return {
      defaultAgent: config.defaultAgent || 'iflow',
      workingDirectory: config.workingDirectory || process.cwd(),
      agents: { ...getDefaultAgents(), ...(config.agents || {}) },
      context: {
        maxHistory: config.context?.maxHistory || 50,
        summarizeThreshold: config.context?.summarizeThreshold || 20000,
        stateFile: true,
      },
      permission: {
        mode: config.permission?.mode || 'auto',
        timeout: config.permission?.timeout || 120,
      },
      media: {
        maxImageSizeMB: readPositiveNumber(
          config.media?.maxImageSizeMB,
          DEFAULT_MAX_IMAGE_SIZE_MB
        ),
        maxFileSizeMB: readPositiveNumber(
          config.media?.maxFileSizeMB,
          DEFAULT_MAX_FILE_SIZE_MB
        ),
      },
      mail: (() => {
        const normalized = normalizeMailChannelConfig(config.mail);
        return {
          enabled: normalized.enabled,
          provider: normalized.provider,
          ...(normalized.from ? { from: normalized.from.address } : {}),
          ...(normalized.replyTo ? { replyTo: normalized.replyTo.address } : {}),
          defaultTo: normalized.defaultTo.map(item => item.address),
          maxAttachmentSizeMB: normalized.maxAttachmentSizeMB,
          smtp: normalized.smtp,
        };
      })(),
      ilink: {
        pollInterval: 30000,
        timeout: 30000,
      },
    };
  }

  // Create default config
  const defaultConfig: BridgeConfig = {
    defaultAgent: 'iflow',
    workingDirectory: process.cwd(),
    agents: getDefaultAgents(),
    context: {
      maxHistory: 50,
      summarizeThreshold: 20000,
      stateFile: true,
    },
    permission: {
      mode: 'auto',
      timeout: 120,
    },
    media: {
      maxImageSizeMB: DEFAULT_MAX_IMAGE_SIZE_MB,
      maxFileSizeMB: DEFAULT_MAX_FILE_SIZE_MB,
    },
    mail: {
      enabled: createDefaultMailChannelConfig().enabled,
      provider: createDefaultMailChannelConfig().provider,
      defaultTo: createDefaultMailChannelConfig().defaultTo.map(item => item.address),
      maxAttachmentSizeMB: createDefaultMailChannelConfig().maxAttachmentSizeMB,
      smtp: createDefaultMailChannelConfig().smtp,
    },
    ilink: {
      pollInterval: 30000,
      timeout: 30000,
    },
  };

  await fs.ensureDir(paths.homeDir);
  await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
  logger.info(`Created default config at ${configPath}`);

  return defaultConfig;
}

/**
 * Load the most recent account
 */
function loadLatestAccount(): (AccountData & LegacyAccountData) | null {
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

/**
 * Get iLink credentials
 */
async function getCredentials(): Promise<{ token: string; accountId: string; baseUrl: string }> {
  // Try environment variables first
  const envToken = process.env.ILINK_BOT_TOKEN;
  const envAccountId = process.env.ILINK_ACCOUNT_ID;
  const envBaseUrl = process.env.ILINK_BASE_URL;

  if (envToken && envAccountId) {
    return {
      token: envToken,
      accountId: envAccountId,
      baseUrl: envBaseUrl || 'https://ilinkai.weixin.qq.com',
    };
  }

  // Try stored credentials
  const account = loadLatestAccount();
  
  if (account) {
    // Support both new and legacy formats
    const token = account.botToken || (account as LegacyAccountData).token || '';
    const accountId = account.accountId || (account as LegacyAccountData).botId || '';
    const baseUrl = account.baseUrl || 'https://ilinkai.weixin.qq.com';
    
    if (token && accountId) {
      return { token, accountId, baseUrl };
    }
  }

  throw new Error(
    'No iLink credentials found. Please run setup first:\n' +
    '  npm run setup\n' +
    'Or set ILINK_BOT_TOKEN and ILINK_ACCOUNT_ID environment variables.'
  );
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     WeChat CLI Bridge v1.4.0          ║');
  console.log('║  Connect WeChat to CLI Agents         ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log();

  try {
    const paths = getBridgePaths();
    initStorage(paths.homeDir);
    initLogger({ paths });

    // Load configuration
    const config = await loadConfig();
    logger.info('Configuration loaded');

    // Get credentials
    const credentials = await getCredentials();
    logger.info(`Credentials loaded for account: ${credentials.accountId}`);

    // Create and start bridge
    const bridge = new Bridge(config, credentials);

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      bridge.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      bridge.stop();
      process.exit(0);
    });

    // Start
    await bridge.start();

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Failed to start:', message);
    console.error('\n❌ Error:', message);
    process.exit(1);
  }
}

// Run
void main();
