import { _electron as electron, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const distMainPath = path.join(
  process.cwd(),
  'dist-electron',
  'main.js'
);

export function launchTestApp(testInfo: TestInfo, executablePath?: string) {
  const userData = testInfo.outputPath('user-data');
  fs.mkdirSync(userData, { recursive: true });

  return electron.launch({
    executablePath,
    args: [
      ...(executablePath ? [] : [distMainPath]),
      `--user-data-dir=${userData}`,
    ],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });
}
