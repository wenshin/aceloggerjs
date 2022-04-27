import {
  TimeInput,
  SpanStatusCode,
  LogLevel,
  ErrorStackFrame,
  LoggerEvent,
  LoggerAttributes,
  ManagerAttributes,
  ExporterEvents,
} from './api';

export function isTimeInputHrTime(time: TimeInput): boolean {
  return Array.isArray(time) && time.length === 2;
}

export function getMillisecondsTime(time: TimeInput): number {
  return time && isTimeInputHrTime(time)
    ? time[0] * 1e3 + time[1] / 1e6
    : (time as number);
}

export function getStatusFromHTTPStatus(status: number) {
  if (status < 300) {
    return SpanStatusCode.OK;
  }
  return SpanStatusCode.ERROR;
}

export function getLogLevelByStatus(status: SpanStatusCode): LogLevel {
  switch (status) {
    case SpanStatusCode.UNSET:
    case SpanStatusCode.OK:
      // success status use debug level
      return LogLevel.Debug;
    default:
      return LogLevel.Error;
  }
}

/**
 *
 * @param spanName
 * @param event
 * fmp: First Meaningful Paint, the meaningful content paint
 * lcp: Largest Contentful Paint, the largest area content paint
 * shown: all elements paint in view area
 * tti: Time to interactive
 * @returns
 */
export function getSpanEventName(
  spanName: string,
  event: 'start' | 'end' | 'fmp' | 'lcp' | 'shown' | 'tti'
): string {
  return `${spanName}.${event}`;
}

export function getLatencyMetric(eventName: string): string {
  return `${eventName}.latency`;
}

export function getDurationMetric(spanName: string): string {
  return `${spanName}.duration`;
}

export function stackToFrame(stack: string): ErrorStackFrame[] {
  return stack
    .split('\n')
    .slice(1)
    .map((line) => {
      const elems = line.trim().split(/\s+/);
      const func = elems[1] || 'unknown';
      const file = elems[2];
      const fileRE = /\(?(.+?):(\d+):?(\d+)?\)?$/;
      let [, filename, lineno, colno] = func.match(fileRE) || [];
      if (!filename && file) {
        [, filename, lineno, colno] = file.match(fileRE) || [];
      }
      return {
        lineno: Number(lineno) || 0,
        colno: Number(colno) || 0,
        filename,
        function: func,
        in_app: true,
      };
    });
}

export type EventFormatter<T> = (
  evt: LoggerEvent,
  loggerAttrs: LoggerAttributes,
  globalAttrs: ManagerAttributes
) => T;

export function mapExporterEvents<T>(
  evts: ExporterEvents,
  format: EventFormatter<T>
): T[] {
  const data: T[] = [];
  const globalAttrs = evts.attributes;
  evts.events.forEach((loggerEvts) => {
    const loggerAttrs = loggerEvts.attributes;
    loggerEvts.events.forEach((evt) => {
      data.push(format(evt, loggerAttrs, globalAttrs));
    });
  });
  return data;
}
