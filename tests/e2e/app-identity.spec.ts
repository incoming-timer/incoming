import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { launchTestApp } from './launchTestApp';

const { version } = JSON.parse(
  fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
);

const executablePath = path.join(
  process.cwd(),
  'release',
  version,
  'win-unpacked',
  'Incoming.exe'
);

// Playwright requires fixture arguments to use object destructuring.
// eslint-disable-next-line no-empty-pattern
test('packaged Incoming restores existing timer data and settings', async ({}, testInfo) => {
  test.skip(process.platform !== 'win32', 'Windows packaging smoke test.');
  expect(
    fs.existsSync(executablePath),
    'Build the Windows app first.'
  ).toBeTruthy();

  const userData = testInfo.outputPath('user-data');
  fs.mkdirSync(path.join(userData, 'timer-settings'), { recursive: true });
  const timer = {
    id: 'legacy-timer',
    title: '기존 타이머',
    duration: 5000,
    repeat: false,
    state: { type: 'paused', duration: 5000 },
  };
  const settings = {
    width: 240,
    height: 140,
    x: 120,
    y: 80,
    opacity: 0.7,
    theme: 'dark',
  };
  fs.writeFileSync(
    path.join(userData, 'data.json'),
    JSON.stringify({ saveAt: '2026-10-09T00:00:00.000Z', data: [timer] })
  );
  fs.writeFileSync(
    path.join(userData, 'timer-settings', 'overlay-settings.json'),
    JSON.stringify({ [timer.id]: settings })
  );
  const electronApp = await launchTestApp(testInfo, executablePath);

  try {
    const mainWindow = await electronApp.firstWindow();
    await expect(mainWindow).toHaveTitle('Incoming');
    await expect(mainWindow.getByTestId('timer-item')).toContainText(
      timer.title
    );
    const identity = await electronApp.evaluate(({ app }) => ({
      name: app.getName(),
      userData: app.getPath('userData'),
      packaged: app.isPackaged,
    }));
    expect(identity).toEqual({ name: 'Incoming', userData, packaged: true });
    expect(
      await mainWindow.evaluate(() =>
        Reflect.get(window, 'electronAPI').getTimerSettings('legacy-timer')
      )
    ).toEqual(settings);

    const overlayPromise = electronApp.waitForEvent('window');
    await mainWindow.getByTestId('open-timer').click();
    const overlay = await overlayPromise;
    await expect(overlay.getByTestId('timer-display')).toHaveText('00:05.00');
    expect(
      await electronApp.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()
          .find((window) =>
            window.webContents.getURL().includes('/timer-overlay/')
          )
          ?.getTitle()
      )
    ).toBe(timer.title);

    await mainWindow.screenshot({
      path: testInfo.outputPath('incoming-main.png'),
      fullPage: true,
    });
  } finally {
    await electronApp.close();
  }

  const restartedApp = await launchTestApp(testInfo, executablePath);
  try {
    const mainWindow = await restartedApp.firstWindow();
    await expect(mainWindow.getByTestId('timer-item')).toContainText(
      timer.title
    );
    await expect(mainWindow).toHaveTitle('Incoming');
  } finally {
    await restartedApp.close();
  }
});
