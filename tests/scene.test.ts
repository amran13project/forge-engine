import { describe, expect, it } from 'vitest';
import { ForgeCameraComponent, ForgeLightComponent, ForgeMeshRendererComponent, ForgeScene, ForgeScriptComponent, ForgeSpriteRendererComponent } from '@forge/core';

describe('ForgeScene', () => {
  it('creates, serializes and reloads objects with hierarchy', () => {
    const scene = new ForgeScene('Test');
    const parent = scene.createObject('Parent');
    const child = scene.createObject('Child');
    scene.reparent(child.id, parent.id);
    child.transform.position.x = 4;
    const data = scene.serialize();
    const restored = ForgeScene.deserialize(data);
    const restoredParent = restored.find(parent.id)!;
    const restoredChild = restored.find(child.id)!;
    expect(restored.getObjects()).toHaveLength(2);
    expect(restoredParent.children[0].id).toBe(restoredChild.id);
    expect(restoredChild.transform.position.x).toBe(4);
  });

  it('saves and reloads ten objects deterministically', () => {
    const scene = new ForgeScene('Ten');
    for (let i = 0; i < 10; i++) scene.createObject(`Object ${i + 1}`);
    const restored = ForgeScene.deserialize(scene.serialize());
    expect(restored.getObjects()).toHaveLength(10);
    expect(restored.getRootObjects()).toHaveLength(10);
  });

  it('duplicates a subtree with new ids', () => {
    const scene = new ForgeScene();
    const root = scene.createObject('Root');
    const child = scene.createObject('Child');
    scene.reparent(child.id, root.id);
    const clone = scene.duplicateObject(root.id);
    expect(clone.id).not.toBe(root.id);
    expect(clone.children).toHaveLength(1);
    expect(scene.getObjects()).toHaveLength(4);
  });
});


describe('Forge 3D components', () => {
  it('serializes and restores primitive, camera and light components', () => {
    const scene = new ForgeScene('3D');
    const cube = scene.createObject('Cube');
    const mesh = cube.addComponent(new ForgeMeshRendererComponent());
    mesh.primitive = 'sphere';
    mesh.color = '#ff8844';
    const camera = scene.createObject('Camera');
    camera.addComponent(new ForgeCameraComponent()).primary = true;
    const light = scene.createObject('Light');
    light.addComponent(new ForgeLightComponent()).kind = 'point';
    const restored = ForgeScene.deserialize(scene.serialize());
    expect(restored.find(cube.id)?.getComponent('MeshRenderer')).toBeTruthy();
    expect((restored.find(cube.id)?.getComponent('MeshRenderer') as ForgeMeshRendererComponent).primitive).toBe('sphere');
    expect((restored.find(camera.id)?.getComponent('Camera') as ForgeCameraComponent).primary).toBe(true);
    expect((restored.find(light.id)?.getComponent('Light') as ForgeLightComponent).kind).toBe('point');
  });
});


describe('Forge 0.4 modes and scripts', () => {
  it('serializes a 2D scene mode and SpriteRenderer', () => {
    const scene = new ForgeScene('2D Main', undefined, '2D');
    const player = scene.createObject('Player');
    player.addComponent(new ForgeSpriteRendererComponent()).width = 1.5;
    const restored = ForgeScene.deserialize(scene.serialize());
    expect(restored.mode).toBe('2D');
    expect(restored.find(player.id)?.getComponent('SpriteRenderer')).toBeTruthy();
  });

  it('serializes script component metadata', () => {
    const scene = new ForgeScene('Scripts');
    const player = scene.createObject('Player');
    const script = player.addComponent(new ForgeScriptComponent());
    script.scriptPath = 'Scripts/Player.ts';
    script.className = 'Player';
    const restored = ForgeScene.deserialize(scene.serialize());
    const restoredScript = restored.find(player.id)?.getComponent<ForgeScriptComponent>('Script');
    expect(restoredScript?.scriptPath).toBe('Scripts/Player.ts');
    expect(restoredScript?.className).toBe('Player');
  });
});
