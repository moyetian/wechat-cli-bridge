# Changelog

## v1.5.0 - 2026-04-08

Release focus: `M005-v1.5-routed-knowledge-workflows` is now release ready.

Highlights:

- Added routed knowledge workflows across `general cli`, `writing`, and `research` lanes.
- Added governance artifacts, compute pool assignment, executor polling, and `/recover [jobId]`.
- Added local M005 UAT runners, environment doctor, and remote endpoint probe tooling.
- Added a deployable minimal `remote_http` executor plus Docker/systemd deployment assets.
- Closed the public research executor path via nginx `/research-executor/` reverse proxy.
- Tightened `m005-doctor` so `remote_http` only passes after real endpoint probing instead of merely checking config presence.
- Changed public deployment defaults to nginx-backed `/research-executor`, with `127.0.0.1:8081` kept as the server-local hop.
- Verified real article UAT, real research UAT, recovery UAT, and public `submit -> poll -> completed`.
- Raised the automated verification baseline to `190` passing tests.

Verification baseline:

```bash
npm run build
npm run lint
npm test -- --runInBand --ci
npm run uat:m005-doctor
npm run uat:m005-remote-probe -- --timeout-ms 4000
```
