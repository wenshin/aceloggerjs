import { SpanLogger } from 'acelogger';

let initedPerformance = false;
const collectWebStatus = {
  performance: false,
};

/**
 * performance.timeOrigin 毫秒 timestamp
 * performance.now() 从 timeOrigin 的毫秒值，精确到 ns
 * @param logger
 * @returns
 */
export function listenWebPerformance(logger: SpanLogger) {
  if (initedPerformance) {
    return;
  }
  initedPerformance = true;
  window.addEventListener('load', () => {
    collectPerformance(logger);
  });
}

export function collectPerformance(logger: SpanLogger) {
  if (collectWebStatus.performance) {
    // 避免重复记录
    return;
  }
  const timeOrigin = logger.span.userStartTime;
  const data = window.performance.getEntries();
  if (data.length) {
    collectWebStatus.performance = true;
  }
  data.forEach((entry) => {
    let name = '';
    let message = '';
    let endTime = 0;
    let startTime = 0;
    const metrics: { [key: string]: number } = {};
    switch (entry.entryType) {
      case 'paint':
        name = 'paint';
        message = entry.name;
        endTime = timeOrigin + entry.startTime;
        startTime = endTime;
        if (entry.name === 'first-contentful-paint') {
          metrics.fcp = entry.startTime;
        } else if (entry.name === 'first-paint') {
          metrics.fp = entry.startTime;
        }
        break;
      case 'resource':
        startTime = timeOrigin + entry.startTime;
        endTime = entry.startTime + entry.duration + timeOrigin;
        name = (entry as PerformanceResourceTiming).initiatorType;
        message = entry.name;
        break;
      case 'first-input':
        name = 'first-input';
        message = name;
        startTime = timeOrigin;
        endTime = entry.startTime + timeOrigin;
        metrics.fi = entry.startTime;
        break;
      case 'navigation':
        name = 'first-connection';
        message = entry.name;
        startTime =
          timeOrigin + (entry as PerformanceNavigationTiming).fetchStart;
        endTime =
          timeOrigin + (entry as PerformanceNavigationTiming).responseEnd;
        metrics.ttfb =
          (entry as PerformanceNavigationTiming).responseStart -
          (entry as PerformanceNavigationTiming).requestStart;
        logger.event('TTFB', {
          time:
            timeOrigin + (entry as PerformanceNavigationTiming).responseStart,
          data: {
            userStartTime:
              timeOrigin + (entry as PerformanceNavigationTiming).requestStart,
          },
        });
        logger.event('DNS', {
          time:
            timeOrigin + (entry as PerformanceNavigationTiming).domainLookupEnd,
          data: {
            userStartTime:
              timeOrigin +
              (entry as PerformanceNavigationTiming).domainLookupStart,
          },
        });
        logger.event('SSL', {
          time:
            timeOrigin +
            (entry as PerformanceNavigationTiming).secureConnectionStart,
          data: {
            userStartTime:
              timeOrigin +
              (entry as PerformanceNavigationTiming).domainLookupEnd,
          },
        });
        logger.event('domContentLoaded', {
          time:
            timeOrigin +
            (entry as PerformanceNavigationTiming).domContentLoadedEventEnd,
          data: {
            userStartTime:
              timeOrigin +
              (entry as PerformanceNavigationTiming).domContentLoadedEventStart,
          },
        });
        logger.event('load', {
          time:
            timeOrigin + (entry as PerformanceNavigationTiming).loadEventEnd,
          data: {
            userStartTime:
              timeOrigin +
              (entry as PerformanceNavigationTiming).loadEventStart,
          },
        });
        break;
      default:
        name = entry.entryType;
        message = entry.name;
        startTime = entry.startTime + timeOrigin;
        endTime = startTime + entry.duration;
        break;
    }
    if (name) {
      logger.event(name, {
        time: endTime,
        message,
        metrics,
        data: { userStartTime: startTime },
      });
    }
  });
}
