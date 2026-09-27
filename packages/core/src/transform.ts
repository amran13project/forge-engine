import type { Vector3 } from '../../shared/src/index.js';

export class ForgeTransform {
  position: Vector3 = { x: 0, y: 0, z: 0 };
  rotation: Vector3 = { x: 0, y: 0, z: 0 };
  scale: Vector3 = { x: 1, y: 1, z: 1 };

  clone(): ForgeTransform {
    const next = new ForgeTransform();
    next.position = { ...this.position };
    next.rotation = { ...this.rotation };
    next.scale = { ...this.scale };
    return next;
  }
}
