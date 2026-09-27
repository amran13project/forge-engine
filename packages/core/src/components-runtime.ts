import { ForgeComponent } from './component.js';

export type ForgeBodyType = 'dynamic' | 'fixed' | 'kinematicPositionBased';

export class ForgeRigidBodyComponent extends ForgeComponent {
  readonly type = 'Rigidbody';
  bodyType: ForgeBodyType = 'dynamic';
  mass = 1;
  gravityScale = 1;
  lockRotation = false;

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: {
      bodyType: this.bodyType, mass: this.mass, gravityScale: this.gravityScale, lockRotation: this.lockRotation,
    }};
  }
}

export class ForgeBoxColliderComponent extends ForgeComponent {
  readonly type = 'BoxCollider';
  size = { x: 1, y: 1, z: 1 };
  isTrigger = false;
  friction = 0.5;
  restitution = 0.1;

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: {
      size: { ...this.size }, isTrigger: this.isTrigger, friction: this.friction, restitution: this.restitution,
    }};
  }
}

export type ForgeAnimationKeyframe = {
  time: number;
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
};
export type ForgeAnimationClip = { name: string; length: number; loop: boolean; keyframes: ForgeAnimationKeyframe[] };

export class ForgeAnimationComponent extends ForgeComponent {
  readonly type = 'Animator';
  playing = false;
  clip = '';
  speed = 1;
  clips: ForgeAnimationClip[] = [];

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: {
      playing: this.playing, clip: this.clip, speed: this.speed, clips: this.clips,
    }};
  }
}

export class ForgeAudioSourceComponent extends ForgeComponent {
  readonly type = 'AudioSource';
  clipPath = '';
  volume = 1;
  loop = false;
  autoplay = false;
  spatial = false;
  rate = 1;

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: {
      clipPath: this.clipPath, volume: this.volume, loop: this.loop, autoplay: this.autoplay, spatial: this.spatial, rate: this.rate,
    }};
  }
}

export type ForgeVisualNodeType = 'OnStart' | 'OnUpdate' | 'Translate' | 'Rotate' | 'SetScale' | 'Log' | 'Branch';
export type ForgeVisualNode = { id: string; type: ForgeVisualNodeType; x: number; y: number; values?: Record<string, string | number | boolean> };
export type ForgeVisualConnection = { from: string; to: string };
export type ForgeVisualGraph = { nodes: ForgeVisualNode[]; connections: ForgeVisualConnection[]; variables: Record<string, number | string | boolean> };

export class ForgeVisualScriptComponent extends ForgeComponent {
  readonly type = 'VisualScript';
  graphPath = 'Scripts/Main.forge-graph.json';
  autoRun = true;

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: { graphPath: this.graphPath, autoRun: this.autoRun } };
  }
}

export class ForgePrefabLinkComponent extends ForgeComponent {
  readonly type = 'PrefabLink';
  prefabPath = '';
  sourceHash = '';
  instance = true;
  overrides: Record<string, unknown> = {};

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: {
      prefabPath: this.prefabPath, sourceHash: this.sourceHash, instance: this.instance, overrides: this.overrides,
    }};
  }
}

export class ForgeRuntimeUIComponent extends ForgeComponent {
  readonly type = 'RuntimeUI';
  kind: 'text' | 'button' | 'panel' | 'image' = 'text';
  text = 'Forge UI';
  x = 24;
  y = 24;
  width = 180;
  height = 44;
  visible = true;
  action = '';

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: {
      kind: this.kind, text: this.text, x: this.x, y: this.y, width: this.width, height: this.height, visible: this.visible, action: this.action,
    }};
  }
}
