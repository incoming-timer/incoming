import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { distMainPath, launchTestApp } from './launchTestApp';

// Playwright requires fixture arguments to use object destructuring.
// eslint-disable-next-line no-empty-pattern
test('opens the main window after launch', async ({}, testInfo) => {
  test.skip(
    !fs.existsSync(distMainPath),
    'Run `npm run build` before executing Electron E2E tests.'
  );

  const electronApp = await launchTestApp(testInfo);

  try {
    const window = await electronApp.firstWindow();
    await expect(window.locator('.home-dashboard')).toBeVisible();
    await expect(window).toHaveTitle('Incoming');
    expect(await electronApp.evaluate(({ app }) => app.getName())).toBe(
      'Incoming'
    );
  } finally {
    await electronApp.close();
  }
});
