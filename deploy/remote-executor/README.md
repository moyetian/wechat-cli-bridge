# Remote Research Executor Deployment

This directory contains minimal deployment artifacts for the `remote_http` research executor.

## What This Service Does

- Exposes `GET /health`
- Exposes `POST /research-runs`
- Exposes `GET /research-runs/:runId`
- Persists request / queue / status / result JSON files on disk
- Processes queued runs in a built-in worker loop

## Option 1: Docker

Build and run:

```bash
docker build -f deploy/remote-executor/Dockerfile -t wechat-research-remote-executor .
docker run -d \
  --name wechat-research-remote-executor \
  -p 127.0.0.1:8081:8081 \
  -e WECHAT_CLI_BRIDGE_REMOTE_EXECUTOR_API_KEY=replace-with-a-strong-token \
  -v /srv/wechat-cli-bridge/research-executor:/data/research-executor \
  wechat-research-remote-executor
```

Or use compose:

```bash
cd deploy/remote-executor
cp docker.env.example docker.env
# edit docker.env and set a real API key
docker compose up -d --build
```

## Option 1b: Nginx Reverse Proxy On Port 80

Use this when raw public `:8081` traffic is unreliable but your existing `nginx:80` entrypoint is healthy.

The repo includes `deploy/remote-executor/nginx.research-executor.conf.example`, which proxies:

- `/previews/` to the existing preview host directory
- `/research-executor/` to `http://127.0.0.1:8081/`

With that layout, the bridge endpoint becomes:

```json
{
  "research": {
    "enabled": true,
    "executor": {
      "backend": "remote_http",
      "remoteHttp": {
        "endpoint": "http://your-server/research-executor",
        "apiKey": "replace-with-the-same-token"
      }
    }
  }
}
```

Health check example:

```bash
curl http://your-server/research-executor/health
```

## Option 2: systemd

1. Build the project:

```bash
npm ci
npm run build
```

2. Copy files:

```bash
sudo mkdir -p /opt/wechat-cli-bridge/current
sudo rsync -a dist package.json package-lock.json /opt/wechat-cli-bridge/current/
sudo mkdir -p /etc/wechat-cli-bridge
sudo cp deploy/remote-executor/remote-executor.env.example /etc/wechat-cli-bridge/remote-executor.env
sudo cp deploy/remote-executor/wechat-research-remote-executor.service /etc/systemd/system/
```

3. Install production dependencies on the Linux server:

```bash
cd /opt/wechat-cli-bridge/current
sudo npm ci --omit=dev
```

4. Edit `/etc/wechat-cli-bridge/remote-executor.env` and set a real API key.

5. Create the service account and prepare writable storage:

```bash
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin wechat || true
sudo mkdir -p /var/lib/wechat-cli-bridge/research-executor
sudo chown -R wechat:wechat /var/lib/wechat-cli-bridge /opt/wechat-cli-bridge /etc/wechat-cli-bridge
```

6. Start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now wechat-research-remote-executor
sudo systemctl status wechat-research-remote-executor
```

## Health Check

```bash
curl http://127.0.0.1:8081/health
```

If bearer auth is enabled, use:

```bash
curl -H "Authorization: Bearer <api-key>" http://127.0.0.1:8081/research-runs/<runId>
```

To probe the same endpoint from the bridge host and classify timeout vs refused vs empty-reply failures:

```bash
npm run uat:m005-remote-probe -- --endpoint http://your-server/research-executor --api-key <api-key> --timeout-ms 4000
```

If you probe `127.0.0.1` or another private address, the script will warn that you only proved local or tunnel reachability, not public direct access.
For the recommended public path, prefer `http://your-server/research-executor`.

## Bridge Configuration

Your bridge host should point to the remote service with:

```json
{
  "research": {
    "enabled": true,
    "executor": {
      "backend": "remote_http",
      "remoteHttp": {
        "endpoint": "http://your-server/research-executor",
        "apiKey": "replace-with-the-same-token"
      }
    }
  }
}
```

The recommended public endpoint is `http://your-server/research-executor`. Keep raw `127.0.0.1:8081` as a server-local hop behind nginx.

## First Production-UAT Sequence

1. Start the remote executor service.
2. Confirm `/health` returns `200`.
3. Set bridge `research.enabled=true`.
4. Set bridge `research.executor.remoteHttp.endpoint`.
5. Submit a research request from WeChat.
6. Verify `queued -> running -> completed`.
7. Set a temporary fail pattern and verify `/recover`.
