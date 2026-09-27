import type { ForgeSceneData } from '../../shared/src/index.js';
import { ForgeGameObject } from './game-object.js';
import { componentFactories } from './components.js';
import { createForgeId } from './id.js';
import type { ForgeProjectMode } from '../../shared/src/index.js';

export class ForgeScene {
  readonly id: string;
  name: string;
  mode: ForgeProjectMode;
  private objects = new Map<string, ForgeGameObject>();
  private roots: ForgeGameObject[] = [];

  constructor(name = 'Main', id = createForgeId('scene'), mode: ForgeProjectMode = '3D') {
    this.name = name;
    this.id = id;
    this.mode = mode;
  }

  getObjects(): ForgeGameObject[] { return [...this.objects.values()]; }
  getRootObjects(): ForgeGameObject[] { return [...this.roots]; }
  find(id: string): ForgeGameObject | undefined { return this.objects.get(id); }

  createObject(name = 'GameObject'): ForgeGameObject {
    const object = new ForgeGameObject(name);
    this.objects.set(object.id, object);
    this.roots.push(object);
    return object;
  }

  addObject(object: ForgeGameObject, parent: ForgeGameObject | null = null): void {
    if (this.objects.has(object.id)) throw new Error(`Object id '${object.id}' already exists.`);
    this.objects.set(object.id, object);
    if (parent) parent.addChild(object);
    else this.roots.push(object);
  }

  deleteObject(objectId: string): void {
    const object = this.objects.get(objectId);
    if (!object) return;
    const descendants = [...object.children];
    for (const child of descendants) this.deleteObject(child.id);
    if (object.parent) object.parent.removeChild(object);
    this.roots = this.roots.filter((root) => root.id !== object.id);
    this.objects.delete(object.id);
  }

  duplicateObject(objectId: string): ForgeGameObject {
    const source = this.objects.get(objectId);
    if (!source) throw new Error('Cannot duplicate an unknown object.');
    const clone = source.clone();
    const parent = source.parent;
    this.addObjectTree(clone, parent);
    return clone;
  }

  reparent(objectId: string, parentId: string | null): void {
    const object = this.objects.get(objectId);
    if (!object) throw new Error('Object does not exist.');
    const parent = parentId ? this.objects.get(parentId) : null;
    if (parentId && !parent) throw new Error('Parent object does not exist.');
    object.parent?.removeChild(object);
    this.roots = this.roots.filter((root) => root.id !== object.id);
    if (parent) parent.addChild(object);
    else this.roots.push(object);
  }

  serialize(): ForgeSceneData {
    return {
      version: 3,
      id: this.id,
      name: this.name,
      mode: this.mode,
      objects: this.getObjects().map((object) => object.serialize()),
      rootIds: this.roots.map((root) => root.id),
    };
  }

  static deserialize(data: ForgeSceneData): ForgeScene {
    if (!data || ![1, 2, 3].includes(data.version) || !Array.isArray(data.objects)) {
      throw new Error('Invalid .forge-scene data.');
    }
    const scene = new ForgeScene(data.name, data.id, data.mode ?? '3D');
    const objects = new Map<string, ForgeGameObject>();
    for (const entry of data.objects) {
      const object = new ForgeGameObject(entry.name, entry.id);
      object.active = entry.active;
      object.transform.position = { ...entry.transform.position };
      object.transform.rotation = { ...entry.transform.rotation };
      object.transform.scale = { ...entry.transform.scale };
      for (const serialized of entry.components ?? []) {
        const factory = componentFactories[serialized.type];
        if (!factory) continue;
        const component = factory();
        component.enabled = serialized.enabled;
        Object.assign(component, serialized.properties);
        object.components.push(component);
      }
      objects.set(object.id, object);
      scene.objects.set(object.id, object);
    }
    for (const entry of data.objects) {
      const object = objects.get(entry.id)!;
      if (entry.parentId) {
        const parent = objects.get(entry.parentId);
        if (!parent) throw new Error(`Missing parent '${entry.parentId}'.`);
        parent.addChild(object);
      }
    }
    scene.roots = data.rootIds.map((id) => objects.get(id)).filter((v): v is ForgeGameObject => !!v);
    return scene;
  }

  private addObjectTree(object: ForgeGameObject, parent: ForgeGameObject | null): void {
    this.objects.set(object.id, object);
    object.children.forEach((child) => this.addObjectTree(child, object));
    if (parent) parent.addChild(object);
    else this.roots.push(object);
  }
}
