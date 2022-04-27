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
} from 'acelogger';
import { EventFormatter, mapExporterEvents } from './utils';

/**
 * 踩坑
 * 1. eventID 的前八位相同会合并
 * 2. spanID 和 traceID 格式必须和 sentry 保持一致，spanID 16 位 16 进制，traceID 32 位 16 进制
 * 3. startTime 比 endTime 大，导致失败
 * 4. measurements 中 mark.metric 只支持 web vitals 指标
 */
const spanMap = new Map<string, TransactionPayload>();
const sendMap = new Map<string, boolean>();
const breadcrumbs: TransactionPayload['breadcrumbs'] = [];

export interface SentryConfig {
  key: string;
  projectId: string;
  // domain and protocol, https://www.sentry.com
  host: string;
}

function getSentryUrl(conf: SentryConfig, type: 'error' | 'transition') {
  const path = type === 'error' ? 'store' : 'envelope';
  return `${conf.host}/api/${conf.projectId}/${path}/?sentry_key=${conf.key}&sentry_version=7`;
}

export function sendSentryData(evts: ExporterEvents, conf: SentryConfig) {
  if (!evts.events.length) return;
  cacheTransactionData(evts, (evt, loggerAttrs, globalAttrs) => {
    // 上报错误
    if (evt.level >= LogLevel.Warn) {
      const data = getSentryExceptionData(evt, loggerAttrs, globalAttrs);
      fetch(getSentryUrl(conf, 'error'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      }).catch((err) => {
        console.error(err);
      });
    }
  });
  spanMap.forEach((payload, key) => {
    // payload.timestamp 大于 0 说明已经调用过 endSpan
    if (payload.timestamp) {
      if (!sendMap.get(key)) {
        mergeChildSpans(payload);
        sendTransaction(payload, conf);
        spanMap.delete(key);
        sendMap.set(key, true);
      }
    }
  });
}

function mergeChildSpans(
  payload: TransactionPayload,
  childSpans?: TransactionPayload[]
) {
  const spans = childSpans || payload.childSpans || [];
  spans.forEach((child) => {
    payload.spans.push(
      getSentrySpanFromPaylaod(payload.contexts.trace.span_id, child)
    );
    if (child.childSpans && child.childSpans.length) {
      mergeChildSpans(payload, child.childSpans);
    }
  });
  delete payload.childSpans;
}

function sendTransaction(payload: TransactionPayload, conf: SentryConfig) {
  fetch(getSentryUrl(conf, 'transition'), {
    method: 'POST',
    headers: {
      'content-type': 'text/plain; charset=utf-8',
    },
    body: `{"event_id":"${
      payload.event_id
    }","sent_at":"${new Date().toISOString()}","sdk":{"name":"${
      payload.sdk.name
    }","version":"${payload.sdk.version}"}}
{"type":"transaction","sample_rates":[{"id":"client_rate","rate":1}]}
${JSON.stringify(payload)}`,
  }).catch((err) => {
    console.error(err);
  });
}

interface TransacctionSpan {
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
  spans: TransacctionSpan[];
  tags: Tags;
  breadcrumbs: Breadcrumb[];

  /**
   * 临时存储子 span，数据不上报
   */
  childSpans?: TransactionPayload[];
}

/**
 * acelogger 的一个 span 对应一个 TransacctionPayload，什么时机上报缓存的 span 数据是个问题
 * @param evts
 */
function cacheTransactionData(evts: ExporterEvents, cb?: EventFormatter<void>) {
  mapExporterEvents(evts, (evt, loggerAttrs, globalAttrs) => {
    const isRootSpan = evt.spanId === sentryIdCreator.defaultSpanId;
    if (!isRootSpan) {
      let payload = spanMap.get(evt.spanId);
      if (!payload) {
        payload = {
          type: 'transaction',
          platform: 'javascript',
          event_id: createSentryEventId(),
          environment: globalAttrs.env,
          sdk: getSentrySDK(),
          request: getSentryRequest(),
          transaction: (loggerAttrs.url as string) || loggerAttrs.spanName,
          contexts: {
            trace: {
              op: loggerAttrs.spanName,
              span_id: evt.spanId,
              trace_id: evt.traceId,
              tags: getSentryTags(loggerAttrs),
            },
          },
          start_timestamp: getSecondsTime(evt.time),
          timestamp: 0,
          measurements: {},
          spans: [],
          breadcrumbs,
          tags: getSentryTags(globalAttrs),
        };
        spanMap.set(evt.spanId, payload);
      }

      Object.assign(payload.measurements, getMeasurements(evt));
      // 1. 如果是 span start 事件，则记录开始时间。并关联到父 Span 上面。
      if (evt.name === getSpanEventName(loggerAttrs.spanName, 'start')) {
        payload.start_timestamp = getSecondsTime(
          evt.data.userStartTime || evt.time
        );
        const parentSpan = getParentSpan(evt);
        if (parentSpan) {
          parentSpan.childSpans = parentSpan.childSpans || [];
          parentSpan.childSpans.push(payload);
        }
      }
      if (evt.name === getSpanEventName(loggerAttrs.spanName, 'end')) {
        payload.timestamp = getSecondsTime(evt.time);
      }
      if (evt.type === EventType.Event || evt.type === EventType.Tracing) {
        payload.spans.push(getSentrySpan(payload, evt));
        payload.contexts.trace.status =
          evt.status === SpanStatusCode.OK ? 'ok' : 'unknown_error';
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

function getParentSpan(evt: LoggerEvent) {
  if (evt.parentSpanId) {
    return spanMap.get(evt.parentSpanId);
  }
  return null;
}

function getSentryExceptionData(
  evt: LoggerEvent,
  loggerAttrs: LoggerAttributes,
  globalAttrs: ManagerAttributes
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
    request: getSentryRequest(),
    contexts: {
      data: evt.data,
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

function getSentryRequest() {
  return {
    url: window.location.href,
    headers: {
      'User-Agent': window.navigator.userAgent,
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

function getMeasurements(evt: LoggerEvent) {
  const measurements: TransactionPayload['measurements'] = {};
  Object.keys(evt.metrics || {}).forEach((key) => {
    if (evt.metrics) {
      measurements[key] = { value: evt.metrics[key] };
      if (['fp', 'fcp', 'lcp'].indexOf(key) > -1) {
        measurements[`mark.${key}`] = {
          value: getSecondsTime(
            (evt.data?.userStartTime as number) || evt.time
          ),
        };
      }
    }
  });
  return measurements;
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

function getSentrySpan(payload: TransactionPayload, evt: LoggerEvent) {
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

function getSentrySpanFromPaylaod(
  parentSpanId: string,
  payload: TransactionPayload
) {
  return {
    description: payload.transaction,
    op: payload.contexts.trace.op,
    parent_span_id: parentSpanId,
    span_id: payload.contexts.trace.span_id,
    start_timestamp: payload.start_timestamp,
    // 当 span end 事件未触发时，payload.timestamp 为 0
    timestamp: payload.timestamp || payload.start_timestamp,
    trace_id: payload.contexts.trace.trace_id,
  };
}

export function flushSentry(conf: SentryConfig) {
  spanMap.forEach((payload, key) => {
    if (!sendMap.get(key)) {
      sendTransaction(payload, conf);
      spanMap.delete(key);
      sendMap.set(key, true);
    }
  });
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
