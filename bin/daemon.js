#!/usr/bin/env node

const { spawn, fork } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BRIDGE_HOME_ENV = 'WECHAT_CLI_BRIDGE_HOME';

function resolveBridgeHome() {
  const configured = process.env[BRIDGE_HOME_ENV] || path.join(os.homedir(), '.wechat-cli-bridge');

  if (configured === '~') {
    return os.homedir();
  }

  if (configured.startsWith(`~${path.sep}`)) {
    return path.join(os.homedir(), configured.slice(2));
  }

  return path.resolve(configured);
}

const BRIDGE_DIR = resolveBridgeHome();
const PID_FILE = path.join(BRIDGE_DIR, 'bridge.pid');
const LOG_FILE = path.join(BRIDGE_DIR, 'logs', 'daemon.log');

const command = process.argv[2];

function getPlatform() {
  return process.platform;
}

function isRunning() {
  if (fs.existsSync(PID_FILE)) {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      fs.unlinkSync(PID_FILE);
      return false;
    }
  }
  return false;
}

function start() {
  if (isRunning()) {
    console.log('Bridge is already running');
    return;
  }

  console.log('Starting Bridge daemon...');

  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  
  const child = fork(path.join(__dirname, '../dist/index.js'), [], {
    detached: true,
    stdio: ['ignore', logStream, logStream],
  });

  child.unref();

  fs.writeFileSync(PID_FILE, child.pid.toString());
  
  console.log(`Bridge started (PID: ${child.pid})`);
  console.log(`Logs: ${LOG_FILE}`);
}

function stop() {
  if (!isRunning()) {
    console.log('Bridge is not running');
    return;
  }

  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());
  
  try {
    process.kill(pid, 'SIGTERM');
    console.log('Bridge stopped');
  } catch (err) {
    console.error('Failed to stop:', err.message);
  }
  
  fs.unlinkSync(PID_FILE);
}

function status() {
  if (isRunning()) {
    const pid = fs.readFileSync(PID_FILE, 'utf-8').trim();
    console.log(`Bridge is running (PID: ${pid})`);
  } else {
    console.log('Bridge is not running');
  }
}

function restart() {
  stop();
  setTimeout(start, 1000);
}

function logs() {
  const tail = spawn(process.platform === 'win32' ? 'powershell' : 'tail', 
    process.platform === 'win32' 
      ? ['-Command', `Get-Content ${LOG_FILE} -Tail 50 -Wait`]
      : ['-f', LOG_FILE],
    { stdio: 'inherit' }
  );
}

switch (command) {
  case 'start':
    start();
    break;
  case 'stop':
    stop();
    break;
  case 'status':
    status();
    break;
  case 'restart':
    restart();
    break;
  case 'logs':
    logs();
    break;
  default:
    console.log(`
Usage: node daemon.js <command>

Commands:
  start    Start the daemon
  stop     Stop the daemon
  status   Check daemon status
  restart  Restart the daemon
  logs     View daemon logs
`);
}
