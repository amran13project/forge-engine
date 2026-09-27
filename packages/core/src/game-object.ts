import type { ForgeGameObjectData } from '../../shared/src/index.js';
import { createForgeId } from './id.js';
import { ForgeTransform } from './transform.js';
import { ForgeComponent } from './component.js';
import { componentFactories } from './components.js';

export class ForgeGameObject {
  readonly id: string;
  name: string;
  active = true;
  parent: ForgeGameObject | null = null;
  children: ForgeGameObject[] = [];
  readonly transform: ForgeTransform;
  readonly components: ForgeComponent[];

  constructor(name = 'GameObject', id = createForgeId()) {
    this.id = id;
    this.name = name;
    this.transform = new ForgeTransform();
    this.components = [];
  }

  addComponent(component: ForgeComponent): ForgeComponent {
    if (this.components.some((entry) => entry.type === component.type)) {
      throw new Error(`Component '${component.type}' is already attached to ${this.name}.`);
    }
    this.components.push(component);
    return component;
  }

  removeComponent(type: string): void {
    const index = this.components.findIndex((entry) => entry.type === type);
    if (index === -1) throw new Error(`Component '${type}' is not attached to ${this.name}.`);
    this.components.splice(index, 1);
  }

  getComponent<T extends ForgeComponent>(type: string): T | undefined {
    return this.components.find((entry) => entry.type === type) as T | undefined;
  }

  addChild(child: ForgeGameObject): void {
    if (child === this) throw new Error('An object cannot parent itself.');
    let cursor: ForgeGameObject | null = this;
    while (cursor) {
      if (cursor === child) throw new Error('Cannot create a parenting cycle.');
      cursor = cursor.parent;
    }
    child.parent?.removeChild(child);
    child.parent = this;
    this.children.push(child);
  }

  removeChild(child: ForgeGameObject): void {
    const index = this.children.indexOf(child);
    if (index === -1) return;
    this.children.splice(index, 1);
    child.parent = null;
  }

  clone(): ForgeGameObject {
    const copy = new ForgeGameObject(this.name, createForgeId('clone'));
    copy.active = this.active;
    copy.transform.position = { ...this.transform.position };
    copy.transform.rotation = { ...this.transform.rotation };
    copy.transform.scale = { ...this.transform.scale };
    for (const component of this.components) {
      const factory = componentFactories[component.type];
      if (!factory) continue;
      const cloned = factory();
      cloned.enabled = component.enabled;
      Object.assign(cloned, component);
      copy.components.push(cloned);
    }
    for (const child of this.children) copy.addChild(child.clone());
    return copy;
  }

  serialize(): ForgeGameObjectData {
    return {
      id: this.id,
      name: this.name,
      active: this.active,
      parentId: this.parent?.id ?? null,
      transform: {
        position: { ...this.transform.position },
        rotation: { ...this.transform.rotation },
        scale: { ...this.transform.scale },
      },
      components: this.components.map((component) => component.serialize()),
      childrenIds: this.children.map((child) => child.id),
    };
  }
}
