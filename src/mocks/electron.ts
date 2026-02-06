/**
 * Mock Electron module for server-only builds (Render.com)
 * Provides stubs for Electron APIs that server code might import
 */

// Mock safeStorage
export const safeStorage = {
    isEncryptionAvailable: () => false,
    encryptString: (text: string) => Buffer.from(text),
    decryptString: (buffer: Buffer) => buffer.toString(),
};

// Mock app
export const app = {
    getPath: (name: string) => {
        const os = require('os');
        const path = require('path');
        switch (name) {
            case 'userData':
                return path.join(os.homedir(), '.antigravity-agent');
            case 'appData':
                return path.join(os.homedir(), '.config');
            default:
                return os.homedir();
        }
    },
    getName: () => 'Antigravity Manager',
    getVersion: () => '0.6.0',
};

// Mock Menu
export class Menu {
    static buildFromTemplate() {
        return new Menu();
    }
    static setApplicationMenu() { }
    popup() { }
}

// Mock Tray
export class Tray {
    constructor(icon: string) { }
    setToolTip(tip: string) { }
    setContextMenu(menu: Menu) { }
    destroy() { }
}

// Mock BrowserWindow
export class BrowserWindow {
    static getAllWindows() {
        return [];
    }
    static getFocusedWindow() {
        return null;
    }
    webContents = {
        send: () => { },
    };
}

// Mock nativeImage
export const nativeImage = {
    createFromPath: (path: string) => ({}),
    createFromDataURL: (dataUrl: string) => ({}),
};

// Mock ipcMain (not used in server, but just in case)
export const ipcMain = {
    handle: () => { },
    on: () => { },
    removeHandler: () => { },
};

// Mock dialog
export const dialog = {
    showMessageBox: async () => ({ response: 0 }),
    showErrorBox: () => { },
};

export default {
    safeStorage,
    app,
    Menu,
    Tray,
    BrowserWindow,
    nativeImage,
    ipcMain,
    dialog,
};
