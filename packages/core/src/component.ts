export abstract class ForgeComponent {
  enabled = true;
  abstract readonly type: string;

  serialize(): { type: string; enabled: boolean; properties: Record<string, unknown> } {
    return { type: this.type, enabled: this.enabled, properties: {} };
  }
}

export class ForgeBehaviour extends ForgeComponent {
  readonly type = 'ForgeBehaviour';

  start(): void {}
  update(_delta: number): void {}
}
