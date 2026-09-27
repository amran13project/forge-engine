import RAPIER from '@dimforge/rapier3d-compat';
import { ForgeBoxColliderComponent, ForgeGameObject, ForgeRigidBodyComponent, ForgeScene } from '@forge/core';

export class ForgePhysicsRuntime {
  private world: RAPIER.World | null = null;
  private bodies = new Map<string, RAPIER.RigidBody>();
  private initialized = false;

  async init() {
    if (!this.initialized) { await RAPIER.init(); this.initialized = true; }
  }

  async rebuild(scene: ForgeScene) {
    await this.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.bodies.clear();
    for (const object of scene.getObjects()) {
      if (!object.active) continue;
      const bodyCfg = object.getComponent<ForgeRigidBodyComponent>('Rigidbody');
      const colliderCfg = object.getComponent<ForgeBoxColliderComponent>('BoxCollider');
      if (!bodyCfg && !colliderCfg) continue;
      const rigid = bodyCfg?.bodyType === 'fixed'
        ? RAPIER.RigidBodyDesc.fixed()
        : bodyCfg?.bodyType === 'kinematicPositionBased'
          ? RAPIER.RigidBodyDesc.kinematicPositionBased()
          : RAPIER.RigidBodyDesc.dynamic();
      rigid.setTranslation(object.transform.position);
      rigid.setRotation({ x: 0, y: 0, z: 0, w: 1 });
      if (bodyCfg) { rigid.setGravityScale(bodyCfg.gravityScale); rigid.setAdditionalMass(bodyCfg.mass); if (bodyCfg.lockRotation) rigid.setEnabledRotations(false, false, false); }
      const body = this.world.createRigidBody(rigid);
      this.bodies.set(object.id, body);
      if (colliderCfg) {
        const size = colliderCfg.size;
        const collider = RAPIER.ColliderDesc.cuboid(Math.max(0.01, size.x / 2), Math.max(0.01, size.y / 2), Math.max(0.01, size.z / 2))
          .setSensor(colliderCfg.isTrigger)
          .setFriction(colliderCfg.friction)
          .setRestitution(colliderCfg.restitution);
        this.world.createCollider(collider, body);
      }
    }
  }

  step(scene: ForgeScene, delta: number) {
    if (!this.world) return;
    this.world.timestep = Math.min(1 / 20, Math.max(1 / 240, delta));
    this.world.step();
    for (const object of scene.getObjects()) {
      const body = this.bodies.get(object.id);
      const cfg = object.getComponent<ForgeRigidBodyComponent>('Rigidbody');
      if (!body || !cfg || cfg.bodyType === 'fixed' || cfg.bodyType === 'kinematicPositionBased') continue;
      const p = body.translation();
      object.transform.position = { x: p.x, y: p.y, z: p.z };
      if (cfg.lockRotation) object.transform.rotation = { ...object.transform.rotation, y: object.transform.rotation.y };
    }
  }

  clear() { this.world = null; this.bodies.clear(); }
}

export function ensureDefaultPhysics(object: ForgeGameObject) {
  if (!object.getComponent('Rigidbody')) object.addComponent(new ForgeRigidBodyComponent());
  if (!object.getComponent('BoxCollider')) object.addComponent(new ForgeBoxColliderComponent());
}
