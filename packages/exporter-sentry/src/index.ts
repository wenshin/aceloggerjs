import { ExporterEvents, LoggerEventExporter } from '@acelogger/logger';
import { flushSentry, sendSentryData, SentryConfig } from './sentry';
import 'whatwg-fetch';

export class SentryExporter implements LoggerEventExporter {
  constructor(private config: SentryConfig) {
    this.config = config;
  }
  shutdown() {}
  export(evts: ExporterEvents) {
    sendSentryData(evts, this.config);
  }
  flush() {
    flushSentry(this.config);
  }
}

export {
  collectPerformance,
  listenWebErrors,
  listenWebPerformance,
} from './init-web';
