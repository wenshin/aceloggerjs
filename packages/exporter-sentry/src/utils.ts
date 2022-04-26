import {
  LoggerEvent,
  ExporterEvents,
  LoggerAttributes,
  ManagerAttributes,
} from '@acelogger/logger';

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

/**
 * 当页面隐藏时触发
 * @param cb
 * @param once
 */
export function onPageHidden(cb: (evt: Event) => void, once?: boolean) {
  function onHiddenOrPageHide(event: Event) {
    if (
      event.type === 'pagehide' ||
      window.document.visibilityState === 'hidden'
    ) {
      cb(event);
      if (once) {
        window.removeEventListener(
          'visibilitychange',
          onHiddenOrPageHide,
          true
        );
        window.removeEventListener('pagehide', onHiddenOrPageHide, true);
      }
    }
  }
  window.addEventListener('visibilitychange', onHiddenOrPageHide, true);
  // Some browsers have buggy implementations of visibilitychange,
  // so we use pagehide in addition, just to be safe.
  window.addEventListener('pagehide', onHiddenOrPageHide, true);
  window.onbeforeunload = onHiddenOrPageHide;
}
