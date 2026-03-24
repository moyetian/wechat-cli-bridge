#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const script = args[0];

switch (script) {
  case 'start':
    require('../dist/index.js');
    break;
  
  case 'setup':
    require('../dist/setup.js');
    break;
  
  case 'help':
  case '--help':
  case '-h':
    console.log(`
WeChat CLI Bridge - Connect WeChat to CLI Agents

Usage:
  wechat-cli-bridge start    Start the bridge
  wechat-cli-bridge setup    Run setup wizard
  wechat-cli-bridge help     Show this help

Environment Variables:
  ILINK_BOT_ID    Bot ID from ClawBot
  ILINK_TOKEN     Token from ClawBot
  LOG_LEVEL       Log level (debug, info, warn, error)
`);
    break;
  
  default:
    if (!script) {
      // Default: start
      require('../dist/index.js');
    } else {
      console.error(`Unknown command: ${script}`);
      console.error('Run "wechat-cli-bridge help" for usage.');
      process.exit(1);
    }
}
