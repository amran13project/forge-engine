import ts from 'typescript';
import { ForgeGameObject, ForgeScene } from '@forge/core';

export type ScriptCompileResult = {
  javascript: string;
  diagnostics: string[];
};

type RuntimeInstance = {
  objectId: string;
  behavior: { start?: () => void; update?: (delta: number) => void };
};

export const DEFAULT_SCRIPT_3D = `class Player extends ForgeBehaviour {
  start() {
    Forge.log.info("3D Player script started");
  }

  update(delta: number) {
    this.transform.rotation.y += 45 * delta;
  }
}
`;

export const DEFAULT_SCRIPT_2D = `class Player extends ForgeBehaviour {
  start() {
    Forge.log.info("2D Player script started");
  }

  update(delta: number) {
    this.transform.position.x += Forge.Input.getAxis("Horizontal") * 3 * delta;
    this.transform.position.y += Forge.Input.getAxis("Vertical") * 3 * delta;
  }
}
`;

export const DEFAULT_SCRIPT = DEFAULT_SCRIPT_3D;

export function getDefaultScript(mode: '2D' | '3D', className: string) {
  return (mode === '2D' ? DEFAULT_SCRIPT_2D : DEFAULT_SCRIPT_3D).replace(/class Player/, `class ${makeClassNameSafe(className)}`);
}

export function compileForgeScript(source: string): ScriptCompileResult {
  const result = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
      strict: true,
      experimentalDecorators: false,
      useDefineForClassFields: true,
    },
  });
  const diagnostics = (result.diagnostics ?? []).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
    if (diagnostic.file && diagnostic.start !== undefined) {
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      return `Line ${position.line + 1}:${position.character + 1} — ${message}`;
    }
    return message;
  });
  return { javascript: result.outputText, diagnostics };
}

export function makeClassNameSafe(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_$]/g, '');
  if (!cleaned) return 'Player';
  return /^[0-9]/.test(cleaned) ? `Script${cleaned}` : cleaned;
}

export function executeForgeScript(source: string, className: string, object: ForgeGameObject, log: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void) {
  const compiled = compileForgeScript(source);
  if (compiled.diagnostics.length) return { ...compiled, instance: null };

  const errors = (message: unknown) => log('ERROR', message instanceof Error ? message.message : String(message));
  const objectApi = {
    get name() { return object.name; },
    get active() { return object.active; },
    set active(value: boolean) { object.active = value; },
    transform: object.transform,
    getComponent: <T>(type: string) => object.getComponent<T>(type),
  };
  class ForgeBehaviour {
    readonly gameObject = objectApi;
    readonly transform = object.transform;
  }
  const Forge = {
    Input: {
      isKeyDown: (key: string) => window.__forgeInput?.has(key.toLowerCase()) ?? false,
      getAxis: (axis: string) => {
        if (axis.toLowerCase() === 'horizontal') return (window.__forgeInput?.has('d') || window.__forgeInput?.has('arrowright') ? 1 : 0) + (window.__forgeInput?.has('a') || window.__forgeInput?.has('arrowleft') ? -1 : 0);
        if (axis.toLowerCase() === 'vertical') return (window.__forgeInput?.has('w') || window.__forgeInput?.has('arrowup') ? 1 : 0) + (window.__forgeInput?.has('s') || window.__forgeInput?.has('arrowdown') ? -1 : 0);
        return 0;
      },
    },
    Time: { deltaTime: 0, frame: 0 },
    log: { info: (message: unknown) => log('INFO', String(message)), warn: (message: unknown) => log('WARN', String(message)), error: errors },
    Scene: { getName: () => objectApi.name },
  };

  const capture = `\n;globalThis.__forgeCapturedClass = typeof ${makeClassNameSafe(className)} !== 'undefined' ? ${makeClassNameSafe(className)} : undefined;`;
  try {
    const run = new Function('Forge', 'ForgeBehaviour', `${compiled.javascript}${capture}`);
    run(Forge, ForgeBehaviour);
    const ctor = (globalThis as typeof globalThis & { __forgeCapturedClass?: new (ctx?: unknown) => { start?: () => void; update?: (delta: number) => void } }).__forgeCapturedClass;
    delete (globalThis as typeof globalThis & { __forgeCapturedClass?: unknown }).__forgeCapturedClass;
    if (!ctor) return { ...compiled, instance: null, diagnostics: [`Class '${className}' was not found after compilation.`] };
    return { ...compiled, instance: new ctor() };
  } catch (error) {
    errors(error);
    return { ...compiled, diagnostics: [error instanceof Error ? error.message : String(error)], instance: null };
  }
}

export class ForgeScriptRuntime {
  private readonly instances = new Map<string, RuntimeInstance>();
  private frame = 0;

  async start(projectRoot: string, scene: ForgeScene, readScript: (root: string, path: string) => Promise<string>, log: (level: 'INFO' | 'WARN' | 'ERROR', message: string) => void) {
    this.instances.clear();
    this.frame = 0;
    for (const object of scene.getObjects()) {
      const component = object.getComponent<{ enabled: boolean; scriptPath: string; className: string; autoRun: boolean }>('Script');
      if (!component?.enabled || !component.autoRun) continue;
      try {
        const source = await readScript(projectRoot, component.scriptPath);
        const result = executeForgeScript(source, component.className, object, log);
        if (result.diagnostics.length) {
          for (const diagnostic of result.diagnostics) log('ERROR', `${component.scriptPath}: ${diagnostic}`);
          continue;
        }
        if (result.instance) {
          this.instances.set(object.id, { objectId: object.id, behavior: result.instance });
          result.instance.start?.();
        }
      } catch (error) {
        log('ERROR', `${component.scriptPath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  update(scene: ForgeScene, delta: number) {
    this.frame += 1;
    for (const instance of this.instances.values()) {
      const object = scene.find(instance.objectId);
      if (!object || !object.active) continue;
      instance.behavior.update?.(delta);
    }
    window.__forgeRuntimeFrame = this.frame;
  }

  clear() { this.instances.clear(); }
}

declare global {
  interface Window {
    __forgeInput?: Set<string>;
    __forgeRuntimeFrame?: number;
  }
}
