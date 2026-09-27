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
      getAppDataPath(): Promise<string>;
    };
  }
}
