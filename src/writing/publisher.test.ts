import os from 'os';
import path from 'path';
import {
  buildArticlePreviewPublicUrl,
  resolvePreviewPublishConfig,
} from './publisher';

describe('preview publisher helpers', () => {
  it('should resolve publish config from environment variables', () => {
    const config = resolvePreviewPublishConfig({
      WECHAT_CLI_BRIDGE_PREVIEW_BASE_URL: 'http://119.91.50.158/previews/',
      WECHAT_CLI_BRIDGE_PREVIEW_SYNC_TARGET:
        'ubuntu@119.91.50.158:/var/www/wechat-previews',
      WECHAT_CLI_BRIDGE_PREVIEW_SYNC_KEY_PATH: '/mnt/e/mono.pem',
    });

    expect(config).toEqual({
      baseUrl: 'http://119.91.50.158/previews/',
      syncTarget: 'ubuntu@119.91.50.158:/var/www/wechat-previews',
      sshKeyPath: '/mnt/e/mono.pem',
      knownHostsPath: path.join(os.tmpdir(), 'wechat-cli-bridge-preview-known_hosts'),
    });
  });

  it('should build a stable public preview url from base url and job id', () => {
    expect(
      buildArticlePreviewPublicUrl(
        'http://119.91.50.158/previews/',
        'job-1234'
      )
    ).toBe('http://119.91.50.158/previews/job-1234/');
  });
});
