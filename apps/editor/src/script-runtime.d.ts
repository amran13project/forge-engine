import { ForgeGameObject, ForgeScene } from '@forge/core';
export type ScriptCompileResult = {
    javascript: string;
    diagnostics: string[];
};
export declare const DEFAULT_SCRIPT = "class Player extends ForgeBehaviour {\n  start() {\n    Forge.log.info(\"Player script started\");\n  }\n\n  update(delta: number) {\n    this.transform.rotation.y += 45 * delta;\n  }\n}\n";
export declare function compileForgeScript(source: string): ScriptCompileResult;
export declare function makeClassNameSafe(value: string): string;
export declare function executeForgeScript(source: string, className: string, object: ForgeGameObject, log: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void): {
    instance: null;
    javascript: string;
    diagnostics: string[];
} | {
    instance: {
        start?: () => void;
        update?: (delta: number) => void;
    };
    javascript: string;
    diagnostics: string[];
};
export declare class ForgeScriptRuntime {
    private readonly instances;
    private frame;
    start(projectRoot: string, scene: ForgeScene, readScript: (root: string, path: string) => Promise<string>, log: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void): Promise<void>;
    update(scene: ForgeScene, delta: number): void;
    clear(): void;
}
declare global {
    interface Window {
        __forgeInput?: Set<string>;
        __forgeRuntimeFrame?: number;
    }
}
