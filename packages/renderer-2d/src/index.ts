import {
  ForgeGameObject,
  ForgeScene,
  ForgeSpriteRendererComponent,
} from '@forge/core';

type Tool = 'select' | 'move' | 'rotate' | 'scale';

type Callbacks = {
  onSelect: (id: string | null) => void;
  onTransform: (id: string, position: { x: number; y: number }, rotation: number, scale: { x: number; y: number }) => void;
  onStats: (stats: { fps: number; objects: number; drawCalls: number; frameTime: number }) => void;
};

export class ForgeTwoDSceneView {
  private readonly host: HTMLElement;
  private readonly callbacks: Callbacks;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private scene: ForgeScene | null = null;
  private selectedId: string | null = null;
  private tool: Tool = 'select';
  private grid = true;
  private scale = 60;
  private pan = { x: 0, y: 0 };
  private dragging = false;
  private panning = false;
  private dragStart = { x: 0, y: 0 };
  private original = { x: 0, y: 0, r: 0, sx: 1, sy: 1 };
  private raf = 0;
  private frames = 0;
  private statsStarted = performance.now();
  private destroyed = false;

  constructor(host: HTMLElement, callbacks: Callbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'forge-2d-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.host.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.canvas.addEventListener('pointerdown', this.pointerDown);
    this.canvas.addEventListener('wheel', this.wheel, { passive: false });
    window.addEventListener('pointermove', this.pointerMove);
    window.addEventListener('pointerup', this.pointerUp);
    this.resize();
    this.render = this.render.bind(this);
    this.raf = requestAnimationFrame(this.render);
  }

  setTool(tool: Tool) { this.tool = tool; }
  setGrid(show: boolean) { this.grid = show; }
  setGameView(_gameView: boolean) {}
  setSpace(_space: 'world' | 'local') {}
  focusSelected() {
    const object = this.selectedId ? this.scene?.find(this.selectedId) : undefined;
    if (!object) return;
    this.pan.x = -object.transform.position.x * this.scale;
    this.pan.y = object.transform.position.y * this.scale;
  }
  sync(scene: ForgeScene, selectedId: string | null) { this.scene = scene; this.selectedId = selectedId; }

  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.pointerDown);
    this.canvas.removeEventListener('wheel', this.wheel);
    window.removeEventListener('pointermove', this.pointerMove);
    window.removeEventListener('pointerup', this.pointerUp);
    this.host.replaceChildren();
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio, 2);
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private pointerDown = (event: PointerEvent) => {
    if (!this.scene) return;
    if (event.button === 1 || event.shiftKey) {
      this.panning = true;
      this.dragStart = { x: event.clientX, y: event.clientY };
      return;
    }
    if (event.button !== 0) return;
    const world = this.screenToWorld(event.clientX, event.clientY);
    const hit = this.pick(world.x, world.y);
    this.callbacks.onSelect(hit?.id ?? null);
    if (!hit || this.tool === 'select') return;
    this.dragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.original = { x: hit.transform.position.x, y: hit.transform.position.y, r: hit.transform.rotation.z, sx: hit.transform.scale.x, sy: hit.transform.scale.y };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private pointerMove = (event: PointerEvent) => {
    if (this.panning) {
      this.pan.x += event.clientX - this.dragStart.x;
      this.pan.y += event.clientY - this.dragStart.y;
      this.dragStart = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!this.dragging || !this.scene || !this.selectedId) return;
    const object = this.scene.find(this.selectedId);
    if (!object) return;
    const dx = (event.clientX - this.dragStart.x) / this.scale;
    const dy = -(event.clientY - this.dragStart.y) / this.scale;
    let x = object.transform.position.x;
    let y = object.transform.position.y;
    let rotation = object.transform.rotation.z;
    let sx = object.transform.scale.x;
    let sy = object.transform.scale.y;
    if (this.tool === 'move') { x = this.original.x + dx; y = this.original.y + dy; }
    if (this.tool === 'rotate') rotation = this.original.r + dx * 60;
    if (this.tool === 'scale') { const next = Math.max(0.05, 1 + dx); sx = this.original.sx * next; sy = this.original.sy * next; }
    this.callbacks.onTransform(this.selectedId, { x, y }, rotation, { x: sx, y: sy });
  };

  private pointerUp = () => { this.dragging = false; this.panning = false; };

  private wheel = (event: WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 0.89;
    this.scale = Math.min(260, Math.max(14, this.scale * factor));
  };

  private screenToWorld(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - rect.width / 2 - this.pan.x) / this.scale,
      y: -(clientY - rect.top - rect.height / 2 - this.pan.y) / this.scale,
    };
  }

  private pick(x: number, y: number): ForgeGameObject | null {
    const objects = this.scene?.getObjects().slice().sort((a, b) => b.transform.position.z - a.transform.position.z) ?? [];
    for (const object of objects) {
      if (!object.active) continue;
      const sprite = object.getComponent<ForgeSpriteRendererComponent>('SpriteRenderer');
      const w = (sprite?.width ?? 1) * Math.max(0.1, object.transform.scale.x);
      const h = (sprite?.height ?? 1) * Math.max(0.1, object.transform.scale.y);
      if (Math.abs(x - object.transform.position.x) <= w / 2 && Math.abs(y - object.transform.position.y) <= h / 2) return object;
    }
    return null;
  }

  private render() {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.render);
    const width = this.host.clientWidth;
    const height = this.host.clientHeight;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.fillStyle = '#12171d';
    this.ctx.fillRect(0, 0, width, height);
    this.drawGrid(width, height);
    this.ctx.save();
    this.ctx.translate(width / 2 + this.pan.x, height / 2 + this.pan.y);
    const objects = this.scene?.getObjects() ?? [];
    for (const object of objects) this.drawObject(object);
    this.ctx.restore();
    this.frames += 1;
    const now = performance.now();
    if (now - this.statsStarted >= 500) {
      const fps = this.frames * 1000 / (now - this.statsStarted);
      this.callbacks.onStats({ fps, objects: objects.length, drawCalls: objects.length, frameTime: 1000 / Math.max(1, fps) });
      this.frames = 0;
      this.statsStarted = now;
    }
  }

  private drawGrid(width: number, height: number) {
    if (!this.grid) return;
    const step = this.scale;
    this.ctx.strokeStyle = '#202832';
    this.ctx.lineWidth = 1;
    const ox = ((width / 2 + this.pan.x) % step + step) % step;
    const oy = ((height / 2 + this.pan.y) % step + step) % step;
    this.ctx.beginPath();
    for (let x = ox; x < width; x += step) { this.ctx.moveTo(x, 0); this.ctx.lineTo(x, height); }
    for (let y = oy; y < height; y += step) { this.ctx.moveTo(0, y); this.ctx.lineTo(width, y); }
    this.ctx.stroke();
    this.ctx.strokeStyle = '#3b4654';
    this.ctx.beginPath(); this.ctx.moveTo(width / 2 + this.pan.x, 0); this.ctx.lineTo(width / 2 + this.pan.x, height); this.ctx.moveTo(0, height / 2 + this.pan.y); this.ctx.lineTo(width, height / 2 + this.pan.y); this.ctx.stroke();
  }

  private drawObject(object: ForgeGameObject) {
    if (!object.active) return;
    const sprite = object.getComponent<ForgeSpriteRendererComponent>('SpriteRenderer');
    const x = object.transform.position.x * this.scale;
    const y = -object.transform.position.y * this.scale;
    const w = (sprite?.width ?? 0.8) * this.scale * object.transform.scale.x;
    const h = (sprite?.height ?? 0.8) * this.scale * object.transform.scale.y;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(-object.transform.rotation.z * Math.PI / 180);
    this.ctx.globalAlpha = sprite?.opacity ?? 1;
    this.ctx.fillStyle = sprite?.color ?? '#56677d';
    this.ctx.strokeStyle = object.id === this.selectedId ? '#83aaff' : '#334152';
    this.ctx.lineWidth = object.id === this.selectedId ? 2.5 : 1;
    this.ctx.fillRect(-w / 2, -h / 2, w, h);
    this.ctx.strokeRect(-w / 2, -h / 2, w, h);
    this.ctx.globalAlpha = 1;
    if (object.id === this.selectedId) {
      this.ctx.strokeStyle = '#83aaff'; this.ctx.setLineDash([5, 4]); this.ctx.strokeRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8); this.ctx.setLineDash([]);
    }
    this.ctx.restore();
  }
}
