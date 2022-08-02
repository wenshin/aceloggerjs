import {
  ExportResult,
  ExporterEvents,
  LogLevel,
  LoggerAttributes,
  LoggerEvent,
  LoggerEventExporter,
} from '../api';
import {
  InitParams,
  LogLevelTitleMap,
  adaptToJSConsole,
  formatSection,
} from './console';

import { mapExporterEvents } from '../utils';

export function adaptToNodeConsole(
  attrs: LoggerAttributes,
  evt: LoggerEvent,
  include: string
): void {
  const debugConfig = (process.env.DEBUG || include || '').split(',');
  const isAllowDebug =
    debugConfig.includes(attrs.logger || attrs.spanName) ||
    debugConfig.includes('*');
  if (isAllowDebug || evt.level >= LogLevel.Warn) {
    evt.attributes = Object.assign(attrs, evt.attributes);
    adaptToJSConsole(evt, formatNodeConsole);
  }
}

/**
 * format evt to be a colorful output in node console
 * @param evt
 */
export function formatNodeConsole(evt: LoggerEvent): unknown[] {
  const statusColor = evt.level < LogLevel.Warn ? '32' : '31';
  return [
    `\x1b[${statusColor}m${LogLevelTitleMap[evt.level]}\x1b[0m`,
    formatSection(evt),
    `"${evt.message || ''}"`,
    evt,
  ];
}

export default class ConsoleExporterNode implements LoggerEventExporter {
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
      adaptToNodeConsole({ ...globalAttrs, ...loggerAttrs }, evt, this.include);
    });
    if (cb) {
      cb(ExportResult.SUCCESS);
    }
  }

  public shutdown(): void {
    this.stoped = true;
  }
}
