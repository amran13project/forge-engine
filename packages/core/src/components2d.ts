import { ForgeComponent } from './component.js';

export class ForgeSpriteRendererComponent extends ForgeComponent {
  readonly type = 'SpriteRenderer';
  color = '#6f9cff';
  width = 1;
  height = 1;
  sortingLayer = 0;
  opacity = 1;

  serialize() {
    return {
      type: this.type,
      enabled: this.enabled,
      properties: {
        color: this.color,
        width: this.width,
        height: this.height,
        sortingLayer: this.sortingLayer,
        opacity: this.opacity,
      },
    };
  }
}
