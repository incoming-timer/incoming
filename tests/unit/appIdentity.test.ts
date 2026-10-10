import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APP_ID,
  configureAppIdentity,
  USER_DATA_DIRECTORY,
} from '../../electron/appIdentity';
import { createLocalPersist } from '../../electron/localPersist';

const directories: string[] = [];

async function createAppData() {
  const directory = await mkdtemp(path.join(tmpdir(), 'incoming-identity-'));
  directories.push(directory);
  return directory;
}

function createApp(appData: string, customProfile = false) {
  return {
    getPath: vi.fn(() => appData),
    setPath: vi.fn(),
    setName: vi.fn(),
    setAppUserModelId: vi.fn(),
    commandLine: { hasSwitch: vi.fn(() => customProfile) },
  };
}

describe('application identity compatibility', () => {
  afterEach(async () => {
    for (const directory of directories.splice(0)) {
      if (
        path.dirname(directory) !== tmpdir() ||
        !path.basename(directory).startsWith('incoming-identity-')
      ) {
        throw new Error('Unexpected test directory');
      }
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('reuses the 0.1.0 timer data and overlay settings after renaming', async () => {
    const appData = await createAppData();
    const legacyDirectory = path.join(appData, 'incoming-electron');
    await mkdir(path.join(legacyDirectory, 'timer-settings'), {
      recursive: true,
    });
    const saved = {
      saveAt: '2026-10-09T00:00:00.000Z',
      data: [
        {
          id: 'legacy-timer',
          title: '기존 타이머',
          duration: 5000,
          repeat: false,
          state: { type: 'paused', duration: 5000 },
        },
      ],
    };
    const settings = '{"legacy-timer":{"x":120,"y":80,"opacity":0.7}}';
    const settingsFile = path.join(
      legacyDirectory,
      'timer-settings',
      'overlay-settings.json'
    );
    await writeFile(
      path.join(legacyDirectory, 'data.json'),
      JSON.stringify(saved)
    );
    await writeFile(settingsFile, settings);
    const app = createApp(appData);

    configureAppIdentity(app, 'win32');

    expect(app.setName).toHaveBeenCalledWith('Incoming');
    expect(app.setAppUserModelId).toHaveBeenCalledWith(APP_ID);
    expect(app.setPath).toHaveBeenCalledWith('userData', legacyDirectory);
    await expect(
      createLocalPersist(path.join(legacyDirectory, 'data.json')).load()
    ).resolves.toEqual(saved);
    expect(await readFile(settingsFile, 'utf8')).toBe(settings);
  });

  it('creates the stable data directory on a fresh installation', async () => {
    const appData = await createAppData();
    const app = createApp(appData);

    configureAppIdentity(app, 'linux');

    expect(app.setPath).toHaveBeenCalledWith(
      'userData',
      path.join(appData, USER_DATA_DIRECTORY)
    );
    expect(app.setAppUserModelId).not.toHaveBeenCalled();
    await writeFile(
      path.join(appData, USER_DATA_DIRECTORY, 'probe'),
      'writable'
    );
  });

  it('preserves an explicitly selected profile', () => {
    const app = createApp('unused', true);

    configureAppIdentity(app, 'win32');

    expect(app.commandLine.hasSwitch).toHaveBeenCalledWith('user-data-dir');
    expect(app.getPath).not.toHaveBeenCalled();
    expect(app.setPath).not.toHaveBeenCalled();
    expect(app.setName).toHaveBeenCalledWith('Incoming');
  });
});
