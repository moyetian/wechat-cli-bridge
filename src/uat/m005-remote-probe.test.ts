import fs from 'fs-extra';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { RemoteResearchExecutorServer } from '../research/remote-http-server';
import { runM005RemoteProbe } from './m005-remote-probe';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-m005-remote-probe-test',
  Date.now().toString()
);

async function listenResetServer(): Promise<net.Server> {
  const server = net.createServer(socket => {
    socket.destroy();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

function getServerPort(server: http.Server | net.Server): number {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('server has no numeric port');
  }

  return address.port;
}

describe('runM005RemoteProbe', () => {
  let researchServer: RemoteResearchExecutorServer | undefined;
  let resetServer: net.Server | undefined;

  afterEach(async () => {
    if (researchServer) {
      await researchServer.stop();
      researchServer = undefined;
    }
    if (resetServer) {
      await new Promise<void>((resolve, reject) => {
        resetServer!.close(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      resetServer = undefined;
    }
    await fs.remove(TEST_DIR);
  });

  it('should validate a reachable endpoint and warn when it is loopback only', async () => {
    researchServer = new RemoteResearchExecutorServer({
      storageDir: path.join(TEST_DIR, 'reachable-server'),
      host: '127.0.0.1',
      port: 0,
      pollIntervalMs: 0,
      simulateDurationMs: 0,
    });
    const baseUrl = await researchServer.start();

    const result = await runM005RemoteProbe({
      homeDir: path.join(TEST_DIR, 'reachable-home'),
      endpoint: baseUrl,
    });

    expect(result.checks.find(item => item.id === 'endpoint_scope')?.status).toBe('warn');
    expect(result.checks.find(item => item.id === 'health')?.status).toBe('pass');
    expect(result.checks.find(item => item.id === 'api_route')?.status).toBe('pass');
    expect(await fs.pathExists(result.reportPath)).toBe(true);
  });

  it('should detect bearer auth mismatch on protected API routes', async () => {
    researchServer = new RemoteResearchExecutorServer({
      storageDir: path.join(TEST_DIR, 'secured-server'),
      host: '127.0.0.1',
      port: 0,
      pollIntervalMs: 0,
      simulateDurationMs: 0,
      apiKey: 'expected-token',
    });
    const baseUrl = await researchServer.start();

    const result = await runM005RemoteProbe({
      homeDir: path.join(TEST_DIR, 'secured-home'),
      endpoint: baseUrl,
      apiKey: 'wrong-token',
    });

    expect(result.checks.find(item => item.id === 'health')?.status).toBe('pass');
    expect(result.checks.find(item => item.id === 'api_route')?.status).toBe('fail');
    expect(result.checks.find(item => item.id === 'api_route')?.summary).toContain('API key');
  });

  it('should classify empty-reply style resets', async () => {
    resetServer = await listenResetServer();
    const endpoint = `http://127.0.0.1:${getServerPort(resetServer)}`;

    const result = await runM005RemoteProbe({
      homeDir: path.join(TEST_DIR, 'reset-home'),
      endpoint,
      timeoutMs: 1000,
    });

    expect(result.checks.find(item => item.id === 'health')?.status).toBe('fail');
    expect(result.checks.find(item => item.id === 'health')?.summary).toBe(
      '连接在返回 HTTP 响应前被重置'
    );
    expect(result.checks.find(item => item.id === 'health')?.detail).toContain('ECONNRESET');
    expect(result.checks.find(item => item.id === 'api_route')?.status).toBe('warn');
  });
});
