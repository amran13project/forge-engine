export {};

declare global {
  interface Window {
    forgeDesktop: {
      chooseDirectory(): Promise<string | null>;
      chooseProjectFile(): Promise<string | null>;
      createProject(name: string, parentDir: string, mode: '2D' | '3D'): Promise<unknown>;
      openProject(fileOrRoot: string): Promise<unknown>;
      saveScene(root: string, relativePath: string, data: string): Promise<string>;
      readScene(root: string, relativePath: string): Promise<string>;
      saveScript(root: string, relativePath: string, data: string): Promise<string>;
      readScript(root: string, relativePath: string): Promise<string>;
      listFiles(root: string, relative?: string): Promise<Array<{ path: string; size: number; kind: 'file' | 'folder' }>>;
      chooseAsset(): Promise<string | null>;
      importAsset(root: string, source: string): Promise<string>;
      readAssetData(root: string, relativePath: string): Promise<string>;
      saveJson(root: string, relativePath: string, value: unknown): Promise<string>;
      buildWeb(root: string, mainScene: string): Promise<unknown>;
      aiModels(): Promise<Array<{ name: string; size: number; modifiedAt: string }>>;
      aiChat(messages: Array<{ role: 'user' | 'assistant'; content: string }>, context: string, model?: string): Promise<{ provider: string; answer: string; model: string; local: boolean }>;
      aiHelp(message: string, context: string): Promise<{ provider: string; answer: string; model?: string; local?: boolean }>;
      getAppDataPath(): Promise<string>;
    };
    __forgeInput?: Set<string>;
  }
}
