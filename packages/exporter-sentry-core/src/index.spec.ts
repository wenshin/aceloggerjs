import { SentryExporter, startPageloadLogger } from '.';

test('index: export default', () => {
  expect(SentryExporter).toBeTruthy();
  expect(startPageloadLogger).toBeTruthy();
});
