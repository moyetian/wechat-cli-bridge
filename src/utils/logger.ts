import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import { BridgePaths, getBridgePaths } from './paths';

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

function createConsoleLogger(level: string): winston.Logger {
  return winston.createLogger({
    level,
    format: logFormat,
    transports: [
      new winston.transports.Console({
        format: consoleFormat,
      }),
    ],
  });
}

function createFileLogger(paths: BridgePaths, level: string): winston.Logger {
  return winston.createLogger({
    level,
    format: logFormat,
    transports: [
      new winston.transports.File({
        filename: path.join(paths.logsDir, 'bridge.log'),
        maxsize: 10 * 1024 * 1024,
        maxFiles: 30,
      }),
      new winston.transports.File({
        filename: path.join(paths.logsDir, 'error.log'),
        level: 'error',
        maxsize: 10 * 1024 * 1024,
        maxFiles: 10,
      }),
      new winston.transports.Console({
        format: consoleFormat,
      }),
    ],
  });
}

let loggerInstance: winston.Logger | undefined;

export function initLogger(options: { paths?: BridgePaths; level?: string } = {}): winston.Logger {
  const paths = options.paths || getBridgePaths();
  const level = options.level || process.env.LOG_LEVEL || 'info';

  try {
    fs.ensureDirSync(paths.logsDir);
    loggerInstance = createFileLogger(paths, level);
  } catch (error) {
    loggerInstance = createConsoleLogger(level);
    loggerInstance.warn(
      `File logging disabled: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return loggerInstance;
}

export function getLogger(): winston.Logger {
  if (!loggerInstance) {
    loggerInstance = createConsoleLogger(process.env.LOG_LEVEL || 'info');
  }

  return loggerInstance;
}

export function resetLoggerForTests(): void {
  loggerInstance = undefined;
}

export const logger = new Proxy({} as winston.Logger, {
  get(_target, property) {
    const activeLogger = getLogger();
    const value = Reflect.get(activeLogger, property);
    return typeof value === 'function' ? value.bind(activeLogger) : value;
  },
});

export default logger;
