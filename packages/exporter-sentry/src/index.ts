import { ExporterEvents, LoggerEventExporter } from 'acelogger';
import {
  flushSentry,
  sendSentryData,
  SentryConfig,
  sentryIdCreator,
} from './sentry';
import 'whatwg-fetch';

export class SentryExporter implements LoggerEventExporter {
  constructor(private config: SentryConfig) {
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

export {
  collectPerformance,
  listenWebErrors,
  listenWebPerformance,
} from './init-web';

export { sentryIdCreator };
