import {
  getLogLevelByStatus,
  getStatusFromHTTPStatus,
  stackToFrame,
  mapExporterEvents,
} from '.';
import {
  LogLevel,
  SpanStatusCode,
  ErrorStackFrame,
  LoggerEvent,
  SpanKind,
  EventType,
  TraceFlags,
} from './api';

test('utils::getLogLevelByStatus', () => {
  expect(getLogLevelByStatus(SpanStatusCode.OK)).toBe(LogLevel.Debug);
  expect(getLogLevelByStatus(SpanStatusCode.UNSET)).toBe(LogLevel.Debug);
  expect(getLogLevelByStatus(SpanStatusCode.ERROR)).toBe(LogLevel.Error);
});

test('utils::getStatusFromHTTPStatus', () => {
  expect(getStatusFromHTTPStatus(100)).toBe(SpanStatusCode.OK);
  expect(getStatusFromHTTPStatus(200)).toBe(SpanStatusCode.OK);
  expect(getStatusFromHTTPStatus(401)).toBe(SpanStatusCode.ERROR);
  expect(getStatusFromHTTPStatus(403)).toBe(SpanStatusCode.ERROR);
  expect(getStatusFromHTTPStatus(404)).toBe(SpanStatusCode.ERROR);
  expect(getStatusFromHTTPStatus(500)).toBe(SpanStatusCode.ERROR);
  expect(getStatusFromHTTPStatus(501)).toBe(SpanStatusCode.ERROR);
  expect(getStatusFromHTTPStatus(503)).toBe(SpanStatusCode.ERROR);
  expect(getStatusFromHTTPStatus(504)).toBe(SpanStatusCode.ERROR);
});

test('utils::stackToFrame no colno', () => {
  const frames: ErrorStackFrame[] = [
    {
      lineno: 10,
      colno: 0,
      filename: 'gpt.js',
      function: 'Bg',
      in_app: true,
    },
    {
      lineno: 10,
      colno: 0,
      filename: 'gpt.js',
      function: 'HTMLDocument.<anonymous>',
      in_app: true,
    },
    {
      lineno: 10,
      colno: 0,
      filename: 'gpt.js',
      function: 'HTMLDocument.<anonymous>',
      in_app: true,
    },
  ];
  const expectFrames =
    stackToFrame(`Uncaught (in promise) TypeError: Failed to fetch
  at Bg (gpt.js:10)
  at HTMLDocument.<anonymous> (gpt.js:10)
  at HTMLDocument.<anonymous> (gpt.js:10)`);
  expect(JSON.stringify(expectFrames)).toBe(JSON.stringify(frames));
});

test('utils::stackToFrame normal', () => {
  const frames: ErrorStackFrame[] = [
    {
      lineno: 10,
      colno: 1,
      filename: 'gpt.js',
      function: 'Bg',
      in_app: true,
    },
    {
      lineno: 10,
      colno: 1,
      filename: 'gpt.js',
      function: 'HTMLDocument.<anonymous>',
      in_app: true,
    },
    {
      lineno: 10,
      colno: 1,
      filename: 'gpt.js',
      function: 'HTMLDocument.<anonymous>',
      in_app: true,
    },
  ];
  const expectFrames =
    stackToFrame(`Uncaught (in promise) TypeError: Failed to fetch
  at Bg (gpt.js:10:1)
  at HTMLDocument.<anonymous> (gpt.js:10:1)
  at HTMLDocument.<anonymous> (gpt.js:10:1)`);
  expect(JSON.stringify(expectFrames)).toBe(JSON.stringify(frames));
});

test('utils::mapExporterEvents normal', () => {
  const evts = mapExporterEvents<LoggerEvent>(
    {
      attributes: {
        app: 'test',
        appVersion: '0.1.1',
        env: 'test',
        os: 'macOS',
        osVersion: '1.0',
        userId: '1',
      },
      events: [
        {
          attributes: {
            spanName: 'span1',
            spanKind: SpanKind.CLIENT,
          },
          events: [
            {
              name: '123',
              type: EventType.Event,
              level: LogLevel.Debug,
              traceFlags: TraceFlags.NONE,
              traceId: '123123',
              spanId: '123123-0.1',
              parentSpanId: '123123-0',
              attributes: {},
              data: {},
              status: SpanStatusCode.OK,
              message: 'error',
              time: 123,
              exportable: true,
            },
          ],
        },
        {
          attributes: {
            spanName: 'span2',
            spanKind: SpanKind.CLIENT,
          },
          events: [
            {
              name: '234',
              type: EventType.Event,
              level: LogLevel.Debug,
              traceFlags: TraceFlags.NONE,
              traceId: '234234',
              spanId: '234234-0.1',
              parentSpanId: '234234-0',
              attributes: {},
              data: {},
              status: SpanStatusCode.OK,
              message: 'error',
              time: 234,
              exportable: true,
            },
          ],
        },
      ],
    },
    (evt, loggerAttrs, globalAttrs) => {
      evt.attributes = { ...loggerAttrs, ...globalAttrs, ...evt.attributes };
      return evt;
    }
  );
  expect(evts.length).toBe(2);
  expect(evts[0].attributes).toEqual({
    spanName: 'span1',
    spanKind: SpanKind.CLIENT,
    app: 'test',
    appVersion: '0.1.1',
    env: 'test',
    os: 'macOS',
    osVersion: '1.0',
    userId: '1',
  });
  expect(evts[1].attributes).toEqual({
    spanName: 'span2',
    spanKind: SpanKind.CLIENT,
    app: 'test',
    appVersion: '0.1.1',
    env: 'test',
    os: 'macOS',
    osVersion: '1.0',
    userId: '1',
  });
});
