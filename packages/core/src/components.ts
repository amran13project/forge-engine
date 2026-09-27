import { ForgeComponent } from './component.js';
import { ForgeCameraComponent, ForgeLightComponent, ForgeMeshRendererComponent } from './components3d.js';
import { ForgeSpriteRendererComponent } from './components2d.js';
import { ForgeRigidBodyComponent, ForgeBoxColliderComponent, ForgeAnimationComponent, ForgeAudioSourceComponent, ForgeVisualScriptComponent, ForgePrefabLinkComponent, ForgeRuntimeUIComponent } from './components-runtime.js';

export class ForgeTagComponent extends ForgeComponent {
  readonly type = 'Tag';
  tag = 'Untagged';

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: { tag: this.tag } };
  }
}

export class ForgeScriptComponent extends ForgeComponent {
  readonly type = 'Script';
  scriptPath = 'Scripts/Player.ts';
  className = 'Player';
  autoRun = true;

  serialize() {
    return {
      type: this.type,
      enabled: this.enabled,
      properties: { scriptPath: this.scriptPath, className: this.className, autoRun: this.autoRun },
    };
  }
}

export class ForgeMetadataComponent extends ForgeComponent {
  readonly type = 'Metadata';
  notes = '';

  serialize() {
    return { type: this.type, enabled: this.enabled, properties: { notes: this.notes } };
  }
}

export const componentFactories: Record<string, () => ForgeComponent> = {
  Tag: () => new ForgeTagComponent(),
  Metadata: () => new ForgeMetadataComponent(),
  Script: () => new ForgeScriptComponent(),
  SpriteRenderer: () => new ForgeSpriteRendererComponent(),
  MeshRenderer: () => new ForgeMeshRendererComponent(),
  Camera: () => new ForgeCameraComponent(),
  Light: () => new ForgeLightComponent(),
  Rigidbody: () => new ForgeRigidBodyComponent(),
  BoxCollider: () => new ForgeBoxColliderComponent(),
  Animator: () => new ForgeAnimationComponent(),
  AudioSource: () => new ForgeAudioSourceComponent(),
  VisualScript: () => new ForgeVisualScriptComponent(),
  PrefabLink: () => new ForgePrefabLinkComponent(),
  RuntimeUI: () => new ForgeRuntimeUIComponent(),
};
