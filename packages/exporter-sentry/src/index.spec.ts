import {
  SentryExporter,
  collectPerformance,
  listenWebErrors,
  listenWebPerformance,
} from '.';

test('index: export default', () => {
  expect(SentryExporter).toBeTruthy();
  expect(collectPerformance).toBeTruthy();
  expect(listenWebErrors).toBeTruthy();
  expect(listenWebPerformance).toBeTruthy();
});
