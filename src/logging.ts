const LOG_PREFIX = '[jlab-todo]';

type ConsoleMethod = keyof Pick<
  Console,
  'debug' | 'log' | 'info' | 'warn' | 'error'
>;

const invokeLogger =
  (method: ConsoleMethod, fallback: ConsoleMethod = 'log') =>
  (...args: unknown[]): void => {
    const logger =
      (console[method] as ((...inner: unknown[]) => void) | undefined) ??
      console[fallback];
    logger.call(console, LOG_PREFIX, ...args);
  };

export const logDebug = invokeLogger('debug');
export const logInfo = invokeLogger('info');
export const logWarn = invokeLogger('warn');
export const logError = invokeLogger('error');

export { LOG_PREFIX };
