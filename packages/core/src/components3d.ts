import { ForgeComponent } from './component.js';

export type ForgePrimitive = 'cube' | 'sphere' | 'capsule' | 'cylinder' | 'plane';

export class ForgeMeshRendererComponent extends ForgeComponent {
  readonly type = 'MeshRenderer';
  primitive: ForgePrimitive = 'cube';
  color = '#7aa2ff';
  wireframe = false;
  castShadow = true;
  receiveShadow = true;
  size = 1;

  serialize() {
    return {
      type: this.type,
      enabled: this.enabled,
      properties: {
        primitive: this.primitive,
        color: this.color,
        wireframe: this.wireframe,
        castShadow: this.castShadow,
        receiveShadow: this.receiveShadow,
        size: this.size,
      },
    };
  }
}

export class ForgeCameraComponent extends ForgeComponent {
  readonly type = 'Camera';
  projection: 'perspective' | 'orthographic' = 'perspective';
  fov = 60;
  near = 0.1;
  far = 1000;
  primary = false;

  serialize() {
    return {
      type: this.type,
      enabled: this.enabled,
      properties: {
        projection: this.projection,
        fov: this.fov,
        near: this.near,
        far: this.far,
        primary: this.primary,
      },
    };
  }
}

export type ForgeLightType = 'directional' | 'point' | 'spot' | 'ambient';

export class ForgeLightComponent extends ForgeComponent {
  readonly type = 'Light';
  kind: ForgeLightType = 'directional';
  color = '#ffffff';
  intensity = 2;
  range = 10;
  castShadow = true;

  serialize() {
    return {
      type: this.type,
      enabled: this.enabled,
      properties: {
        kind: this.kind,
        color: this.color,
        intensity: this.intensity,
        range: this.range,
        castShadow: this.castShadow,
      },
    };
  }
}
