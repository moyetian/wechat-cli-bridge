import fs from 'fs-extra';
import os from 'os';
import path from 'path';

const TEST_HOME = path.join(os.tmpdir(), 'wechat-cli-bridge-bootstrap-test', Date.now().toString());

describe('runtime bootstrap', () => {
  afterEach(async () => {
    delete process.env.WECHAT_CLI_BRIDGE_HOME;
    jest.resetModules();
    await fs.remove(TEST_HOME);
  });

  it('should not create bridge home when importing logger module', () => {
    process.env.WECHAT_CLI_BRIDGE_HOME = TEST_HOME;
    jest.resetModules();

    require('./logger');

    expect(fs.pathExistsSync(TEST_HOME)).toBe(false);
  });

  it('should not create bridge home when importing storage module', () => {
    process.env.WECHAT_CLI_BRIDGE_HOME = TEST_HOME;
    jest.resetModules();

    require('./storage');

    expect(fs.pathExistsSync(TEST_HOME)).toBe(false);
  });

  it('should create logs directory only after logger initialization', () => {
    process.env.WECHAT_CLI_BRIDGE_HOME = TEST_HOME;
    jest.resetModules();

    const { initLogger, resetLoggerForTests } = require('./logger');
    const { getBridgePaths } = require('./paths');

    initLogger({ paths: getBridgePaths(TEST_HOME) });

    expect(fs.pathExistsSync(path.join(TEST_HOME, 'logs'))).toBe(true);

    resetLoggerForTests();
  });
});
