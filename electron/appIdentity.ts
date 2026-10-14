import type { App } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { productName } from '../package.json';

export const APP_ID = 'io.github.incoming-timer.incoming';

// Keep the directory used by 0.1.0 independently of the display name.
export const USER_DATA_DIRECTORY = 'incoming-electron';

type IdentityApp = Pick<
  App,
  'getPath' | 'setPath' | 'setName' | 'setAppUserModelId'
> & {
  commandLine: Pick<App['commandLine'], 'hasSwitch'>;
};

export function configureAppIdentity(
  app: IdentityApp,
  platform: typeof process.platform = process.platform
) {
  app.setName(productName);
  if (platform === 'win32') {
    app.setAppUserModelId(APP_ID);
  }

  // Respect explicitly isolated profiles, including Playwright's test profiles.
  if (!app.commandLine.hasSwitch('user-data-dir')) {
    const userData = path.join(app.getPath('appData'), USER_DATA_DIRECTORY);
    fs.mkdirSync(userData, { recursive: true });
    app.setPath('userData', userData);
  }
}
