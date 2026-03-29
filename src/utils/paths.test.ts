import os from 'os';
import path from 'path';
import { BRIDGE_HOME_ENV, getBridgePaths, resolveBridgeHome } from './paths';

describe('paths', () => {
  afterEach(() => {
    delete process.env[BRIDGE_HOME_ENV];
  });

  it('should resolve default bridge home under user home', () => {
    delete process.env[BRIDGE_HOME_ENV];

    expect(resolveBridgeHome()).toBe(path.join(os.homedir(), '.wechat-cli-bridge'));
  });

  it('should respect environment override', () => {
    process.env[BRIDGE_HOME_ENV] = './tmp-bridge-home';

    expect(resolveBridgeHome()).toBe(path.resolve('./tmp-bridge-home'));
  });

  it('should expand tilde paths', () => {
    expect(resolveBridgeHome('~/custom-bridge-home')).toBe(
      path.join(os.homedir(), 'custom-bridge-home')
    );
  });

  it('should expose derived paths from bridge home', () => {
    const paths = getBridgePaths('/tmp/wcb-home');

    expect(paths.homeDir).toBe(path.resolve('/tmp/wcb-home'));
    expect(paths.configPath).toBe(path.resolve('/tmp/wcb-home/config.json'));
    expect(paths.logsDir).toBe(path.resolve('/tmp/wcb-home/logs'));
    expect(paths.attachmentsDir).toBe(path.resolve('/tmp/wcb-home/attachments'));
    expect(paths.pidFile).toBe(path.resolve('/tmp/wcb-home/bridge.pid'));
  });
});
