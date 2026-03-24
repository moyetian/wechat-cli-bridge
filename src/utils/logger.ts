import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import os from 'os';

const BRIDGE_DIR = path.join(os.homedir(), '.wechat-cli-bridge');
const LOGS_DIR = path.join(BRIDGE_DIR, 'logs');

// Ensure logs directory exists
fs.ensureDirSync(LOGS_DIR);

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack }) => {
    const prefix = stack || message;
    return `${timestamp} [${level.toUpperCase()}] ${prefix}`;
  })
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}] ${message}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    // Daily rotating file
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'bridge.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 30,
    }),
    // Error only file
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 10,
    }),
    // Console
    new winston.transports.Console({
      format: consoleFormat,
    }),
  ],
});

export default logger;
