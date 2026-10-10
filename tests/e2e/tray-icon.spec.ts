import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { distMainPath, launchTestApp } from './launchTestApp';

// Playwright requires fixture arguments to use object destructuring.
// eslint-disable-next-line no-empty-pattern
test('creates a tray icon with basic menu actions', async ({}, testInfo) => {
  test.skip(
    !fs.existsSync(distMainPath),
    'Run `npm run build` before executing Electron E2E tests.'
  );

  const electronApp = await launchTestApp(testInfo);

  try {
    const mainWindow = await electronApp.firstWindow();
    await expect(mainWindow.locator('.home-dashboard')).toBeVisible();

    const trayInfo = await mainWindow.evaluate(() => {
      return Reflect.get(window, 'electronAPI').getTrayInfo();
    });

    expect(trayInfo.hasTray).toBeTruthy();
    expect(trayInfo.menuLabels).toEqual(
      expect.arrayContaining(['Open', 'Quit'])
    );
  } finally {
    await electronApp.close();
  }
});
