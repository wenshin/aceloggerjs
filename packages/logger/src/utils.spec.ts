import { getLogLevelByStatus, getStatusFromHTTPStatus, stackToFrame } from '.';
import { LogLevel, SpanStatusCode, ErrorStackFrame } from './api';

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
