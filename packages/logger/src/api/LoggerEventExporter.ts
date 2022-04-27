import { ExportResult } from './ExportResult';
import { ManagerAttributes, LoggerEvents } from './Manager';

export interface ExporterEvents {
  attributes: ManagerAttributes;
  events: LoggerEvents[];
}

export interface LoggerEventExporter {
  /**
   * @param events the list of sampled events or spans to be exported.
   */
  export(
    events: ExporterEvents,
    resultCallback?: (result: ExportResult) => void
  ): void;

  /** Stops the exporter. */
  shutdown(): void;
}
