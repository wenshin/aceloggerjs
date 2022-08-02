import { Attributes, EventType, LogLevel, LoggerEvent } from '../api';

export interface InitParams {
  /**
   * the logger and span names split by comma to allow log.
   * if has a `*` will log all events.
   * example: `*`, `default,myspan`
   */
  include: string;
}

export function formatSection(evt: LoggerEvent): string {
  const attrs = evt.attributes || ({} as Attributes);
  let name = attrs.spanName ? '|' + attrs.spanName : '';
  if (evt.type === EventType.Tracing) {
    name = '|' + evt.name;
  } else if (evt.type === EventType.Event) {
    name += '|' + evt.name;
  }
  return `${attrs.logger || ''}${name}`;
}

export const LogLevelTitleMap = {
  [LogLevel.Debug]: 'DEBUG',
  [LogLevel.Info]: 'INFO',
  [LogLevel.Warn]: 'WARN',
  [LogLevel.Error]: 'ERROR',
};

/* tslint:disable: no-console */
export function adaptToJSConsole(
  evt: LoggerEvent,
  format: (evt: LoggerEvent) => unknown[]
): void {
  if (evt.level >= LogLevel.Error) {
    // 这里不使用 console.error() 是因为像 sentry
    // 等工具会拦截该方法，从而导致重复上报
    console.warn(...format(evt));
    return;
  }

  switch (evt.level) {
    case LogLevel.Debug:
      console.debug(...format(evt));
      break;
    case LogLevel.Info:
      console.info(...format(evt));
      break;
    case LogLevel.Warn:
      console.warn(...format(evt));
      break;
    default:
      console.info(...format(evt));
      break;
  }
}
/* tslint:enable */
