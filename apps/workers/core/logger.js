export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
const LOG_LEVEL = process.env.LOG_LEVEL === 'DEBUG' ? LogLevel.DEBUG : LogLevel.INFO;
function formatMessage(level, message, context) {
    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${level}]`;
    if (context?.module) {
        logLine += ` [${context.module}]`;
    }
    if (context?.scanId) {
        logLine += ` [scan:${context.scanId}]`;
    }
    if (context?.domain) {
        logLine += ` [${context.domain}]`;
    }
    logLine += ` ${message}`;
    if (context?.duration !== undefined) {
        logLine += ` (${context.duration}ms)`;
    }
    return logLine;
}
export function log(message, context) {
    console.log(formatMessage('INFO', message, context));
}
export function debug(message, context) {
    if (LOG_LEVEL <= LogLevel.DEBUG) {
        console.log(formatMessage('DEBUG', message, context));
    }
}
export function info(message, context) {
    if (LOG_LEVEL <= LogLevel.INFO) {
        console.log(formatMessage('INFO', message, context));
    }
}
export function warn(message, context) {
    if (LOG_LEVEL <= LogLevel.WARN) {
        console.warn(formatMessage('WARN', message, context));
    }
}
export function error(message, context) {
    console.error(formatMessage('ERROR', message, context));
    if (context?.error) {
        console.error(context.error.stack || context.error.message);
    }
}
// Legacy support - keep old interface for gradual migration
export function logLegacy(...args) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}]`, ...args);
}
