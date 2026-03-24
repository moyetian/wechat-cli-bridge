import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';
import { Bridge } from './bridge/core';
import { BridgeConfig } from './types';
import { getDefaultAgents } from './agents';
import logger from './utils/logger';

// Load environment
dotenv.config();

const BRIDGE_DIR = path.join(os.homedir(), '.wechat-cli-bridge');
const ACCOUNTS_DIR = path.join(BRIDGE_DIR, 'accounts');

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

/**
 * Load or create configuration
 */
async function loadConfig(): Promise<BridgeConfig> {
  const configPath = path.join(BRIDGE_DIR, 'config.json');
  
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
    ilink: {
      pollInterval: 30000,
      timeout: 30000,
    },
  };

  await fs.ensureDir(BRIDGE_DIR);
  await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
  logger.info(`Created default config at ${configPath}`);

  return defaultConfig;
}

/**
 * Load the most recent account
 */
function loadLatestAccount(): (AccountData & LegacyAccountData) | null {
  try {
    const files = fs.readdirSync(ACCOUNTS_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) return null;

    let latestFile = files[0];
    let latestMtime = 0;

    for (const file of files) {
      const stat = fs.statSync(path.join(ACCOUNTS_DIR, file));
      if (stat.mtimeMs > latestMtime) {
        latestMtime = stat.mtimeMs;
        latestFile = file;
      }
    }

    return fs.readJsonSync(path.join(ACCOUNTS_DIR, latestFile));
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
  console.log('║     WeChat CLI Bridge v1.0.0          ║');
  console.log('║  Connect WeChat to CLI Agents         ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log();

  try {
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
main();
