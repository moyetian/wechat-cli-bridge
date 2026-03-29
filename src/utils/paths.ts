import os from 'os';
import path from 'path';

export const BRIDGE_HOME_ENV = 'WECHAT_CLI_BRIDGE_HOME';
const DEFAULT_BRIDGE_DIRNAME = '.wechat-cli-bridge';

export interface BridgePaths {
  homeDir: string;
  configPath: string;
  accountsDir: string;
  sessionsDir: string;
  projectsDir: string;
  logsDir: string;
  attachmentsDir: string;
  pidFile: string;
  daemonLogFile: string;
}

function expandHomeDir(inputPath: string): string {
  if (inputPath === '~') {
    return os.homedir();
  }

  if (/^~[\\/]/.test(inputPath)) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

export function resolveBridgeHome(explicitHome?: string): string {
  const configuredHome =
    explicitHome ||
    process.env[BRIDGE_HOME_ENV] ||
    path.join(os.homedir(), DEFAULT_BRIDGE_DIRNAME);

  return path.resolve(expandHomeDir(configuredHome));
}

export function getBridgePaths(explicitHome?: string): BridgePaths {
  const homeDir = resolveBridgeHome(explicitHome);

  return {
    homeDir,
    configPath: path.join(homeDir, 'config.json'),
    accountsDir: path.join(homeDir, 'accounts'),
    sessionsDir: path.join(homeDir, 'sessions'),
    projectsDir: path.join(homeDir, 'projects'),
    logsDir: path.join(homeDir, 'logs'),
    attachmentsDir: path.join(homeDir, 'attachments'),
    pidFile: path.join(homeDir, 'bridge.pid'),
    daemonLogFile: path.join(homeDir, 'logs', 'daemon.log'),
  };
}
