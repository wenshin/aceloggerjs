import { Logger, LoggerEventParams, StartSpanEventOptions } from 'acelogger';
import {
  SentryExporter,
  sentryIdCreator,
  FetchOptions,
  startPageloadLogger as startPageloadLoggerLib,
} from 'acelogger-exporter-sentry-core';
import { request } from './http';
import { collectPerformance } from './performance';

interface SentryConfig {
  key: string;
  projectId: string;
  host: string;
  pageURI?: string;
  userAgent?: string;
  fetch?: (options: FetchOptions) => Promise<unknown>;
}

export function createSentryExporter(conf: SentryConfig) {
  const defaultFetch = (options: FetchOptions) => {
    return request({
      url: options.url,
      method: options.method,
      headers: options.headers,
      data:
        typeof options.data === 'string'
          ? options.data
          : JSON.stringify(options.data),
    });
  };
  return new SentryExporter({
    key: conf.key,
    projectId: conf.projectId,
    host: conf.host,
    pageURI: conf.pageURI || window.location.href,
    userAgent: window.navigator.userAgent,
    fetch: conf.fetch || defaultFetch,
  });
}

export function startPageloadLogger(
  logger: Logger,
  sentryExporter: SentryExporter,
  options?: StartSpanEventOptions
) {
  const loadLogger = startPageloadLoggerLib(logger, sentryExporter, options);
  const oldFinish = loadLogger.finish.bind(loadLogger);
  loadLogger.finish = (params?: LoggerEventParams) => {
    collectPerformance(loadLogger.logger);
    oldFinish(params);
  };
  return loadLogger;
}

export {
  collectPerformance,
  listenWebPerformance,
  collectPerformanceRepeat,
} from './performance';

export { listenWebErrors, listenWebErrorsRepeat } from './errors';

export { sentryIdCreator, SentryExporter };
