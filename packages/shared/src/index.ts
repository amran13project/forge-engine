export type ForgeId = string;
export type ForgeProjectMode = '2D' | '3D';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SerializableComponent {
  type: string;
  enabled: boolean;
  properties: Record<string, unknown>;
}

export interface ForgeGameObjectData {
  id: ForgeId;
  name: string;
  active: boolean;
  parentId: ForgeId | null;
  transform: {
    position: Vector3;
    rotation: Vector3;
    scale: Vector3;
  };
  components: SerializableComponent[];
  childrenIds: ForgeId[];
}

export interface ForgeSceneData {
  version: 1 | 2 | 3;
  id: ForgeId;
  name: string;
  mode?: ForgeProjectMode;
  objects: ForgeGameObjectData[];
  rootIds: ForgeId[];
}

export interface ForgeProjectData {
  name: string;
  version: 1;
  engineVersion: string;
  mainScene: string;
  mode: ForgeProjectMode;
}
