import { Logger } from 'acelogger';

let initedErrors = false;
/**
 * performance.timeOrigin 毫秒 timestamp
 * performance.now() 从 timeOrigin 的毫秒值，精确到 ns
 * @param logger
 * @returns
 */
export function listenWebErrors(logger: Logger) {
  if (initedErrors) {
    return;
  }
  initedErrors = true;
  listenWebErrorsRepeat(logger);
}

export function listenWebErrorsRepeat(logger: Logger) {
  window.addEventListener('error', (evt) => {
    logger.error(`[${evt.type}]${evt.message}`, {
      data: {
        error: evt.error,
        filename: evt.filename,
        colno: evt.colno,
        lineno: evt.lineno,
      },
    });
  });
  window.addEventListener('unhandledrejection', (evt) => {
    logger.warn(`[${evt.type}]${evt.reason}`, {
      data: evt.reason,
    });
  });
}
