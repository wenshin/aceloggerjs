import {
  Attributes,
  SpanStatusCode,
  EventType,
  ExporterEvents,
  getMillisecondsTime,
  getSpanEventName,
  LoggerAttributes,
  LoggerEvent,
  LogLevel,
  ManagerAttributes,
  mapExporterEvents,
  ROOT_SPAN_NAME,
} from 'acelogger';

/**
 * 踩坑
 * 1. eventID 的前八位相同会合并
 * 2. spanID 和 traceID 格式必须和 sentry 保持一致，spanID 16 位 16 进制，traceID 32 位 16 进制
 * 3. startTime 比 endTime 大，导致失败
 * 4. measurements 中 mark.metric 只支持 web vitals 指标
 */
const spanMap = new Map<string, TransactionPayload>();
const breadcrumbs: TransactionPayload['breadcrumbs'] = [];

export type EventFormatter<T> = (
  evt: LoggerEvent,
  loggerAttrs: LoggerAttributes,
  globalAttrs: ManagerAttributes
) => T;

export interface FetchOptions {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  data: Record<string, unknown> | string;
}

export interface SentryConfig {
  key: string;
  projectId: string;
  // domain and protocol, https://www.sentry.com
  host: string;
  pageURI: string;
  userAgent: string;
  fetch(options: FetchOptions): Promise<unknown>;
}

function getSentryUrl(conf: SentryConfig, type: 'error' | 'transition') {
  const path = type === 'error' ? 'store' : 'envelope';
  return `${conf.host}/api/${conf.projectId}/${path}/?sentry_key=${conf.key}&sentry_version=7`;
}

export function sendSentryData(evts: ExporterEvents, conf: SentryConfig) {
  if (!evts.events.length) return;
  cacheTransactionData(evts, conf, (evt, loggerAttrs, globalAttrs) => {
    if (
      evt.name === getSpanEventName(loggerAttrs.spanName, 'start') &&
      evt.exportable
    ) {
      const payload = spanMap.get(evt.spanId);
      if (payload) {
        sendTransaction(payload, conf);
      }
    }
    if (evt.name === getSpanEventName(loggerAttrs.spanName, 'end')) {
      const payload = spanMap.get(evt.spanId);
      if (payload) {
        sendTransaction(payload, conf);
        spanMap.delete(evt.spanId);
      }
    }
    // 上报错误
    if (evt.level >= LogLevel.Warn) {
      const data = getSentryExceptionData(evt, loggerAttrs, globalAttrs, conf);
      conf
        .fetch({
          url: getSentryUrl(conf, 'error'),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data,
        })
        .catch((err) => {
          console.error(err);
        });
    }
  });
}

function sendTransaction(payload: TransactionPayload, conf: SentryConfig) {
  conf
    .fetch({
      url: getSentryUrl(conf, 'transition'),
      method: 'POST',
      headers: {
        'content-type': 'text/plain; charset=utf-8',
      },
      data: `{"event_id":"${
        payload.event_id
      }","sent_at":"${new Date().toISOString()}","sdk":{"name":"${
        payload.sdk.name
      }","version":"${payload.sdk.version}"}}
{"type":"transaction","sample_rates":[{"id":"client_rate","rate":1}]}
${JSON.stringify(payload)}`,
    })
    .catch((err) => {
      console.error(err);
    });
}

interface TransactionSpan {
  description: string;
  op: string;
  parent_span_id: string;
  span_id: string;
  start_timestamp: number;
  timestamp: number;
  trace_id: string;
}

interface Tags {
  effectiveConnectionType: string;
  connectionType: string;
  deviceMemory: string;
  hardwareConcurrency: string;
  [key: string]: string | number;
}

interface Sdk {
  integrations: string[];
  name: string;
  version: string;
  packages: {
    name: string;
    version: string;
  }[];
}

interface Breadcrumb {
  timestamp: number;
  category: string;
  data: {
    arguments: any[];
    logger: string;
  };
  level: string;
  message: string;
}

interface TransactionPayload {
  type: 'transaction';
  platform: 'javascript';
  event_id: string;
  environment: string;
  sdk: Sdk;
  request: {
    url: string;
    headers: { [key: string]: string };
  };

  /**
   * Transaction Data
   */
  transaction: string;
  contexts: {
    trace: {
      op: string;
      span_id: string;
      tags: Tags;
      trace_id: string;
      status?: string;
    };
  };
  /**
   * 单位秒
   */
  start_timestamp: number;
  /**
   * 单位秒
   */
  timestamp: number;
  measurements: { [key: string]: { value: number | string } };
  spans: TransactionSpan[];
  tags: Tags;
  breadcrumbs: Breadcrumb[];

  /**
   * 临时存储子 span，数据不上报
   */
  childSpans?: TransactionPayload[];
}

/**
 * acelogger 的一个 span 对应一个 TransacctionPayload，什么时机上报缓存的 span 数据是个问题
 * 1. span.start event:
 *    1.1 cache as parent child spans and breadcrumbs,
 *    1.2 change to sentry span, startTime is event.userStartTime or event.time
 *    1.3 sent to service immediately
 * 2. span custom events:
 *    2.1 cache as parent child spans
 *    2.2 cache to breadcrumbs,
 * 3. span logs:
 *    3.1 cache to breadcrumbs
 *    3.2 if level > warn, send to service as exception immediately
 * 4. span metrics or storeMetrics:
 *    4.1 cache to breadcrumbs
 *    4.2 cache as span measurements
 * 5. span.end event:
 *    5.1 merge child spans
 *    5.2 attach span measurements
 *    5.3 change to sentry span and sent to service immediately
 * @param evts
 */
function cacheTransactionData(
  evts: ExporterEvents,
  conf: SentryConfig,
  cb?: EventFormatter<void>
) {
  mapExporterEvents(evts, (evt, loggerAttrs, globalAttrs) => {
    const isRootSpan = loggerAttrs.spanName === ROOT_SPAN_NAME;
    if (!isRootSpan) {
      let payload = spanMap.get(evt.spanId);
      if (!payload) {
        payload = {
          type: 'transaction',
          platform: 'javascript',
          event_id: createSentryEventId(),
          environment: globalAttrs.env,
          sdk: getSentrySDK(),
          request: getSentryRequest(conf),
          transaction: evt.name,
          contexts: {
            trace: {
              op: loggerAttrs.spanName,
              span_id: evt.spanId,
              trace_id: evt.traceId,
              tags: getSentryTags({}),
              status: 'unavailable',
            },
          },
          start_timestamp: getSecondsTime(evt.data.userStartTime || evt.time),
          timestamp: getSecondsTime(evt.time),
          measurements: {},
          spans: [],
          breadcrumbs,
          tags: getSentryTags({
            ...globalAttrs,
            ...loggerAttrs,
            ...evt.attributes,
          }),
        };
        spanMap.set(evt.spanId, payload);
      }

      updatePayloadMeasurements(payload, evt);

      if (evt.type === EventType.Event || evt.type === EventType.Tracing) {
        const sentrySpan = getSentrySpanFromEvent(payload, evt);
        payload.spans.push(sentrySpan);
        const parent = getParentSpanPayload(evt);
        if (parent) {
          parent.spans.push(sentrySpan);
        }
      }

      if (evt.name === getSpanEventName(loggerAttrs.spanName, 'end')) {
        payload.event_id = createSentryEventId();
        payload.transaction = (loggerAttrs.url as string) || evt.name;
        payload.timestamp = getSecondsTime(evt.time);
        payload.contexts.trace.status =
          evt.status === SpanStatusCode.OK ? 'ok' : 'internal_error';
      }
    }
    breadcrumbs.push(
      getBreadcrumb(loggerAttrs.spanName, evt, loggerAttrs, globalAttrs)
    );
    // 最多 50 条最新的信息
    if (breadcrumbs.length > 50) {
      breadcrumbs.shift();
    }
    cb && cb(evt, loggerAttrs, globalAttrs);
  });
}

function getParentSpanPayload(evt: LoggerEvent) {
  if (evt.parentSpanId) {
    return spanMap.get(evt.parentSpanId);
  }
  return null;
}

function getSentryExceptionData(
  evt: LoggerEvent,
  loggerAttrs: LoggerAttributes,
  globalAttrs: ManagerAttributes,
  conf: SentryConfig
) {
  const userId = globalAttrs.userId || '';

  const frames: {
    lineno: number;
    colno: number;
    filename: string;
    function: string;
    in_app?: boolean;
  }[] = evt.stack || [
    {
      lineno: 0,
      colno: 0,
      filename: 'nostack',
      function: 'none',
      in_app: true,
    },
  ];

  return {
    exception: {
      values: [
        {
          type: `${evt.type}/${evt.level}/${evt.message}`,
          value: evt.message,
          stacktrace: {
            frames,
          },
          mechanism: {
            handled: true,
            type: 'generic',
          },
        },
      ],
    },
    level: 'error',
    event_id: createSentryEventId(),
    platform: 'javascript',
    timestamp: getSecondsTime(Date.now()),
    environment: globalAttrs.env,
    sdk: getSentrySDK(),
    tags: {
      ...globalAttrs,
      ...loggerAttrs,
      ...evt.attributes,
    },
    user: {
      id: userId,
    },
    breadcrumbs,
    request: getSentryRequest(conf),
    contexts: {
      data: evt.data,
      trace: {
        op: loggerAttrs.spanName,
        span_id: evt.spanId,
        trace_id: evt.traceId,
        tags: getSentryTags({}),
        status: 'unavailable',
      },
    },
  };
}

function getSecondsTime(time: LoggerEvent['time']) {
  return getMillisecondsTime(time) / 1000;
}

export function createSentryEventId() {
  return new Array<string>(4)
    .fill('')
    .reduce((prev) => Math.random().toString(16).substring(2, 10) + prev, '');
}

function getSentrySDK() {
  return {
    integrations: [
      'InboundFilters',
      'FunctionToString',
      'TryCatch',
      'Breadcrumbs',
      'GlobalHandlers',
      'LinkedErrors',
      'UserAgent',
      'Vue',
    ],
    name: 'sentry.javascript.react',
    version: '6.13.3',
    packages: [
      {
        name: 'npm:acelogger',
        version: '0.13.2',
      },
    ],
  };
}

function getSentryRequest(conf: SentryConfig) {
  return {
    url: conf.pageURI,
    headers: {
      'User-Agent': conf.userAgent,
    },
  };
}

function getSentryTags(attrs: Attributes): Tags {
  return {
    effectiveConnectionType: '',
    connectionType: '',
    deviceMemory: '',
    hardwareConcurrency: '',
    ...attrs,
  };
}

function updatePayloadMeasurements(
  payload: TransactionPayload,
  evt: LoggerEvent
) {
  if (evt.metrics) {
    Object.keys(evt.metrics).forEach((key) => {
      payload.measurements[key] = { value: evt.metrics[key] };
      if (['fp', 'fcp', 'lcp'].indexOf(key) > -1) {
        // the value of mark.lcp is not duration, but a timestamp
        payload.measurements[`mark.${key}`] = {
          value: getSecondsTime(
            (evt.data?.userStartTime as number) || evt.time
          ),
        };
      }
    });
  }
}

function getBreadcrumb(
  spanName: string,
  evt: LoggerEvent,
  loggerAttrs: LoggerAttributes,
  globalAttrs: ManagerAttributes
): Breadcrumb {
  return {
    timestamp: getSecondsTime(evt.time),
    category: evt.type,
    data: {
      arguments: [evt, loggerAttrs, globalAttrs],
      logger: spanName,
    },
    level: String(evt.level),
    message: `[${spanName}] ${evt.message}`,
  };
}

function getSentrySpanFromEvent(payload: TransactionPayload, evt: LoggerEvent) {
  const endTime = getMillisecondsTime(evt.time);
  const startTime =
    evt.data && evt.data.userStartTime
      ? (evt.data.userStartTime as number)
      : endTime;
  return {
    description: evt.message || evt.name,
    op: evt.name,
    parent_span_id: evt.spanId,
    span_id: sentryIdCreator.createSpanId(),
    start_timestamp: getSecondsTime(startTime),
    timestamp: getSecondsTime(endTime),
    trace_id: payload.contexts.trace.trace_id,
  };
}

export function flushSentry(conf: SentryConfig) {
  spanMap.forEach((payload) => {
    // 强制把未结束的 span 均上报
    payload.timestamp = Date.now();
    // 超时状态
    payload.contexts.trace.status = 'deadline_exceeded';
    sendTransaction(payload, conf);
  });
  spanMap.clear();
}

export const sentryIdCreator = {
  defaultSpanId: createSentryEventId().substring(0, 16),
  defaultTraceId: createSentryEventId(),
  createTraceId() {
    return createSentryEventId();
  },
  createSpanId() {
    return createSentryEventId().substring(0, 16);
  },
};
