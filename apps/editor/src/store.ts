import { create } from 'zustand';
import {
  ForgeCameraComponent,
  ForgeGameObject,
  ForgeLightComponent,
  ForgeMeshRendererComponent,
  ForgeMetadataComponent,
  ForgeScriptComponent,
  ForgeSpriteRendererComponent,
  ForgeScene,
  ForgeTagComponent,
  type ForgePrimitive,
} from '@forge/core';

export type EditorMode = 'editor' | 'play';
export type ProjectInfo = { root: string; name: string; mainScene: string; mode: '2D' | '3D' };
type LogEntry = { id: number; level: 'INFO' | 'WARN' | 'ERROR'; message: string };

type EditorState = {
  scene: ForgeScene | null;
  project: ProjectInfo | null;
  selectedId: string | null;
  mode: EditorMode;
  runtimePaused: boolean;
  runtimeFrame: number;
  dirty: boolean;
  logs: LogEntry[];
  version: number;
  history: string[];
  future: string[];
  stats: { fps: number; objects: number; drawCalls: number; frameTime: number };
  runtimeSnapshot: string | null;
  setProject: (project: ProjectInfo) => void;
  setScene: (scene: ForgeScene) => void;
  select: (id: string | null) => void;
  mutate: (operation: (scene: ForgeScene) => void) => void;
  undo: () => void;
  redo: () => void;
  setMode: (mode: EditorMode) => void;
  setRuntimePaused: (paused: boolean) => void;
  beginPlay: () => void;
  stopPlay: () => void;
  runtimeMutate: (operation: (scene: ForgeScene) => void) => void;
  stepRuntime: () => void;
  setStats: (stats: EditorState['stats']) => void;
  log: (level: LogEntry['level'], message: string) => void;
  markSaved: () => void;
};

let logId = 0;

export const useEditorStore = create<EditorState>((set) => ({
  scene: null,
  project: null,
  selectedId: null,
  mode: 'editor',
  runtimePaused: false,
  runtimeFrame: 0,
  dirty: false,
  logs: [],
  version: 0,
  history: [],
  future: [],
  stats: { fps: 0, objects: 0, drawCalls: 0, frameTime: 0 },
  runtimeSnapshot: null,
  setProject: (project) => set({ project }),
  setScene: (scene) => set({ scene, dirty: false, selectedId: null, mode: 'editor', runtimePaused: false, runtimeFrame: 0, version: 0, history: [], future: [], runtimeSnapshot: null }),
  select: (id) => set({ selectedId: id }),
  mutate: (operation) => set((state) => {
    if (!state.scene || state.mode === 'play') return state;
    const before = JSON.stringify(state.scene.serialize());
    operation(state.scene);
    return {
      dirty: true,
      version: state.version + 1,
      history: [...state.history, before].slice(-100),
      future: [],
    };
  }),
  undo: () => set((state) => {
    if (!state.scene || state.history.length === 0 || state.mode === 'play') return state;
    const previous = state.history[state.history.length - 1];
    const current = JSON.stringify(state.scene.serialize());
    return {
      scene: ForgeScene.deserialize(JSON.parse(previous)),
      dirty: true,
      version: state.version + 1,
      history: state.history.slice(0, -1),
      future: [current, ...state.future].slice(0, 100),
      selectedId: null,
    };
  }),
  redo: () => set((state) => {
    if (!state.scene || state.future.length === 0 || state.mode === 'play') return state;
    const next = state.future[0];
    const current = JSON.stringify(state.scene.serialize());
    return {
      scene: ForgeScene.deserialize(JSON.parse(next)),
      dirty: true,
      version: state.version + 1,
      history: [...state.history, current].slice(-100),
      future: state.future.slice(1),
      selectedId: null,
    };
  }),
  setMode: (mode) => set({ mode, runtimePaused: false, runtimeFrame: 0 }),
  beginPlay: () => set((state) => state.scene ? ({ mode: 'play', runtimePaused: false, runtimeFrame: 0, runtimeSnapshot: JSON.stringify(state.scene.serialize()), version: state.version + 1 }) : state),
  stopPlay: () => set((state) => state.runtimeSnapshot ? ({ scene: ForgeScene.deserialize(JSON.parse(state.runtimeSnapshot)), mode: 'editor', runtimePaused: false, runtimeFrame: 0, runtimeSnapshot: null, version: state.version + 1, dirty: false, selectedId: state.selectedId }) : ({ mode: 'editor', runtimePaused: false, runtimeFrame: 0 })),
  runtimeMutate: (operation) => set((state) => { if (!state.scene || state.mode !== 'play') return state; operation(state.scene); return { version: state.version + 1 }; }),
  setRuntimePaused: (paused) => set({ runtimePaused: paused }),
  stepRuntime: () => set((state) => state.mode === 'play' ? { runtimeFrame: state.runtimeFrame + 1, runtimePaused: true } : state),
  setStats: (stats) => set({ stats }),
  log: (level, message) => set((state) => ({ logs: [...state.logs, { id: ++logId, level, message }].slice(-300) })),
  markSaved: () => set({ dirty: false }),
}));

export function addDefaultComponent(object: ForgeGameObject, type: string) {
  switch (type) {
    case 'Tag': object.addComponent(new ForgeTagComponent()); break;
    case 'Metadata': object.addComponent(new ForgeMetadataComponent()); break;
    case 'Script': object.addComponent(new ForgeScriptComponent()); break;
    case 'SpriteRenderer': object.addComponent(new ForgeSpriteRendererComponent()); break;
    case 'MeshRenderer': object.addComponent(new ForgeMeshRendererComponent()); break;
    case 'Camera': object.addComponent(new ForgeCameraComponent()); break;
    case 'Light': object.addComponent(new ForgeLightComponent()); break;
    default: throw new Error(`Unknown component type: ${type}`);
  }
  return object;
}

export function createPrimitive(scene: ForgeScene, primitive: ForgePrimitive, name = primitive[0].toUpperCase() + primitive.slice(1)) {
  const object = scene.createObject(name);
  const mesh = object.addComponent(new ForgeMeshRendererComponent());
  mesh.primitive = primitive;
  return object;
}

export function createCamera(scene: ForgeScene, name = 'Main Camera') {
  const object = scene.createObject(name);
  object.transform.position = { x: 0, y: 2.2, z: 7 };
  object.transform.rotation = { x: -8, y: 0, z: 0 };
  const camera = object.addComponent(new ForgeCameraComponent());
  camera.projection = scene.mode === '2D' ? 'orthographic' : 'perspective';
  camera.primary = scene.getObjects().every((entry) => !entry.getComponent('Camera'));
  return object;
}

export function createLight(scene: ForgeScene, kind: ForgeLightComponent['kind'] = 'directional', name = 'Directional Light') {
  const object = scene.createObject(name);
  object.transform.position = { x: 4, y: 6, z: 4 };
  object.transform.rotation = { x: -35, y: 35, z: 0 };
  const light = object.addComponent(new ForgeLightComponent());
  light.kind = kind;
  return object;
}
