import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import { distMainPath, launchTestApp } from './launchTestApp';

// Playwright requires fixture arguments to use object destructuring.
// eslint-disable-next-line no-empty-pattern
test('creates and closes a timer overlay without deleting the timer', async ({}, testInfo) => {
  test.skip(
    !fs.existsSync(distMainPath),
    'Run `npm run build` before executing Electron E2E tests.'
  );

  const electronApp = await launchTestApp(testInfo);

  try {
    const mainWindow = await electronApp.firstWindow();
    await expect(mainWindow.locator('.home-dashboard')).toBeVisible();

    const timerItems = mainWindow.getByTestId('timer-item');
    const initialCount = await timerItems.count();

    await mainWindow.getByTestId('duration-seconds').fill('5');

    const overlayWindowPromise = electronApp.waitForEvent(
      'window',
      (page) => page !== mainWindow
    );

    await mainWindow.getByTestId('create-timer').click();

    const overlayWindow = await overlayWindowPromise;
    await overlayWindow.waitForLoadState('domcontentloaded');

    await expect(overlayWindow).toHaveURL(/#\/timer-overlay\//);
    await expect(overlayWindow.getByTestId('timer-display')).toHaveText(
      '00:05.00'
    );
    await overlayWindow.screenshot({
      path: testInfo.outputPath('overlay-default.png'),
    });

    await overlayWindow.emulateMedia({ reducedMotion: 'reduce' });
    await electronApp.evaluate(({ BrowserWindow }) => {
      const overlay = BrowserWindow.getAllWindows().find((window) =>
        window.webContents.getURL().includes('/timer-overlay/')
      );
      overlay?.setSize(240, 140);
    });
    await expect(overlayWindow.getByTestId('timer-hud')).toBeVisible();
    await expect(overlayWindow.getByTestId('timer-toggle')).toBeVisible();
    const viewportFits = await overlayWindow.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(viewportFits).toBeTruthy();
    const animationDuration = await overlayWindow
      .getByTestId('timer-display')
      .evaluate((element) => getComputedStyle(element).animationDuration);
    expect(Number.parseFloat(animationDuration)).toBeLessThanOrEqual(0.000001);
    await overlayWindow.screenshot({
      path: testInfo.outputPath('overlay-small-reduced-motion.png'),
    });
    await expect(timerItems).toHaveCount(initialCount + 1);
    const managerViewportFits = await mainWindow.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    );
    expect(managerViewportFits).toBeTruthy();

    const newTimer = mainWindow.getByTestId('timer-item').last();
    await expect(newTimer).not.toContainText(/ID:/);

    const closedOverlayPromise = overlayWindow.waitForEvent('close');
    await overlayWindow.close();
    await closedOverlayPromise;

    const reopenedOverlayPromise = electronApp.waitForEvent(
      'window',
      (page) => page !== mainWindow
    );
    await newTimer.getByTestId('open-timer').click();

    const reopenedOverlay = await reopenedOverlayPromise;
    await reopenedOverlay.waitForLoadState('domcontentloaded');
    await expect(reopenedOverlay).toHaveURL(/#\/timer-overlay\//);
    await expect(reopenedOverlay.getByTestId('timer-display')).toHaveText(
      '00:05.00'
    );

    const timerId = new URL(reopenedOverlay.url()).hash
      .split('/')[2]
      .split('?')[0];
    const closePromise = reopenedOverlay.waitForEvent('close');
    await reopenedOverlay.getByTestId('close-timer-overlay').click();

    await closePromise;
    await expect(timerItems).toHaveCount(initialCount + 1);
    const retainedTimer = await mainWindow.evaluate(
      (id) => Reflect.get(window, 'electronAPI').getTimer(id),
      timerId
    );
    expect(retainedTimer?.id).toBe(timerId);

    const finalOverlayPromise = electronApp.waitForEvent(
      'window',
      (page) => page !== mainWindow
    );
    await newTimer.getByTestId('open-timer').click();
    const finalOverlay = await finalOverlayPromise;
    await finalOverlay.waitForLoadState('domcontentloaded');
    await expect(finalOverlay.getByTestId('timer-display')).toHaveText(
      '00:05.00'
    );

    const removedOverlayPromise = finalOverlay.waitForEvent('close');
    await newTimer.getByTestId('remove-timer').click();
    await removedOverlayPromise;
    await expect(timerItems).toHaveCount(initialCount);
    const removedTimer = await mainWindow.evaluate(
      (id) => Reflect.get(window, 'electronAPI').getTimer(id),
      timerId
    );
    expect(removedTimer).toBeUndefined();
  } finally {
    await electronApp.close();
  }
});
