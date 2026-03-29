import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { ILinkClient } from './ilink-client';

const TEST_DIR = path.join(
  os.tmpdir(),
  'wechat-cli-bridge-ilink-media-test',
  Date.now().toString()
);

describe('ILinkClient media sending', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    await fs.ensureDir(TEST_DIR);
  });

  afterEach(async () => {
    global.fetch = originalFetch;
    await fs.remove(TEST_DIR);
  });

  function mockJsonResponse(json: unknown): Response {
    return {
      ok: true,
      status: 200,
      json: async () => json,
      text: async () => JSON.stringify(json),
      headers: new Headers(),
    } as Response;
  }

  function mockUploadResponse(downloadParam: string): Response {
    return {
      ok: true,
      status: 200,
      headers: new Headers({
        'x-encrypted-param': downloadParam,
      }),
      text: async () => '',
    } as Response;
  }

  it('should upload and send an image item', async () => {
    const imagePath = path.join(TEST_DIR, 'photo.png');
    await fs.writeFile(imagePath, 'image-content', 'utf8');

    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/ilink/bot/getuploadurl')) {
        return mockJsonResponse({ upload_param: 'upload-token' });
      }

      if (url.includes('/upload?encrypted_query_param=')) {
        return mockUploadResponse('download-token');
      }

      if (url.includes('/ilink/bot/sendmessage')) {
        return mockJsonResponse({});
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const client = new ILinkClient('token', 'account', 'https://ilinkai.weixin.qq.com');
    const result = await client.sendLocalMedia('user-1', imagePath, {
      bridgeHome: TEST_DIR,
      contextToken: 'ctx-1',
      text: 'caption',
      mode: 'image',
    });

    expect(result.success).toBe(true);
    expect(result.transportKind).toBe('image');
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const lastSendRequest = fetchMock.mock.calls[3] as unknown as [string, RequestInit];
    const parsedBody = JSON.parse(lastSendRequest[1].body as string);
    expect(parsedBody.msg.item_list[0].type).toBe(2);
    expect(parsedBody.msg.item_list[0].image_item.media.encrypt_query_param).toBe(
      'download-token'
    );
    expect(
      Buffer.from(parsedBody.msg.item_list[0].image_item.media.aes_key, 'base64')
        .toString('utf8')
    ).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should upload and send a file item', async () => {
    const filePath = path.join(TEST_DIR, 'report.pdf');
    await fs.writeFile(filePath, 'pdf-content', 'utf8');

    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/ilink/bot/getuploadurl')) {
        return mockJsonResponse({ upload_param: 'upload-token' });
      }

      if (url.includes('/upload?encrypted_query_param=')) {
        return mockUploadResponse('download-token');
      }

      if (url.includes('/ilink/bot/sendmessage')) {
        return mockJsonResponse({});
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const client = new ILinkClient('token', 'account', 'https://ilinkai.weixin.qq.com');
    const result = await client.sendLocalMedia('user-1', filePath, {
      bridgeHome: TEST_DIR,
      contextToken: 'ctx-1',
      mode: 'file',
    });

    expect(result.success).toBe(true);
    expect(result.transportKind).toBe('file');
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const lastSendRequest = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    const parsedBody = JSON.parse(lastSendRequest[1].body as string);
    expect(parsedBody.msg.item_list[0].type).toBe(4);
    expect(parsedBody.msg.item_list[0].file_item.file_name).toBe('report.pdf');
    expect(parsedBody.msg.item_list[0].file_item.media.encrypt_query_param).toBe(
      'download-token'
    );
    expect(
      Buffer.from(parsedBody.msg.item_list[0].file_item.media.aes_key, 'base64')
        .toString('utf8')
    ).toMatch(/^[0-9a-f]{32}$/);
  });

  it('should allow forcing an image path to be sent as a file attachment', async () => {
    const imagePath = path.join(TEST_DIR, 'photo.png');
    await fs.writeFile(imagePath, 'image-content', 'utf8');

    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/ilink/bot/getuploadurl')) {
        return mockJsonResponse({ upload_param: 'upload-token' });
      }

      if (url.includes('/upload?encrypted_query_param=')) {
        return mockUploadResponse('download-token');
      }

      if (url.includes('/ilink/bot/sendmessage')) {
        return mockJsonResponse({});
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const client = new ILinkClient('token', 'account', 'https://ilinkai.weixin.qq.com');
    const result = await client.sendLocalMedia('user-1', imagePath, {
      bridgeHome: TEST_DIR,
      contextToken: 'ctx-1',
      mode: 'file',
    });

    expect(result.success).toBe(true);
    expect(result.transportKind).toBe('file');

    const lastSendRequest = fetchMock.mock.calls[2] as unknown as [string, RequestInit];
    const parsedBody = JSON.parse(lastSendRequest[1].body as string);
    expect(parsedBody.msg.item_list[0].type).toBe(4);
    expect(parsedBody.msg.item_list[0].file_item.file_name).toBe('photo.png');
  });

  it('should return a typed error when image mode gets a non-image file', async () => {
    const filePath = path.join(TEST_DIR, 'report.pdf');
    await fs.writeFile(filePath, 'pdf-content', 'utf8');

    const client = new ILinkClient('token', 'account', 'https://ilinkai.weixin.qq.com');
    const result = await client.sendLocalMedia('user-1', filePath, {
      bridgeHome: TEST_DIR,
      mode: 'image',
    });

    expect(result.success).toBe(false);
    expect(result.code).toBe('UNSUPPORTED_IMAGE_TYPE');
  });

  it('should retry CDN upload on transient failures', async () => {
    const filePath = path.join(TEST_DIR, 'report.pdf');
    await fs.writeFile(filePath, 'pdf-content', 'utf8');

    let uploadAttempts = 0;
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/ilink/bot/getuploadurl')) {
        return mockJsonResponse({ upload_param: 'upload-token' });
      }

      if (url.includes('/upload?encrypted_query_param=')) {
        uploadAttempts++;
        if (uploadAttempts === 1) {
          throw new TypeError('fetch failed', {
            cause: new Error('temporary network issue'),
          });
        }

        return mockUploadResponse('download-token');
      }

      if (url.includes('/ilink/bot/sendmessage')) {
        return mockJsonResponse({});
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    global.fetch = fetchMock as typeof fetch;

    const client = new ILinkClient('token', 'account', 'https://ilinkai.weixin.qq.com');
    const result = await client.sendLocalMedia('user-1', filePath, {
      bridgeHome: TEST_DIR,
      contextToken: 'ctx-1',
      mode: 'file',
    });

    expect(result.success).toBe(true);
    expect(uploadAttempts).toBe(2);
  });
});
