import {
  ExporterEvents,
  Logger,
  LoggerEventExporter,
  LoggerEventParams,
  SpanStatusCode,
  StartSpanEventOptions,
} from 'acelogger';
import {
  FetchOptions,
  SentryConfig,
  flushSentry,
  sendSentryData,
  sentryIdCreator,
} from './sentry';

export { SentryConfig, FetchOptions };

export class SentryExporter implements LoggerEventExporter {
  constructor(public config: SentryConfig) {
    this.config = config;
  }
  shutdown() {
    return;
  }
  export(evts: ExporterEvents) {
    sendSentryData(evts, this.config);
  }
  flush() {
    flushSentry(this.config);
  }
}

export type LoadLoggerEventParams = Omit<LoggerEventParams, 'level' | 'stack'>;

export function startPageloadLogger(
  logger: Logger,
  sentryExporter: SentryExporter,
  options?: StartSpanEventOptions
) {
  const loadLogger = logger.startSpan('pageload', options);
  let isLoggedLoad = false;
  function finish(params?: LoadLoggerEventParams) {
    if (!isLoggedLoad) {
      isLoggedLoad = true;
      loadLogger.endSpan({
        metrics: {
          lcp: logger.manager.timer.now(),
        },
        ...params,
      });
    }
  }

  return {
    logger: loadLogger,
    finish,
    finishError(params?: LoadLoggerEventParams) {
      finish({
        ...params,
        status: SpanStatusCode.ERROR,
        message: params?.message || 'finish pageload span with errors',
      });
      // 上报所有没有执行 endSpan 的 sentry 数据
      logger.manager.flushSync();
      sentryExporter.flush();
    },
  };
}

export { sentryIdCreator };
