import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import {
  ForgeGameObject,
  ForgeScene,
  ForgeCameraComponent,
  ForgeLightComponent,
  ForgeMeshRendererComponent,
} from '@forge/core';

type Tool = 'select' | 'move' | 'rotate' | 'scale';

type ViewCallbacks = {
  onSelect: (id: string | null) => void;
  onTransform: (id: string, transform: { position: THREE.Vector3Tuple; rotation: THREE.Vector3Tuple; scale: THREE.Vector3Tuple }) => void;
  onStats: (stats: { fps: number; objects: number; drawCalls: number; frameTime: number }) => void;
};

export class ForgeThreeSceneView {
  private readonly host: HTMLElement;
  private readonly callbacks: ViewCallbacks;
  private readonly scene = new THREE.Scene();
  private readonly editorCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 5000);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly orbit: OrbitControls;
  private readonly transform: TransformControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly root = new THREE.Group();
  private readonly objects = new Map<string, THREE.Object3D>();
  private readonly signatures = new Map<string, string>();
  private readonly grid: THREE.GridHelper;
  private readonly axes: THREE.AxesHelper;
  private readonly clock = new THREE.Clock();
  private lastStats = performance.now();
  private frames = 0;
  private animation = 0;
  private selectedId: string | null = null;
  private tool: Tool = 'select';
  private showGrid = true;
  private gameView = false;
  private latestScene: ForgeScene | null = null;
  private destroyed = false;

  constructor(host: HTMLElement, callbacks: ViewCallbacks) {
    this.host = host;
    this.callbacks = callbacks;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x12161d, 1);
    this.renderer.domElement.className = 'forge-three-canvas';

    this.host.appendChild(this.renderer.domElement);
    this.scene.add(this.root);

    this.grid = new THREE.GridHelper(200, 200, 0x3a4656, 0x222a34);
    this.grid.position.y = 0;
    this.scene.add(this.grid);
    this.axes = new THREE.AxesHelper(3);
    this.scene.add(this.axes);

    const hemi = new THREE.HemisphereLight(0x9dbbff, 0x18202c, 1.5);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(6, 10, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    this.scene.add(key);

    this.editorCamera.position.set(7, 6, 9);
    this.editorCamera.lookAt(0, 1, 0);
    this.orbit = new OrbitControls(this.editorCamera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.09;
    this.orbit.target.set(0, 1, 0);

    this.transform = new TransformControls(this.editorCamera, this.renderer.domElement);
    this.transform.setSpace('world');
    this.transform.setTranslationSnap(0.25);
    this.transform.setRotationSnap(THREE.MathUtils.degToRad(15));
    this.transform.setScaleSnap(0.25);
    this.scene.add(this.transform.getHelper());

    this.transform.addEventListener('dragging-changed', (event) => {
      this.orbit.enabled = !(event.value as boolean);
    });
    this.transform.addEventListener('objectChange', () => {
      const object = this.transform.object;
      if (!object) return;
      const id = object.userData.forgeId as string | undefined;
      if (!id) return;
      this.callbacks.onTransform(id, {
        position: object.position.toArray(),
        rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
        scale: object.scale.toArray(),
      });
    });

    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.host);
    this.resize();
    this.animation = requestAnimationFrame(this.render);
  }

  private readonly resizeObserver: ResizeObserver;

  setTool(tool: Tool) {
    this.tool = tool;
    const modes: Record<Tool, 'translate' | 'rotate' | 'scale'> = { select: 'translate', move: 'translate', rotate: 'rotate', scale: 'scale' };
    this.transform.setMode(modes[tool]);
    this.updateTransformAttachment();
  }

  setSpace(space: 'world' | 'local') {
    this.transform.setSpace(space);
  }

  setGrid(show: boolean) {
    this.showGrid = show;
    this.grid.visible = show && !this.gameView;
  }

  setGameView(gameView: boolean) {
    this.gameView = gameView;
    this.grid.visible = this.showGrid && !gameView;
    this.axes.visible = !gameView;
    this.updateTransformAttachment();
  }

  sync(scene: ForgeScene, selectedId: string | null) {
    this.latestScene = scene;
    this.selectedId = selectedId;
    const live = new Set<string>();
    for (const object of scene.getObjects()) {
      live.add(object.id);
      const signature = this.signature(object);
      const existing = this.objects.get(object.id);
      if (!existing || this.signatures.get(object.id) !== signature) {
        if (existing) this.root.remove(existing);
        const built = this.buildObject(object);
        this.root.add(built);
        this.objects.set(object.id, built);
        this.signatures.set(object.id, signature);
      }
      const node = this.objects.get(object.id)!;
      node.visible = object.active;
      node.position.set(object.transform.position.x, object.transform.position.y, object.transform.position.z);
      node.rotation.set(
        THREE.MathUtils.degToRad(object.transform.rotation.x),
        THREE.MathUtils.degToRad(object.transform.rotation.y),
        THREE.MathUtils.degToRad(object.transform.rotation.z),
      );
      node.scale.set(object.transform.scale.x, object.transform.scale.y, object.transform.scale.z);
    }
    for (const [id, object] of this.objects) {
      if (!live.has(id)) {
        this.root.remove(object);
        this.objects.delete(id);
        this.signatures.delete(id);
      }
    }
    this.updateTransformAttachment();
  }

  focusSelected() {
    if (!this.selectedId) return;
    const node = this.objects.get(this.selectedId);
    if (!node) return;
    const box = new THREE.Box3().setFromObject(node);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const distance = Math.max(sphere.radius * 3.2, 4);
    const direction = new THREE.Vector3(1, 0.75, 1).normalize();
    this.editorCamera.position.copy(sphere.center).add(direction.multiplyScalar(distance));
    this.orbit.target.copy(sphere.center);
    this.orbit.update();
  }

  dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.animation);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.transform.detach();
    this.orbit.dispose();
    this.renderer.dispose();
    this.root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else if (material) material.dispose();
    });
    this.host.replaceChildren();
  }

  private readonly handlePointerDown = (event: PointerEvent) => {
    if (this.gameView) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.editorCamera);
    const hits = this.raycaster.intersectObjects(this.root.children, true);
    for (const hit of hits) {
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.forgeId) node = node.parent;
      if (node?.userData.forgeId) {
        this.callbacks.onSelect(node.userData.forgeId as string);
        return;
      }
    }
    this.callbacks.onSelect(null);
  };

  private readonly render = () => {
    if (this.destroyed) return;
    this.animation = requestAnimationFrame(this.render);
    const dt = this.clock.getDelta();
    void dt;
    this.orbit.update();
    const activeCamera = this.gameView ? this.getPrimaryCamera() : this.editorCamera;
    this.renderer.render(this.scene, activeCamera);
    this.frames += 1;
    const now = performance.now();
    if (now - this.lastStats >= 500) {
      const elapsed = now - this.lastStats;
      this.callbacks.onStats({
        fps: (this.frames * 1000) / elapsed,
        objects: this.objects.size,
        drawCalls: this.renderer.info.render.calls,
        frameTime: 1000 / Math.max(1, (this.frames * 1000) / elapsed),
      });
      this.frames = 0;
      this.lastStats = now;
    }
  };

  private resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.editorCamera.aspect = width / height;
    this.editorCamera.updateProjectionMatrix();
  }

  private updateTransformAttachment() {
    if (this.gameView || this.tool === 'select' || !this.selectedId) {
      this.transform.detach();
      return;
    }
    const object = this.objects.get(this.selectedId);
    if (!object) {
      this.transform.detach();
      return;
    }
    this.transform.attach(object);
  }

  private signature(object: ForgeGameObject) {
    const components = object.components.map((component) => component.serialize()).sort((a, b) => a.type.localeCompare(b.type));
    return JSON.stringify(components);
  }

  private buildObject(object: ForgeGameObject) {
    const group = new THREE.Group();
    group.userData.forgeId = object.id;
    group.name = object.name;
    group.traverse((node) => { node.userData.forgeId = object.id; });

    const meshComponent = object.getComponent<ForgeMeshRendererComponent>('MeshRenderer');
    if (meshComponent?.enabled) {
      const mesh = this.buildMesh(meshComponent);
      mesh.userData.forgeId = object.id;
      group.add(mesh);
    } else {
      const helper = new THREE.AxesHelper(0.6);
      helper.userData.forgeId = object.id;
      group.add(helper);
    }

    const light = object.getComponent<ForgeLightComponent>('Light');
    if (light?.enabled) group.add(this.buildLight(light));

    const camera = object.getComponent<ForgeCameraComponent>('Camera');
    if (camera?.enabled) {
      const threeCamera = this.buildCamera(camera);
      threeCamera.userData.forgeId = object.id;
      group.add(threeCamera);
    }

    return group;
  }

  private buildMesh(component: ForgeMeshRendererComponent) {
    const size = Math.max(0.01, component.size);
    let geometry: THREE.BufferGeometry;
    switch (component.primitive) {
      case 'sphere': geometry = new THREE.SphereGeometry(size * 0.5, 32, 20); break;
      case 'capsule': geometry = new THREE.CapsuleGeometry(size * 0.3, size * 0.7, 8, 18); break;
      case 'cylinder': geometry = new THREE.CylinderGeometry(size * 0.5, size * 0.5, size, 32); break;
      case 'plane': { geometry = new THREE.PlaneGeometry(size, size); break; }
      default: geometry = new THREE.BoxGeometry(size, size, size); break;
    }
    const material = new THREE.MeshStandardMaterial({
      color: component.color,
      roughness: 0.68,
      metalness: 0.08,
      wireframe: component.wireframe,
    });
    const mesh = new THREE.Mesh(geometry, material);
    if (component.primitive === 'plane') mesh.rotation.x = -Math.PI / 2;
    mesh.castShadow = component.castShadow;
    mesh.receiveShadow = component.receiveShadow;
    return mesh;
  }

  private buildLight(component: ForgeLightComponent): THREE.Light {
    const color = new THREE.Color(component.color);
    switch (component.kind) {
      case 'point': {
        const light = new THREE.PointLight(color, component.intensity, component.range);
        light.castShadow = component.castShadow;
        light.add(new THREE.PointLightHelper(light, 0.25));
        return light;
      }
      case 'spot': {
        const light = new THREE.SpotLight(color, component.intensity, component.range, Math.PI / 6, 0.2, 1);
        light.castShadow = component.castShadow;
        light.add(new THREE.SpotLightHelper(light));
        return light;
      }
      case 'ambient': return new THREE.AmbientLight(color, component.intensity);
      default: {
        const light = new THREE.DirectionalLight(color, component.intensity);
        light.castShadow = component.castShadow;
        light.position.set(2, 5, 3);
        light.add(new THREE.DirectionalLightHelper(light, 0.6));
        return light;
      }
    }
  }

  private buildCamera(component: ForgeCameraComponent): THREE.Camera {
    if (component.projection === 'orthographic') {
      return new THREE.OrthographicCamera(-5, 5, 5, -5, component.near, component.far);
    }
    return new THREE.PerspectiveCamera(component.fov, 1, component.near, component.far);
  }

  private getPrimaryCamera(): THREE.Camera {
    const scene = this.latestScene;
    if (!scene) return this.editorCamera;
    const data = scene.getObjects().find((object) => object.active && object.getComponent<ForgeCameraComponent>('Camera')?.primary)
      ?? scene.getObjects().find((object) => object.active && object.getComponent<ForgeCameraComponent>('Camera'));
    if (!data) return this.editorCamera;
    const node = this.objects.get(data.id);
    const camera = node?.children.find((child) => child instanceof THREE.Camera) as THREE.Camera | undefined;
    if (!camera) return this.editorCamera;
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.aspect = Math.max(0.01, this.host.clientWidth / Math.max(1, this.host.clientHeight));
      camera.updateProjectionMatrix();
    }
    return camera;
  }
}
