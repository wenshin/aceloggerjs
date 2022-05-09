import {
  LoggerEventExporter,
  LoggerEvent,
  ExportResult,
  LogLevel,
  ExporterEvents,
  LoggerAttributes,
} from '../api';
import { mapExporterEvents } from '../utils';
import {
  InitParams,
  adaptToJSConsole,
  formatSection,
  LogLevelTitleMap,
} from './console';

export function adaptToBrowserConsole(
  attrs: LoggerAttributes,
  evt: LoggerEvent,
  include: string
): void {
  const debugConfig = (
    (window as unknown as { __ace_debug: string }).__ace_debug ||
    include ||
    ''
  ).split(',');
  const isAllowDebug =
    debugConfig.includes(attrs.logger || attrs.spanName) ||
    debugConfig.includes('*');
  if (isAllowDebug || evt.level >= LogLevel.Warn) {
    evt.attributes = Object.assign(attrs, evt.attributes);
    adaptToJSConsole(evt, formatBrowserConsole);
  }
}

/**
 * format evt to be a colorful output in browser console
 * @param evt
 */
export function formatBrowserConsole(evt: LoggerEvent): unknown[] {
  const statusColor = evt.level < LogLevel.Warn ? '#bbbbbb' : '#FF7043';
  return [
    `%c${LogLevelTitleMap[evt.level]} ${formatSection(evt)}`,
    `font-weight: bold; color: ${statusColor};`,
    `"${evt.message}"`,
    evt,
  ];
}

export default class ConsoleExporterWeb implements LoggerEventExporter {
  private stoped = false;
  include = '';

  constructor({ include }: InitParams) {
    this.include = include;
  }
  public export(evts: ExporterEvents, cb: (stats: ExportResult) => void): void {
    if (this.stoped) {
      return;
    }
    mapExporterEvents(evts, (evt, loggerAttrs, globalAttrs) => {
      adaptToBrowserConsole(
        { ...globalAttrs, ...loggerAttrs },
        evt,
        this.include
      );
    });
    if (cb) {
      cb(ExportResult.SUCCESS);
    }
  }

  public shutdown(): void {
    this.stoped = true;
  }
}
