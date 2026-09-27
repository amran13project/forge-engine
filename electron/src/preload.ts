import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('forgeDesktop', {
  chooseDirectory: () => ipcRenderer.invoke('forge:dialog:choose-directory') as Promise<string | null>,
  chooseProjectFile: () => ipcRenderer.invoke('forge:dialog:open-project') as Promise<string | null>,
  createProject: (name: string, parentDir: string, mode: '2D' | '3D') => ipcRenderer.invoke('forge:project:create', name, parentDir, mode),
  openProject: (fileOrRoot: string) => ipcRenderer.invoke('forge:project:open', fileOrRoot),
  saveScene: (root: string, relativePath: string, data: string) => ipcRenderer.invoke('forge:project:save-scene', root, relativePath, data),
  readScene: (root: string, relativePath: string) => ipcRenderer.invoke('forge:project:read-scene', root, relativePath),
  saveScript: (root: string, relativePath: string, data: string) => ipcRenderer.invoke('forge:project:save-script', root, relativePath, data),
  readScript: (root: string, relativePath: string) => ipcRenderer.invoke('forge:project:read-script', root, relativePath),
  getAppDataPath: () => ipcRenderer.invoke('forge:app:get-path') as Promise<string>,
  listFiles: (root: string, relative = '') => ipcRenderer.invoke('forge:project:list-files', root, relative),
  chooseAsset: () => ipcRenderer.invoke('forge:dialog:choose-asset') as Promise<string | null>,
  importAsset: (root: string, source: string) => ipcRenderer.invoke('forge:asset:import', root, source) as Promise<string>,
  readAssetData: (root: string, relativePath: string) => ipcRenderer.invoke('forge:asset:read-data', root, relativePath) as Promise<string>,
  saveJson: (root: string, relativePath: string, value: unknown) => ipcRenderer.invoke('forge:project:save-json', root, relativePath, value) as Promise<string>,
  buildWeb: (root: string, mainScene: string) => ipcRenderer.invoke('forge:build:web', root, mainScene),
  aiModels: () => ipcRenderer.invoke('forge:ai:models') as Promise<Array<{ name: string; size: number; modifiedAt: string }>>,
  aiChat: (messages: Array<{ role: 'user' | 'assistant'; content: string }>, context: string, model?: string) => ipcRenderer.invoke('forge:ai:chat', messages, context, model) as Promise<{ provider: string; answer: string; model: string; local: boolean }>,
  aiHelp: (message: string, context: string) => ipcRenderer.invoke('forge:ai:help', message, context) as Promise<{ provider: string; answer: string; model?: string; local?: boolean }>,
});
