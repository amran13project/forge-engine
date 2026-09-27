import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Editor from '@monaco-editor/react';
import {
  ForgeCameraComponent,
  ForgeGameObject,
  ForgeLightComponent,
  ForgeMeshRendererComponent,
  ForgeScene,
  ForgeScriptComponent,
  ForgeSpriteRendererComponent,
  ForgeRigidBodyComponent, ForgeBoxColliderComponent, ForgeAnimationComponent, ForgeAudioSourceComponent, ForgeVisualScriptComponent, ForgeRuntimeUIComponent,
  type ForgeComponent,
  type ForgePrimitive,
} from '@forge/core';
import { ForgeThreeSceneView } from '@forge/renderer-three';
import { ForgeTwoDSceneView } from '@forge/renderer-2d';
import { createCamera, createLight, createPrimitive, addDefaultComponent, useEditorStore } from './store';
import { getDefaultScript, ForgeScriptRuntime, compileForgeScript, makeClassNameSafe } from './script-runtime';
import { ForgePhysicsRuntime } from './physics-runtime';
import { ForgeAnimationRuntime } from './animation-runtime';
import { ForgeVisualScriptRuntime } from './visual-script-runtime';
import { ForgeAudioRuntime } from './audio-runtime';
import { AssetsPanel, PrefabPanel, AnimationPanel, VisualScriptingPanel, AudioPanel, RuntimeUIPanel, AIHelpPanel } from './advanced-panels';
import './styles.css';

const RECENT_KEY = 'forge.recent-projects';
type Recent = { name: string; root: string; mode?: '2D' | '3D' };
type Tool = 'select' | 'move' | 'rotate' | 'scale';
type BottomTab = 'Project' | 'Console' | 'Scripts' | 'Animation' | 'Visual Scripting' | 'Audio' | 'Runtime UI' | 'Assets' | 'Prefabs' | 'AI Help' | 'Profiler' | 'Audit';
type ProjectMode = '2D' | '3D';

type ViewportHandle = { focusSelected: () => void };

function getRecent(): Recent[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') as Recent[]; } catch { return []; }
}
function saveRecent(entries: Recent[]) { localStorage.setItem(RECENT_KEY, JSON.stringify(entries.slice(0, 8))); }

async function openProjectRoot(file: string) {
  const result = await window.forgeDesktop.openProject(file) as { root: string; project: { name: string; mainScene: string; mode?: ProjectMode } };
  const sceneRaw = await window.forgeDesktop.readScene(result.root, result.project.mainScene);
  const scene = ForgeScene.deserialize(JSON.parse(sceneRaw));
  const mode = result.project.mode ?? scene.mode ?? '3D';
  scene.mode = mode;
  useEditorStore.getState().setProject({ root: result.root, name: result.project.name, mainScene: result.project.mainScene, mode });
  useEditorStore.getState().setScene(scene);
  useEditorStore.getState().log('INFO', `Opened ${mode} project: ${result.project.name}`);
  const recents = getRecent().filter((entry) => entry.root !== result.root);
  saveRecent([{ name: result.project.name, root: result.root, mode }, ...recents]);
}

function App() {
  const project = useEditorStore((s) => s.project);
  const scene = useEditorStore((s) => s.scene);
  const mode = useEditorStore((s) => s.mode);
  const paused = useEditorStore((s) => s.runtimePaused);
  const runtimeFrame = useEditorStore((s) => s.runtimeFrame);
  const dirty = useEditorStore((s) => s.dirty);
  const version = useEditorStore((s) => s.version);
  const selectedId = useEditorStore((s) => s.selectedId);
  const stats = useEditorStore((s) => s.stats);
  const select = useEditorStore((s) => s.select);
  const beginPlay = useEditorStore((s) => s.beginPlay);
  const stopPlayStore = useEditorStore((s) => s.stopPlay);
  const setRuntimePaused = useEditorStore((s) => s.setRuntimePaused);
  const runtimeMutate = useEditorStore((s) => s.runtimeMutate);
  const stepRuntime = useEditorStore((s) => s.stepRuntime);
  const mutate = useEditorStore((s) => s.mutate);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const log = useEditorStore((s) => s.log);
  const markSaved = useEditorStore((s) => s.markSaved);
  const [showProject, setShowProject] = useState(!project);
  const [projectName, setProjectName] = useState('My Game');
  const [folder, setFolder] = useState('');
  const [projectMode, setProjectMode] = useState<ProjectMode>('3D');
  const [tool, setTool] = useState<Tool>('select');
  const [view, setView] = useState<'scene' | 'game'>('scene');
  const [bottomTab, setBottomTab] = useState<BottomTab>('Project');
  const [bottomOpen, setBottomOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [grid, setGrid] = useState(true);
  const [space, setSpace] = useState<'world' | 'local'>('world');
  const [helpOpen, setHelpOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const viewportRef = useRef<ViewportHandle>(null);
  const runtimeRef = useRef(new ForgeScriptRuntime());
  const physicsRef = useRef(new ForgePhysicsRuntime());
  const animationRef = useRef(new ForgeAnimationRuntime());
  const visualRef = useRef(new ForgeVisualScriptRuntime());
  const audioRef = useRef(new ForgeAudioRuntime());
  const selected = useMemo(() => scene?.find(selectedId || '') ?? null, [scene, selectedId, version]);

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!project) setShowProject(true);
  }, [project]);

  useEffect(() => {
    const keys = new Set<string>();
    window.__forgeInput = keys;
    const down = (event: KeyboardEvent) => keys.add(event.key.toLowerCase());
    const up = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    if (mode !== 'play' || paused || !project || !scene) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      if (mode !== 'play') return;
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      runtimeMutate((current) => {
        physicsRef.current.step(current, dt);
        animationRef.current.update(current, dt);
        visualRef.current.update(current, log);
        runtimeRef.current.update(current, dt);
      });
      useEditorStore.setState((state) => ({ runtimeFrame: state.runtimeFrame + 1 }));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mode, paused, project, scene, runtimeMutate]);

  async function createProject() {
    try {
      if (!folder) throw new Error('Choose a parent folder first.');
      const result = await window.forgeDesktop.createProject(projectName, folder, projectMode) as { root: string };
      await openProjectRoot(result.root);
      setShowProject(false);
    } catch (error) { log('ERROR', error instanceof Error ? error.message : String(error)); }
  }

  async function openProject() {
    try {
      const file = await window.forgeDesktop.chooseProjectFile();
      if (file) { await openProjectRoot(file); setShowProject(false); }
    } catch (error) { log('ERROR', error instanceof Error ? error.message : String(error)); }
  }

  async function saveScene() {
    if (!scene || !project) return;
    try {
      await window.forgeDesktop.saveScene(project.root, project.mainScene, JSON.stringify(scene.serialize(), null, 2));
      markSaved();
      log('INFO', `Saved ${project.mainScene}`);
    } catch (error) { log('ERROR', error instanceof Error ? error.message : String(error)); }
  }

  async function buildWeb() {
    if (!project || !scene) return;
    try { const out = await window.forgeDesktop.buildWeb(project.root, project.mainScene); log('INFO', `Web build created at ${String(out)}`); } catch (error) { log('ERROR', error instanceof Error ? error.message : String(error)); }
  }

  async function enterPlay() {
    if (!scene || !project) return;
    if (dirty) await saveScene();
    beginPlay();
    setView('game');
    await runtimeRef.current.start(project.root, scene, window.forgeDesktop.readScript, log);
    await physicsRef.current.rebuild(scene);
    animationRef.current.reset();
    visualRef.current.clear();
    for (const object of scene.getObjects()) {
      const graph = object.getComponent<ForgeVisualScriptComponent>('VisualScript');
      if (!graph?.enabled || !graph.autoRun) continue;
      try {
        const raw = await window.forgeDesktop.readScene(project.root, graph.graphPath);
        visualRef.current.setGraph(graph.graphPath, JSON.parse(raw));
      } catch (error) {
        log('WARN', `Visual Script graph unavailable: ${graph.graphPath}`);
      }
    }
    visualRef.current.start(scene, log);
    await audioRef.current.start(scene, project.root, window.forgeDesktop.readAssetData, log);
    log('INFO', 'Play Mode started. Authoring state is isolated.');
  }

  function stopPlay() {
    runtimeRef.current.clear();
    physicsRef.current.clear();
    animationRef.current.reset();
    visualRef.current.clear();
    audioRef.current.clear();
    stopPlayStore();
    setView('scene');
    log('INFO', 'Play Mode stopped. Authoring scene restored.');
  }

  function doStep() {
    if (mode !== 'play') return;
    const current = useEditorStore.getState().scene;
    if (!current) return;
    runtimeMutate((sceneState) => runtimeRef.current.update(sceneState, 1 / 60));
    stepRuntime();
  }

  function createEmpty() {
    let id = '';
    mutate((s) => { id = s.createObject(`GameObject ${s.getObjects().length + 1}`).id; });
    if (id) select(id);
  }
  function add3D(primitive: ForgePrimitive) { let id = ''; mutate((s) => { id = createPrimitive(s, primitive).id; }); if (id) select(id); log('INFO', `Created ${primitive} primitive.`); }
  function add2DSprite() { let id = ''; mutate((s) => { const object = s.createObject(`Sprite ${s.getObjects().length + 1}`); object.addComponent(new ForgeSpriteRendererComponent()); id = object.id; }); if (id) select(id); log('INFO', 'Created 2D Sprite.'); }
  function addCamera() { let id = ''; mutate((s) => { id = createCamera(s).id; }); if (id) select(id); }
  function addLight(kind: ForgeLightComponent['kind']) { let id = ''; mutate((s) => { id = createLight(s, kind).id; }); if (id) select(id); }
  function addScript() {
    if (!selected) { log('WARN', 'Select a GameObject before attaching a script.'); return; }
    const existing = selected.getComponent<ForgeScriptComponent>('Script');
    if (existing) {
      setBottomOpen(true);
      setBottomTab('Scripts');
      log('INFO', `Opened ${existing.scriptPath}.`);
      return;
    }
    let path = '';
    mutate((s) => {
      const object = s.find(selected.id);
      if (!object || object.getComponent('Script')) return;
      const script = object.addComponent(new ForgeScriptComponent());
      const safeName = makeClassNameSafe(object.name);
      script.className = safeName;
      script.scriptPath = `Scripts/${safeName}.ts`;
      path = script.scriptPath;
    });
    if (path && project) {
      void window.forgeDesktop.saveScript(project.root, path, getDefaultScript(project.mode, selected.name)).then(() => {
        log('INFO', `Created ${path}`);
        setBottomOpen(true);
        setBottomTab('Scripts');
      }).catch((error) => log('ERROR', error instanceof Error ? error.message : String(error)));
    }
  }
  function duplicate() { if (!selectedId) return; let id = ''; mutate((s) => { id = s.duplicateObject(selectedId).id; }); if (id) select(id); }
  function remove() { if (!selectedId) return; mutate((s) => s.deleteObject(selectedId)); select(null); }
  function changeSelected(fn: (obj: ForgeGameObject) => void) { if (!selectedId) return; try { mutate((s) => { const o = s.find(selectedId); if (o) fn(o); }); } catch (error) { log('ERROR', error instanceof Error ? error.message : String(error)); } }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const editing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement | null)?.tagName || '') || Boolean((event.target as HTMLElement | null)?.closest('.monaco-editor'));
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void saveScene(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !editing) { event.preventDefault(); undo(); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && !editing) { event.preventDefault(); redo(); }
      if (!editing && event.key === 'Delete') { event.preventDefault(); remove(); }
      if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') { event.preventDefault(); duplicate(); }
      if (!editing && ['q', 'w', 'e', 'r'].includes(event.key.toLowerCase())) setTool(({ q: 'select', w: 'move', e: 'rotate', r: 'scale' } as Record<string, Tool>)[event.key.toLowerCase()]);
      if (!editing && event.key.toLowerCase() === 'f' && selected) viewportRef.current?.focusSelected();
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'n' && !editing) { event.preventDefault(); createEmpty(); }
      if (!editing && event.key === 'F1') { event.preventDefault(); setHelpOpen(true); }
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  if (showProject || !project || !scene) {
    return <><ProjectManager projectName={projectName} setProjectName={setProjectName} folder={folder} setFolder={setFolder} mode={projectMode} setMode={setProjectMode} onCreate={createProject} onOpen={openProject} onOpenRecent={async (root) => { await openProjectRoot(root); setShowProject(false); }} currentProject={project ? { name: project.name, root: project.root, mode: project.mode } : null} onBack={project ? () => setShowProject(false) : undefined} />{booting && <ForgeSplash />}</>;
  }

  const sceneMode = scene.mode ?? project.mode;
  return <div className="forge-app">
    <header className="topbar">
      <div className="brand-block"><span className="forge-mark">F</span><div className="brand-copy"><strong>Forge Engine</strong><span>{project.name}</span></div><button className="editor-dashboard-button" onClick={() => setShowProject(true)} title="Open Forge Dashboard">⌂ Dashboard</button></div>
      <nav className="menu-row" aria-label="Main menu">
        <TopMenu label="File" items={[{ label: 'Save Scene', shortcut: 'Ctrl+S', onClick: () => void saveScene() }, { label: 'Open Project', onClick: openProject }, { label: 'Dashboard', onClick: () => setShowProject(true) }, { label: 'Build Web', onClick: () => void buildWeb() }]}/>
        <TopMenu label="Edit" items={[{ label: 'Undo', shortcut: 'Ctrl+Z', onClick: undo }, { label: 'Redo', shortcut: 'Ctrl+Y', onClick: redo }, { label: 'Duplicate', shortcut: 'Ctrl+D', onClick: duplicate }, { label: 'Delete', shortcut: 'Del', onClick: remove }]}/>
        <TopMenu label="GameObject" items={[
          { label: 'Create Empty', shortcut: 'Ctrl+Shift+N', onClick: createEmpty },
          ...(sceneMode === '2D' ? [{ label: 'Create Sprite', onClick: add2DSprite }] : [
            { label: 'Create Cube', onClick: () => add3D('cube') }, { label: 'Create Sphere', onClick: () => add3D('sphere') }, { label: 'Create Capsule', onClick: () => add3D('capsule') }, { label: 'Create Cylinder', onClick: () => add3D('cylinder') }, { label: 'Create Plane', onClick: () => add3D('plane') },
          ]),
          { label: 'Create Camera', onClick: addCamera }, { label: 'Create Directional Light', onClick: () => addLight('directional') }, { label: 'Create Point Light', onClick: () => addLight('point') }, { label: 'Attach TypeScript Script', onClick: addScript },
        ]}/>
        <TopMenu label="Window" items={[{ label: 'Toggle Hierarchy', onClick: () => setLeftOpen((v) => !v) }, { label: 'Toggle Inspector', onClick: () => setRightOpen((v) => !v) }, { label: 'Toggle Bottom Panel', onClick: () => setBottomOpen((v) => !v) }, { label: 'Help', shortcut: 'F1', onClick: () => setHelpOpen(true) }]}/>
      </nav>
      <div className="top-spacer"/>
      <button className="ai-launcher" onClick={() => { setBottomTab('AI Help'); setBottomOpen(true); }} title="Open Forge AI">✦ Forge AI</button><button className="help-button" onClick={() => setHelpOpen(true)} title="Forge Help (F1)">?</button>
      <div className="editor-status"><span className={`status-dot ${mode === 'play' ? 'live' : ''}`}/><span>{mode === 'play' ? (paused ? 'Paused' : 'Playing') : 'Editor'}</span></div>
      <button className="project-button" onClick={() => setShowProject(true)}>Projects</button>
    </header>

    <section className="main-toolbar">
      <div className="toolbar-cluster"><ToolbarButton label="Select" icon="↖" active={tool === 'select'} onClick={() => setTool('select')} shortcut="Q"/><ToolbarButton label="Move" icon="↔" active={tool === 'move'} onClick={() => setTool('move')} shortcut="W"/><ToolbarButton label="Rotate" icon="⟳" active={tool === 'rotate'} onClick={() => setTool('rotate')} shortcut="E"/><ToolbarButton label="Scale" icon="⤢" active={tool === 'scale'} onClick={() => setTool('scale')} shortcut="R"/></div>
      <div className="toolbar-divider"/>
      <button className={`icon-button ${space === 'local' ? 'active' : ''}`} onClick={() => setSpace(space === 'world' ? 'local' : 'world')} title="Toggle transform space">{space === 'world' ? 'World' : 'Local'}</button>
      <button className={`icon-button ${grid ? 'active' : ''}`} onClick={() => setGrid((v) => !v)} title="Toggle grid">▦</button>
      <button className="icon-button" onClick={() => viewportRef.current?.focusSelected()} disabled={!selected} title="Frame selected (F)">⌾</button><button className="icon-button" onClick={undo} title="Undo">↶</button><button className="icon-button" onClick={redo} title="Redo">↷</button>
      <div className="toolbar-spacer"/>
      <div className="view-tabs"><button className={view === 'scene' ? 'active' : ''} onClick={() => setView('scene')}>Scene</button><button className={view === 'game' ? 'active' : ''} onClick={() => setView('game')}>Game</button></div>
      <div className="play-controls"><button className={`transport ${mode === 'play' ? 'active-stop' : 'primary-transport'}`} onClick={mode === 'play' ? stopPlay : () => void enterPlay()}>{mode === 'play' ? '■' : '▶'}</button><button className={`transport ${paused ? 'active' : ''}`} onClick={() => mode === 'play' && setRuntimePaused(!paused)} disabled={mode !== 'play'}>Ⅱ</button><button className="transport" onClick={doStep} disabled={mode !== 'play'}>▸|</button></div>
      <div className="toolbar-meta"><span>{scene.name}{dirty ? ' •' : ''}</span><small>{sceneMode} Scene</small></div>
    </section>

    <div className="editor-shell">
      {leftOpen && <aside className="dock-panel left-panel"><DockHeader title="Hierarchy" icon="◇" right={<button className="panel-action" onClick={createEmpty}>＋</button>}/><div className="search-box"><span>⌕</span><input placeholder="Search hierarchy"/></div><div className="hierarchy-root"><span className="scene-icon">◉</span><strong>{scene.name}</strong><span className="scene-kind">{sceneMode}</span></div><div className="tree-scroll"><TreeNodeList objects={scene.getRootObjects()} selectedId={selectedId} onSelect={select}/></div><div className="dock-footer"><span>{scene.getObjects().length} objects</span><button onClick={() => setLeftOpen(false)}>‹</button></div></aside>}
      <section className="center-area">
        <div className="viewport-wrap">{view === 'game' && <RuntimeUIOverlay scene={scene}/>}<div className="viewport-header"><div className="viewport-title"><span className="window-dot"/>{view === 'scene' ? 'Scene' : 'Game'}<span className="viewport-sub">· {sceneMode} · {space}</span></div><div className="viewport-tools"><span>{sceneMode === '3D' ? 'Perspective' : '2D Orthographic'}</span><span>{stats.fps.toFixed(0)} FPS</span><span>{stats.drawCalls} DC</span></div></div><Viewport ref={viewportRef} scene={scene} selectedId={selectedId} version={version} grid={grid} tool={tool} view={view} space={space}/></div>
        {bottomOpen && <section className="bottom-dock"><div className="bottom-tabs">{(['Project', 'Assets', 'Prefabs', 'Console', 'Scripts', 'Animation', 'Visual Scripting', 'Audio', 'Runtime UI', 'AI Help', 'Profiler', 'Audit'] as BottomTab[]).map((tab) => <button key={tab} className={bottomTab === tab ? 'active' : ''} onClick={() => setBottomTab(tab)}>{tab}</button>)}<button className="bottom-collapse" onClick={() => setBottomOpen(false)}>⌄</button></div><BottomContent tab={bottomTab} project={project} scene={scene} selected={selected}/></section>}
      </section>
      {rightOpen && <aside className="dock-panel right-panel"><DockHeader title="Inspector" icon="☷" right={<button className="panel-action" onClick={() => selected && log('INFO', `Inspector: ${selected.name}`)}>⋯</button>}/><Inspector selected={selected} scene={scene} onChange={changeSelected} onDuplicate={duplicate} onDelete={remove} onAddScript={addScript}/></aside>}
    </div>
    {!leftOpen && <button className="edge-toggle edge-left" onClick={() => setLeftOpen(true)}>›</button>}{!rightOpen && <button className="edge-toggle edge-right" onClick={() => setRightOpen(true)}>‹</button>}{!bottomOpen && <button className="bottom-reopen" onClick={() => setBottomOpen(true)}>⌃ Show Panel</button>}
    <footer className="statusbar"><div className="status-left"><span className="status-icon">●</span><span>{dirty ? 'Unsaved changes' : 'Saved'}</span><span className="status-divider"/><span>{toolLabel(tool)} Tool</span></div><div className="status-center">{selected ? `${selected.name} • ${selected.id}` : 'No GameObject selected'}</div><div className="status-right"><span>{scene.getObjects().length} Objects</span><span>{sceneMode === '3D' ? 'Three.js · WebGL2' : 'Forge 2D Canvas'}</span><span>Forge 0.7.0</span></div></footer>
    {helpOpen && <HelpModal tool={tool} mode={sceneMode} bottomTab={bottomTab} selected={selected} onClose={() => setHelpOpen(false)}/>} {booting && <ForgeSplash/>}
  </div>;
}

const Viewport = React.forwardRef<ViewportHandle, { scene: ForgeScene; selectedId: string | null; version: number; grid: boolean; tool: Tool; view: 'scene' | 'game'; space: 'world' | 'local' }>(function Viewport({ scene, selectedId, version, grid, tool, view, space }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<ForgeThreeSceneView | ForgeTwoDSceneView | null>(null);
  const setStats = useEditorStore((s) => s.setStats);
  const mutate = useEditorStore((s) => s.mutate);
  const select = useEditorStore((s) => s.select);
  const log = useEditorStore((s) => s.log);
  useImperativeHandle(ref, () => ({ focusSelected: () => rendererRef.current?.focusSelected() }), []);

  useEffect(() => {
    if (!hostRef.current) return;
    const callbacks3D = { onSelect: (id: string | null) => select(id), onStats: setStats, onTransform: (id: string, t: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }) => mutate((current) => { const object = current.find(id); if (!object) return; object.transform.position = { x: t.position[0], y: t.position[1], z: t.position[2] }; object.transform.rotation = { x: t.rotation[0] * 180 / Math.PI, y: t.rotation[1] * 180 / Math.PI, z: t.rotation[2] * 180 / Math.PI }; object.transform.scale = { x: t.scale[0], y: t.scale[1], z: t.scale[2] }; }) };
    const callbacks2D = { onSelect: (id: string | null) => select(id), onStats: setStats, onTransform: (id: string, position: { x: number; y: number }, rotation: number, scale: { x: number; y: number }) => mutate((current) => { const object = current.find(id); if (!object) return; object.transform.position = { ...object.transform.position, x: position.x, y: position.y }; object.transform.rotation.z = rotation; object.transform.scale = { ...object.transform.scale, x: scale.x, y: scale.y }; }) };
    rendererRef.current = scene.mode === '2D' ? new ForgeTwoDSceneView(hostRef.current, callbacks2D) : new ForgeThreeSceneView(hostRef.current, callbacks3D);
    log('INFO', `${scene.mode} viewport initialized.`);
    return () => { rendererRef.current?.dispose(); rendererRef.current = null; };
  }, [scene.mode]);

  useEffect(() => { rendererRef.current?.setTool(tool); rendererRef.current?.setSpace(space); rendererRef.current?.setGrid(grid); rendererRef.current?.setGameView(view === 'game'); }, [tool, space, grid, view]);
  useEffect(() => { rendererRef.current?.sync(scene, selectedId); }, [scene, selectedId, version]);
  return <div className={`viewport-renderer ${scene.mode.toLowerCase()}`} ref={hostRef}><div className="viewport-hud"><span>{view === 'scene' ? 'EDITOR VIEW' : 'GAME VIEW'}</span><span>{scene.getObjects().length} objects</span></div>{view === 'game' && <div className="game-overlay"><strong>GAME</strong><span>Runtime camera / scene output</span></div>}</div>;
});

function ProjectManager(props: {
  projectName: string;
  setProjectName: (v: string) => void;
  folder: string;
  setFolder: (v: string) => void;
  mode: ProjectMode;
  setMode: (v: ProjectMode) => void;
  onCreate: () => void;
  onOpen: () => void;
  onOpenRecent: (v: string) => void;
  currentProject?: { name: string; root: string; mode?: ProjectMode } | null;
  onBack?: () => void;
}) {
  const recent = getRecent();
  const [tab, setTab] = useState<'home' | 'projects' | 'learn' | 'templates' | 'settings'>('home');
  const [search, setSearch] = useState('');
  const filtered = recent.filter((item) => `${item.name} ${item.root}`.toLowerCase().includes(search.toLowerCase()));

  function QuickCreate({ mode, label, desc }: { mode: ProjectMode; label: string; desc: string }) {
    return <button className="dash-quick-card" onClick={() => { props.setMode(mode); document.getElementById('dashboard-project-name')?.focus(); }}>
      <span className={`dash-quick-icon ${mode === '3D' ? 'is-3d' : 'is-2d'}`}>{mode === '3D' ? '◇' : '▦'}</span>
      <span><strong>{label}</strong><small>{desc}</small></span>
      <b>→</b>
    </button>;
  }

  return <div className="dashboard-screen">
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand">
        <div className="dashboard-brand-mark">F</div>
        <div><strong>FORGE</strong><span>ENGINE</span></div>
      </div>
      <div className="dashboard-nav-label">WORKSPACE</div>
      <nav>
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><span>⌂</span> Home</button>
        <button className={tab === 'projects' ? 'active' : ''} onClick={() => setTab('projects')}><span>▤</span> Projects</button>
        <button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}><span>✦</span> Templates</button>
        <button className={tab === 'learn' ? 'active' : ''} onClick={() => setTab('learn')}><span>?</span> Learn</button>
      </nav>
      <div className="dashboard-nav-label">TOOLS</div>
      <nav>
        <button onClick={() => setTab('settings')}><span>⚙</span> Preferences</button>
        <button onClick={props.onOpen}><span>↗</span> Open Project</button>
      </nav>
      <div className="dashboard-sidebar-bottom">
        <div className="dashboard-engine-status"><span className="status-dot"/> Engine Ready</div>
        <small>Local-first • No account required</small>
        {props.currentProject && props.onBack && <button className="dashboard-return" onClick={props.onBack}>← Continue editing</button>}
      </div>
    </aside>

    <main className="dashboard-main">
      <header className="dashboard-topbar">
        <div className="dashboard-breadcrumb"><span>Forge Engine</span><b>/</b><strong>{tab[0].toUpperCase() + tab.slice(1)}</strong></div>
        <div className="dashboard-top-actions">
          <button className="dashboard-icon-button" title="Help" onClick={() => setTab('learn')}>?</button>
          <button className="dashboard-open-button" onClick={props.onOpen}>Open</button>
        </div>
      </header>

      {tab === 'home' && <div className="dashboard-content">
        <section className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <span className="dashboard-eyebrow">FORGE ENGINE · PROFESSIONAL WORKSPACE</span>
            <h1>Create. Build. <em>Forge.</em></h1>
            <p>A focused 2D + 3D game-development workspace with scenes, scripting, physics, visual tools, assets and build workflows in one local project.</p>
            <div className="dashboard-hero-actions">
              <button className="dashboard-primary" onClick={() => { setTab('home'); props.setMode('3D'); document.getElementById('dashboard-project-name')?.focus(); }}>New Project <span>⌘N</span></button>
              <button className="dashboard-secondary" onClick={props.onOpen}>Open Existing</button>
            </div>
          </div>
          <div className="dashboard-hero-art">
            <div className="dashboard-orbit orbit-1"/><div className="dashboard-orbit orbit-2"/>
            <div className="dashboard-logo-card"><img src="/forge-engine-intro.jpg" alt="Forge Engine"/><div className="dashboard-logo-shine"/></div>
          </div>
        </section>

        <section className="dashboard-section">
          <div className="dashboard-section-heading"><div><span>QUICK START</span><h2>Start a project</h2></div><small>Choose the foundation. Everything else can be added later.</small></div>
          <div className="dashboard-quick-grid">
            <QuickCreate mode="2D" label="2D Game" desc="Sprites, cameras, UI and 2D workflows"/>
            <QuickCreate mode="3D" label="3D Game" desc="Meshes, lighting, cameras and 3D tools"/>
            <button className="dash-quick-card" onClick={props.onOpen}><span className="dash-quick-icon neutral">↗</span><span><strong>Open Project</strong><small>Continue with a project on disk</small></span><b>→</b></button>
          </div>
        </section>

        <section className="dashboard-columns">
          <div className="dashboard-section dashboard-recent-section">
            <div className="dashboard-section-heading compact"><div><span>LOCAL PROJECTS</span><h2>Recent</h2></div><button onClick={() => setTab('projects')}>View all →</button></div>
            {recent.length === 0 ? <div className="dashboard-empty"><span>◇</span><strong>No projects yet</strong><small>Create your first 2D or 3D project to get started.</small></div> : <div className="dashboard-project-list">{recent.slice(0, 5).map((item) => <button className="dashboard-project-row" key={item.root} onClick={() => props.onOpenRecent(item.root)}><span className={`project-mode-mark ${item.mode === '2D' ? 'two' : 'three'}`}>{item.mode === '2D' ? '2D' : '3D'}</span><span><strong>{item.name}</strong><small>{item.root}</small></span><b>→</b></button>)}</div>}
          </div>
          <div className="dashboard-section system-section">
            <div className="dashboard-section-heading compact"><div><span>ENGINE STATUS</span><h2>Systems</h2></div><button onClick={() => setTab('settings')}>Preferences →</button></div>
            <div className="dashboard-system-grid">
              {['Scene + Components','2D + 3D Renderer','TypeScript + Monaco','Physics Runtime','Visual Scripting','Animation + Audio','Assets + Prefabs','Web Build'].map((name) => <div className="system-chip" key={name}><span className="system-check">✓</span>{name}</div>)}
            </div>
          </div>
        </section>
      </div>}

      {tab === 'projects' && <div className="dashboard-content narrow">
        <section className="dashboard-page-head"><div><span className="dashboard-eyebrow">PROJECT HUB</span><h1>Your projects</h1><p>Open, search and continue local Forge projects.</p></div><button className="dashboard-primary" onClick={() => setTab('home')}>＋ New Project</button></section>
        <div className="dashboard-search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..."/></div>
        {filtered.length === 0 ? <div className="dashboard-empty large"><span>◇</span><strong>No matching projects</strong><small>Try another search or create a new project.</small></div> : <div className="dashboard-project-table">{filtered.map((item) => <button key={item.root} className="dashboard-project-card" onClick={() => props.onOpenRecent(item.root)}><span className={`project-mode-mark ${item.mode === '2D' ? 'two' : 'three'}`}>{item.mode === '2D' ? '2D' : '3D'}</span><div><strong>{item.name}</strong><small>{item.root}</small></div><span className="project-card-open">Open →</span></button>)}</div>}
      </div>}

      {tab === 'templates' && <div className="dashboard-content narrow">
        <section className="dashboard-page-head"><div><span className="dashboard-eyebrow">STARTER WORKFLOWS</span><h1>Templates</h1><p>Fast starting points using Forge's real project system.</p></div></section>
        <div className="template-grid">
          <button className="template-card" onClick={() => { props.setMode('2D'); setTab('home'); }}><div className="template-art art-2d">2D</div><strong>Blank 2D</strong><span>Clean 2D scene foundation</span></button>
          <button className="template-card" onClick={() => { props.setMode('3D'); setTab('home'); }}><div className="template-art art-3d">3D</div><strong>Blank 3D</strong><span>Camera, light and 3D workspace</span></button>
          <button className="template-card" onClick={() => { props.setMode('3D'); setTab('home'); }}><div className="template-art art-physics">PHY</div><strong>Physics Lab</strong><span>3D project configured for physics work</span></button>
          <button className="template-card" onClick={() => { props.setMode('2D'); setTab('home'); }}><div className="template-art art-platform">2D+</div><strong>2D Starter</strong><span>2D scene ready for scripting and UI</span></button>
        </div>
      </div>}

      {tab === 'learn' && <div className="dashboard-content narrow">
        <section className="dashboard-page-head"><div><span className="dashboard-eyebrow">FORGE ACADEMY</span><h1>Learn Forge</h1><p>Quick guides for the editor, scripting and game-development workflow.</p></div></section>
        <div className="learn-grid">
          {[['Getting started','Create a project, understand the workspace, and press Play.','⌂'],['Scene + Hierarchy','Create objects, parent them, transform them and save scenes.','◇'],['TypeScript scripting','Attach scripts, edit in Monaco, compile and run in Play Mode.','⌘'],['Visual scripting','Build flow graphs, connect nodes and run them during Play Mode.','⌁'],['3D workflow','Use the Scene View, gizmos, cameras, lights and primitives.','◈'],['2D workflow','Use sprites, orthographic cameras and the 2D canvas.','▣'],['Physics','Add rigidbodies/colliders and test simulation in Play Mode.','◉'],['Help','Press F1 at any time for context-aware Forge Help.','?']].map(([title,desc,icon]) => <button className="learn-card" key={title} onClick={() => setTab('learn')}><span>{icon}</span><div><strong>{title}</strong><small>{desc}</small></div><b>→</b></button>)}
        </div>
      </div>}

      {tab === 'settings' && <div className="dashboard-content narrow">
        <section className="dashboard-page-head"><div><span className="dashboard-eyebrow">EDITOR</span><h1>Preferences</h1><p>Local preferences for the Forge desktop workspace.</p></div></section>
        <div className="dashboard-settings">
          <div><strong>Editor architecture</strong><small>React UI + Forge engine modules + secure Electron IPC</small></div>
          <div><strong>Rendering</strong><small>WebGL2 foundation with Three.js 3D renderer and dedicated 2D canvas renderer</small></div>
          <div><strong>Storage</strong><small>Projects, scenes and assets are stored on your computer.</small></div>
          <div><strong>Help</strong><small>Built-in help works offline. Optional AI providers can be configured separately.</small></div>
        </div>
      </div>}
    </main>

    <div className="dashboard-project-float">
      <label>New project</label>
      <div className="dashboard-create-row"><input id="dashboard-project-name" value={props.projectName} onChange={(e) => props.setProjectName(e.target.value)} placeholder="My Game"/><button onClick={async () => { const p = await window.forgeDesktop.chooseDirectory(); if (p) props.setFolder(p); }}>Choose folder</button><button className="dashboard-create" onClick={props.onCreate}>Create {props.mode}</button></div>
      <small>{props.folder || 'Choose a parent folder for the project'}</small>
    </div>
  </div>;
}

function DockHeader({ title, icon, right }: { title: string; icon: string; right?: React.ReactNode }) { return <div className="dock-header"><div><span>{icon}</span><strong>{title}</strong></div><div>{right}</div></div>; }
function TreeNodeList({ objects, selectedId, onSelect }: { objects: ForgeGameObject[]; selectedId: string | null; onSelect: (id: string) => void }) { return <>{objects.map((o) => <TreeNode key={o.id} object={o} depth={0} selectedId={selectedId} onSelect={onSelect}/>)}</>; }
function TreeNode({ object, depth, selectedId, onSelect }: { object: ForgeGameObject; depth: number; selectedId: string | null; onSelect: (id: string) => void }) { const [expanded, setExpanded] = useState(true); const has = object.children.length > 0; const icon = object.getComponent('MeshRenderer') ? '◈' : object.getComponent('SpriteRenderer') ? '▣' : object.getComponent('Camera') ? '▦' : object.getComponent('Light') ? '☼' : object.getComponent('Script') ? '⌘' : '◇'; return <div><div className={`tree-line ${selectedId === object.id ? 'selected' : ''}`} style={{ paddingLeft: 7 + depth * 16 }}><button className="tree-expander" onClick={() => has && setExpanded((v) => !v)}>{has ? (expanded ? '▾' : '▸') : ''}</button><button className="tree-select" onClick={() => onSelect(object.id)}><span className="object-icon">{icon}</span><span>{object.name}</span></button>{!object.active && <span className="muted">disabled</span>}</div>{expanded && object.children.map((child) => <TreeNode key={child.id} object={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect}/>)}</div>; }

function Inspector({ selected, scene, onChange, onDuplicate, onDelete, onAddScript }: { selected: ForgeGameObject | null; scene: ForgeScene; onChange: (fn: (obj: ForgeGameObject) => void) => void; onDuplicate: () => void; onDelete: () => void; onAddScript: () => void }) {
  if (!selected) return <div className="inspector-empty"><div className="empty-glyph">⌁</div><strong>Select a GameObject</strong><span>Choose an object in the Hierarchy or click it in the viewport to inspect its components.</span></div>;
  const add = (type: string) => { try { onChange((object) => addDefaultComponent(object, type)); } catch (error) { /* caller log is not available here */ } };
  return <div className="inspector-scroll"><div className="inspector-object-header"><div className="object-avatar">{selected.getComponent('Script') ? '⌘' : selected.getComponent('MeshRenderer') ? '◈' : selected.getComponent('SpriteRenderer') ? '▣' : selected.getComponent('Camera') ? '▣' : selected.getComponent('Light') ? '☼' : '◇'}</div><div className="object-title"><input value={selected.name} onChange={(e) => onChange((o) => { o.name = e.target.value; })}/><span>{selected.id}</span></div><button className="tiny-button danger" onClick={onDelete}>⌫</button></div><div className="inspector-actions"><button onClick={onDuplicate}>Duplicate</button><button onClick={() => onChange((o) => { o.active = !o.active; })}>{selected.active ? 'Disable' : 'Enable'}</button><button onClick={onAddScript}>{selected.getComponent('Script') ? 'Open Script' : 'Add Script'}</button></div><InspectorSection title="GameObject"><Field label="Active"><input className="check-input" type="checkbox" checked={selected.active} onChange={(e) => onChange((o) => { o.active = e.target.checked; })}/></Field><Field label="Parent"><select value={selected.parent?.id ?? ''} onChange={(e) => onChange((o) => scene.reparent(o.id, e.target.value || null))}><option value="">None (Root)</option>{scene.getObjects().filter((o) => o.id !== selected.id).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></InspectorSection><InspectorSection title="Transform" badge={scene.mode}><FieldGroup label="Position" fields={[num(selected.transform.position.x, (v) => onChange((o) => { o.transform.position.x = v; })), num(selected.transform.position.y, (v) => onChange((o) => { o.transform.position.y = v; })), num(selected.transform.position.z, (v) => onChange((o) => { o.transform.position.z = v; }))]}/><FieldGroup label="Rotation" fields={[num(selected.transform.rotation.x, (v) => onChange((o) => { o.transform.rotation.x = v; })), num(selected.transform.rotation.y, (v) => onChange((o) => { o.transform.rotation.y = v; })), num(selected.transform.rotation.z, (v) => onChange((o) => { o.transform.rotation.z = v; }))]}/><FieldGroup label="Scale" fields={[num(selected.transform.scale.x, (v) => onChange((o) => { o.transform.scale.x = v; })), num(selected.transform.scale.y, (v) => onChange((o) => { o.transform.scale.y = v; })), num(selected.transform.scale.z, (v) => onChange((o) => { o.transform.scale.z = v; }))]}/></InspectorSection>{selected.components.map((component) => <ComponentInspector key={component.type} component={component} onChange={onChange}/>)}<div className="add-component-box"><span>Add Component</span><div><button onClick={() => add(scene.mode === '2D' ? 'SpriteRenderer' : 'MeshRenderer')}>＋ {scene.mode === '2D' ? 'Sprite' : 'Mesh'}</button><button onClick={() => add('Camera')}>＋ Camera</button><button onClick={() => add('Light')}>＋ Light</button><button onClick={onAddScript}>＋ Script</button><button onClick={() => add('Tag')}>＋ Tag</button><button onClick={() => add('Metadata')}>＋ Metadata</button><button onClick={() => add('Rigidbody')}>＋ Rigidbody</button><button onClick={() => add('BoxCollider')}>＋ Box Collider</button><button onClick={() => add('Animator')}>＋ Animator</button><button onClick={() => add('AudioSource')}>＋ Audio</button><button onClick={() => add('VisualScript')}>＋ Visual Script</button><button onClick={() => add('RuntimeUI')}>＋ UI</button></div></div></div>;
}
function ComponentInspector({ component, onChange }: { component: ForgeComponent; onChange: (fn: (obj: ForgeGameObject) => void) => void }) {
  const extended = ExtendedComponentInspector({ component, onChange });
  if (extended) return extended;
  if (component.type === 'MeshRenderer') { const c = component as ForgeMeshRendererComponent; return <InspectorSection title="Mesh Renderer" badge="3D"><Field label="Primitive"><select value={c.primitive} onChange={(e) => onChange((o) => { (o.getComponent('MeshRenderer') as ForgeMeshRendererComponent).primitive = e.target.value as ForgePrimitive; })}><option value="cube">Cube</option><option value="sphere">Sphere</option><option value="capsule">Capsule</option><option value="cylinder">Cylinder</option><option value="plane">Plane</option></select></Field><Field label="Color"><input type="color" value={c.color} onChange={(e) => onChange((o) => { (o.getComponent('MeshRenderer') as ForgeMeshRendererComponent).color = e.target.value; })}/></Field><Field label="Size"><input type="number" min="0.01" step="0.1" value={c.size} onChange={(e) => onChange((o) => { (o.getComponent('MeshRenderer') as ForgeMeshRendererComponent).size = Number(e.target.value); })}/></Field><Field label="Wireframe"><input className="check-input" type="checkbox" checked={c.wireframe} onChange={(e) => onChange((o) => { (o.getComponent('MeshRenderer') as ForgeMeshRendererComponent).wireframe = e.target.checked; })}/></Field><Field label="Cast Shadow"><input className="check-input" type="checkbox" checked={c.castShadow} onChange={(e) => onChange((o) => { (o.getComponent('MeshRenderer') as ForgeMeshRendererComponent).castShadow = e.target.checked; })}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'SpriteRenderer') { const c = component as ForgeSpriteRendererComponent; return <InspectorSection title="Sprite Renderer" badge="2D"><Field label="Color"><input type="color" value={c.color} onChange={(e) => onChange((o) => { (o.getComponent('SpriteRenderer') as ForgeSpriteRendererComponent).color = e.target.value; })}/></Field><Field label="Width"><input type="number" min="0.05" step="0.1" value={c.width} onChange={(e) => onChange((o) => { (o.getComponent('SpriteRenderer') as ForgeSpriteRendererComponent).width = Number(e.target.value); })}/></Field><Field label="Height"><input type="number" min="0.05" step="0.1" value={c.height} onChange={(e) => onChange((o) => { (o.getComponent('SpriteRenderer') as ForgeSpriteRendererComponent).height = Number(e.target.value); })}/></Field><Field label="Opacity"><input type="number" min="0" max="1" step="0.05" value={c.opacity} onChange={(e) => onChange((o) => { (o.getComponent('SpriteRenderer') as ForgeSpriteRendererComponent).opacity = Number(e.target.value); })}/></Field><Field label="Sorting Layer"><input type="number" value={c.sortingLayer} onChange={(e) => onChange((o) => { (o.getComponent('SpriteRenderer') as ForgeSpriteRendererComponent).sortingLayer = Number(e.target.value); })}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'Script') { const c = component as ForgeScriptComponent; return <InspectorSection title="TypeScript Script" badge="Runtime"><Field label="Path"><input type="text" value={c.scriptPath} onChange={(e) => onChange((o) => { (o.getComponent('Script') as ForgeScriptComponent).scriptPath = e.target.value; })}/></Field><Field label="Class"><input type="text" value={c.className} onChange={(e) => onChange((o) => { (o.getComponent('Script') as ForgeScriptComponent).className = e.target.value; })}/></Field><Field label="Auto Run"><input className="check-input" type="checkbox" checked={c.autoRun} onChange={(e) => onChange((o) => { (o.getComponent('Script') as ForgeScriptComponent).autoRun = e.target.checked; })}/></Field><Field label="Enabled"><input className="check-input" type="checkbox" checked={c.enabled} onChange={(e) => onChange((o) => { const script = o.getComponent('Script'); if (script) script.enabled = e.target.checked; })}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'Camera') { const c = component as ForgeCameraComponent; return <InspectorSection title="Camera" badge="3D"><Field label="Projection"><select value={c.projection} onChange={(e) => onChange((o) => { (o.getComponent('Camera') as ForgeCameraComponent).projection = e.target.value as ForgeCameraComponent['projection']; })}><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select></Field><Field label="FOV"><input type="number" value={c.fov} onChange={(e) => onChange((o) => { (o.getComponent('Camera') as ForgeCameraComponent).fov = Number(e.target.value); })}/></Field><Field label="Near"><input type="number" min="0.001" step="0.01" value={c.near} onChange={(e) => onChange((o) => { (o.getComponent('Camera') as ForgeCameraComponent).near = Number(e.target.value); })}/></Field><Field label="Far"><input type="number" min="1" value={c.far} onChange={(e) => onChange((o) => { (o.getComponent('Camera') as ForgeCameraComponent).far = Number(e.target.value); })}/></Field><Field label="Primary"><input className="check-input" type="checkbox" checked={c.primary} onChange={(e) => onChange((o) => { (o.getComponent('Camera') as ForgeCameraComponent).primary = e.target.checked; })}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'Light') { const c = component as ForgeLightComponent; return <InspectorSection title="Light" badge="3D"><Field label="Type"><select value={c.kind} onChange={(e) => onChange((o) => { (o.getComponent('Light') as ForgeLightComponent).kind = e.target.value as ForgeLightComponent['kind']; })}><option value="directional">Directional</option><option value="point">Point</option><option value="spot">Spot</option><option value="ambient">Ambient</option></select></Field><Field label="Color"><input type="color" value={c.color} onChange={(e) => onChange((o) => { (o.getComponent('Light') as ForgeLightComponent).color = e.target.value; })}/></Field><Field label="Intensity"><input type="number" step="0.1" value={c.intensity} onChange={(e) => onChange((o) => { (o.getComponent('Light') as ForgeLightComponent).intensity = Number(e.target.value); })}/></Field><Field label="Range"><input type="number" min="0" value={c.range} onChange={(e) => onChange((o) => { (o.getComponent('Light') as ForgeLightComponent).range = Number(e.target.value); })}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  return <InspectorSection title={component.type}><Field label="Enabled"><input className="check-input" type="checkbox" checked={component.enabled} onChange={(e) => onChange((o) => { const c = o.getComponent(component.type); if (c) c.enabled = e.target.checked; })}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>;
}
function RemoveButton({ component, onChange }: { component: ForgeComponent; onChange: (fn: (obj: ForgeGameObject) => void) => void }) { return <button className="remove-component" onClick={() => onChange((o) => o.removeComponent(component.type))}>Remove Component</button>; }
function ExtendedComponentInspector({ component, onChange }: { component: ForgeComponent; onChange: (fn:(obj:ForgeGameObject)=>void)=>void }) {
  if (component.type === 'Rigidbody') { const c=component as ForgeRigidBodyComponent; return <InspectorSection title="Rigidbody" badge="PHYSICS"><Field label="Body Type"><select value={c.bodyType} onChange={e=>onChange(o=>{(o.getComponent('Rigidbody') as ForgeRigidBodyComponent).bodyType=e.target.value as ForgeRigidBodyComponent['bodyType'];})}><option value="dynamic">Dynamic</option><option value="fixed">Fixed</option><option value="kinematicPositionBased">Kinematic</option></select></Field><Field label="Mass"><input type="number" min="0.01" step="0.1" value={c.mass} onChange={e=>onChange(o=>{(o.getComponent('Rigidbody') as ForgeRigidBodyComponent).mass=Number(e.target.value);})}/></Field><Field label="Gravity Scale"><input type="number" step="0.1" value={c.gravityScale} onChange={e=>onChange(o=>{(o.getComponent('Rigidbody') as ForgeRigidBodyComponent).gravityScale=Number(e.target.value);})}/></Field><Field label="Lock Rotation"><input className="check-input" type="checkbox" checked={c.lockRotation} onChange={e=>onChange(o=>{(o.getComponent('Rigidbody') as ForgeRigidBodyComponent).lockRotation=e.target.checked;})}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'BoxCollider') { const c=component as ForgeBoxColliderComponent; return <InspectorSection title="Box Collider" badge="PHYSICS"><FieldGroup label="Size" fields={[num(c.size.x,v=>onChange(o=>{(o.getComponent('BoxCollider') as ForgeBoxColliderComponent).size.x=v;})),num(c.size.y,v=>onChange(o=>{(o.getComponent('BoxCollider') as ForgeBoxColliderComponent).size.y=v;})),num(c.size.z,v=>onChange(o=>{(o.getComponent('BoxCollider') as ForgeBoxColliderComponent).size.z=v;}))]}/><Field label="Trigger"><input className="check-input" type="checkbox" checked={c.isTrigger} onChange={e=>onChange(o=>{(o.getComponent('BoxCollider') as ForgeBoxColliderComponent).isTrigger=e.target.checked;})}/></Field><Field label="Friction"><input type="number" min="0" step="0.1" value={c.friction} onChange={e=>onChange(o=>{(o.getComponent('BoxCollider') as ForgeBoxColliderComponent).friction=Number(e.target.value);})}/></Field><Field label="Restitution"><input type="number" min="0" max="1" step="0.05" value={c.restitution} onChange={e=>onChange(o=>{(o.getComponent('BoxCollider') as ForgeBoxColliderComponent).restitution=Number(e.target.value);})}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'Animator') { const c=component as ForgeAnimationComponent; return <InspectorSection title="Animator" badge="ANIMATION"><Field label="Clip"><input value={c.clip} onChange={e=>onChange(o=>{(o.getComponent('Animator') as ForgeAnimationComponent).clip=e.target.value;})}/></Field><Field label="Speed"><input type="number" step="0.1" value={c.speed} onChange={e=>onChange(o=>{(o.getComponent('Animator') as ForgeAnimationComponent).speed=Number(e.target.value);})}/></Field><Field label="Playing"><input className="check-input" type="checkbox" checked={c.playing} onChange={e=>onChange(o=>{(o.getComponent('Animator') as ForgeAnimationComponent).playing=e.target.checked;})}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'AudioSource') { const c=component as ForgeAudioSourceComponent; return <InspectorSection title="Audio Source" badge="AUDIO"><Field label="Clip"><input value={c.clipPath} onChange={e=>onChange(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).clipPath=e.target.value;})}/></Field><Field label="Volume"><input type="number" min="0" max="1" step="0.05" value={c.volume} onChange={e=>onChange(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).volume=Number(e.target.value);})}/></Field><Field label="Loop"><input className="check-input" type="checkbox" checked={c.loop} onChange={e=>onChange(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).loop=e.target.checked;})}/></Field><Field label="Autoplay"><input className="check-input" type="checkbox" checked={c.autoplay} onChange={e=>onChange(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).autoplay=e.target.checked;})}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'VisualScript') { const c=component as ForgeVisualScriptComponent; return <InspectorSection title="Visual Script" badge="GRAPH"><Field label="Graph"><input value={c.graphPath} onChange={e=>onChange(o=>{(o.getComponent('VisualScript') as ForgeVisualScriptComponent).graphPath=e.target.value;})}/></Field><Field label="Auto Run"><input className="check-input" type="checkbox" checked={c.autoRun} onChange={e=>onChange(o=>{(o.getComponent('VisualScript') as ForgeVisualScriptComponent).autoRun=e.target.checked;})}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  if (component.type === 'RuntimeUI') { const c=component as ForgeRuntimeUIComponent; return <InspectorSection title="Runtime UI" badge="UI"><Field label="Kind"><select value={c.kind} onChange={e=>onChange(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).kind=e.target.value as ForgeRuntimeUIComponent['kind'];})}><option>text</option><option>button</option><option>panel</option><option>image</option></select></Field><Field label="Text"><input value={c.text} onChange={e=>onChange(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).text=e.target.value;})}/></Field><Field label="Visible"><input className="check-input" type="checkbox" checked={c.visible} onChange={e=>onChange(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).visible=e.target.checked;})}/></Field><RemoveButton component={component} onChange={onChange}/></InspectorSection>; }
  return null;
}

function InspectorSection({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) { return <section className="inspector-section"><header><strong>{title}</strong>{badge && <span>{badge}</span>}</header><div className="section-body">{children}</div></section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function FieldGroup({ label, fields }: { label: string; fields: React.ReactNode[] }) { return <div className="field-group"><span>{label}</span><div className="triple">{fields.map((f, i) => <React.Fragment key={i}>{f}</React.Fragment>)}</div><div className="axis-hints"><span>X</span><span>Y</span><span>Z</span></div></div>; }
function num(value: number, onChange: (value: number) => void) { return <input type="number" step="0.1" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))}/>; }

function BottomContent({ tab, project, scene, selected }: { tab: BottomTab; project: { name: string; root: string; mainScene: string; mode: ProjectMode }; scene: ForgeScene; selected: ForgeGameObject | null }) {
  const mutate = useEditorStore((s) => s.mutate);
  const select = useEditorStore((s) => s.select);
  if (tab === 'Project') return <div className="project-dock"><div className="project-tree"><div className="asset-root">⌂ {project.name}</div>{['Assets','Scenes','Scripts','Materials','Textures','Models','Audio','Animations','Prefabs','UI','Resources','Builds'].map((folder)=><div className="asset-row" key={folder}><span>▰</span>{folder}</div>)}</div><div className="asset-inspector"><div className="asset-location">Forge Project</div><div className="asset-empty"><span>◆</span><p>Project workspace</p><small>Use Assets to import files, Prefabs to create reusable objects, and Build Web from File.</small></div></div></div>;
  if (tab === 'Assets') return <AssetsPanel project={project}/>;
  if (tab === 'Prefabs') return <PrefabPanel project={project} scene={scene} selected={selected} onMutate={(fn)=>selected&&mutate(fn)} onSelect={select}/>;
  if (tab === 'Console') return <Console/>;
  if (tab === 'Scripts') return <ScriptPanel project={project} selected={selected}/>;
  if (tab === 'Animation') return <AnimationPanel selected={selected} onMutate={(fn)=>selected&&mutate(fn)}/>;
  if (tab === 'Visual Scripting') return <VisualScriptingPanel project={project} selected={selected} onMutate={(fn)=>selected&&mutate(fn)}/>;
  if (tab === 'Audio') return <AudioPanel selected={selected} onMutate={(fn)=>selected&&mutate(fn)}/>;
  if (tab === 'Runtime UI') return <RuntimeUIPanel selected={selected} onMutate={(fn)=>selected&&mutate(fn)}/>;
  if (tab === 'AI Help') return <AIHelpPanel project={project} scene={scene} selected={selected}/>;
  if (tab === 'Profiler') return <Profiler/>;
  return <Audit/>;
}

function ScriptPanel({ project, selected }: { project: { root: string }; selected: ForgeGameObject | null }) {
  const component = selected?.getComponent<ForgeScriptComponent>('Script');
  const [code, setCode] = useState('');
  const [diagnostics, setDiagnostics] = useState<string[]>([]);
  const [status, setStatus] = useState('Select a GameObject with a Script component.');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!component) { setCode(''); setDiagnostics([]); setStatus('Select a GameObject with a Script component.'); return; }
      try { const raw = await window.forgeDesktop.readScript(project.root, component.scriptPath); if (!cancelled) { setCode(raw); setDiagnostics([]); setStatus(`${component.scriptPath} loaded.`); } }
      catch { if (!cancelled) { const fallback = getDefaultScript(project.mode, component.className); setCode(fallback); setStatus(`${component.scriptPath} does not exist yet. Save to create it.`); } }
    }
    void load();
    return () => { cancelled = true; };
  }, [project.root, component?.scriptPath, component?.className]);
  if (!selected || !component) return <div className="script-empty"><span>⌘</span><strong>TypeScript Script Editor</strong><small>Attach a Script component to a GameObject, then open this panel.</small></div>;
  async function save() { try { await window.forgeDesktop.saveScript(project.root, component.scriptPath, code); setStatus(`Saved ${component.scriptPath}`); } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); } }
  function compile() { const result = compileForgeScript(code); setDiagnostics(result.diagnostics); setStatus(result.diagnostics.length ? 'Compile failed.' : 'TypeScript compiled successfully.'); }
  return <div className="script-panel"><div className="script-toolbar"><div><strong>{component.className}</strong><span>{component.scriptPath}</span></div><div><button onClick={save}>Save</button><button onClick={compile}>Compile</button></div></div><div className="script-editor"><Editor height="100%" defaultLanguage="typescript" theme="vs-dark" value={code} onChange={(v) => setCode(v ?? '')} options={{ minimap: { enabled: true }, fontSize: 12, automaticLayout: true, tabSize: 2, wordWrap: 'off', smoothScrolling: true }} /></div><div className={`script-status ${diagnostics.length ? 'error' : ''}`}><span>{status}</span>{diagnostics.map((d) => <span key={d}>• {d}</span>)}</div></div>;
}

function Console() { const logs = useEditorStore((s) => s.logs); return <div className="console-dock"><div className="console-toolbar"><span>{logs.length} messages</span><button onClick={() => useEditorStore.setState({ logs: [] })}>Clear</button></div><div className="console-lines">{logs.length === 0 ? <div className="console-empty">No console messages.</div> : logs.map((e) => <div className={`log-row ${e.level.toLowerCase()}`} key={e.id}><span className="log-badge">{e.level}</span><span>{e.message}</span></div>)}</div></div>; }
function Profiler() { const s = useEditorStore((state) => state.stats); return <div className="profiler-panel"><Metric label="FPS" value={s.fps.toFixed(1)}/><Metric label="Frame" value={`${s.frameTime.toFixed(2)} ms`}/><Metric label="Draw Calls" value={String(s.drawCalls)}/><Metric label="Objects" value={String(s.objects)}/></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function Audit() { const rows = [['Engine core','Implemented','Scene/GameObject/Component serialization'],['Project Manager','Implemented','Local create/open/reload workflow'],['2D Renderer','Implemented','Dedicated Canvas renderer + SpriteRenderer'],['3D Renderer','Implemented','Three.js WebGL2 viewport + orbit + gizmos'],['TypeScript + Monaco','Implemented','Save, diagnostics, lifecycle runtime'],['Startup + Help','Implemented','Animated boot + F1/context help'],['Physics','Implemented (MVP)','Rapier rigidbody + box collider runtime'],['Visual Scripting','Implemented (MVP)','JSON graph editor + runtime operations'],['Assets','Implemented (MVP)','Import, index and local asset data access'],['Prefabs','Implemented (MVP)','Prefab JSON + explicit PrefabLink instances'],['Animation','Implemented (MVP)','Transform clips + keyframes + runtime sampling'],['Audio','Implemented (MVP)','Howler AudioSource autoplay/loop/rate'],['Runtime UI','Implemented (MVP)','Persisted RuntimeUI component + Game View overlay'],['Web Build','Experimental','Produces Builds/Web scene + runtime shell; advanced asset/script packaging remains'],['AI Help','Implemented (Local)','Chat-style Forge AI with Ollama model picker, scene context, script saving, and offline fallback']]; return <div className="audit-table">{rows.map(([name,status,detail])=><div className="audit-row" key={name}><strong>{name}</strong><span className={`audit-status ${status.startsWith('Implemented')||status.startsWith('Optional')?'done':'next'}`}>{status}</span><small>{detail}</small></div>)}</div>; }

function HelpModal({ tool, mode, bottomTab, selected, onClose }: { tool: Tool; mode: ProjectMode; bottomTab: BottomTab; selected: ForgeGameObject | null; onClose: () => void }) {
  const topics = [
    { title: `${toolLabel(tool)} Tool`, text: tool === 'select' ? 'Select objects in the viewport or Hierarchy. Press Q to return to Select.' : `${toolLabel(tool)} modifies the selected object through the real Transform system. Shortcut: ${tool === 'move' ? 'W' : tool === 'rotate' ? 'E' : 'R'}.` },
    { title: `${mode} Workflow`, text: mode === '3D' ? 'Use GameObject > Create to add meshes, cameras and lights. Drag the gizmo directly in the 3D viewport.' : 'Use GameObject > Create Sprite. Drag the selected object in the 2D canvas or edit Transform values in the Inspector.' },
    { title: 'Scripts', text: 'Attach a TypeScript Script, open the Scripts panel, edit in Monaco, Save, then Compile. Play Mode calls start() once and update(delta) every frame.' },
    { title: 'Systems', text: 'Physics uses Rapier MVP components, Visual Scripting uses JSON graphs, Assets imports local files into Assets/, Prefabs are saved as Forge JSON, Animation uses transform keyframes, Audio uses Howler, and Runtime UI appears in Game View.' },
    { title: 'AI Help', text: 'Forge AI runs locally through Ollama when available. It can inspect the current scene, explain errors, write TypeScript, and help with 2D/3D workflows without a paid subscription.' },
    { title: 'Play Mode', text: 'Play isolates the authoring scene using a runtime snapshot. Stop restores the saved editor state. Pause freezes script updates; Step advances one frame.' },
    { title: 'Current Context', text: `Panel: ${bottomTab}${selected ? ` · Selected: ${selected.name}` : ' · Nothing selected'}. Press F1 any time to reopen this help.` },
  ];
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="help-modal" onMouseDown={(e) => e.stopPropagation()}><header><div><span className="eyebrow">FORGE HELP</span><h2>Need a hand?</h2><p>Context-aware guidance for the current editor state.</p></div><button onClick={onClose}>×</button></header><div className="help-body">{topics.map((topic) => <section key={topic.title}><strong>{topic.title}</strong><span>{topic.text}</span></section>)}</div><footer><span>F1</span> Open help anytime <button onClick={onClose}>Close</button></footer></div></div>;
}

function RuntimeUIOverlay({ scene }: { scene: ForgeScene }) {
  const items = scene.getObjects().map(o=>({o,ui:o.getComponent<ForgeRuntimeUIComponent>('RuntimeUI')})).filter(v=>v.ui?.enabled&&v.ui.visible);
  if (!items.length) return null;
  return <div className="runtime-ui-overlay" aria-label="Forge runtime UI">{items.map(({o,ui})=><div key={o.id} className={`runtime-widget runtime-${ui!.kind}`} style={{left:ui!.x,top:ui!.y,width:ui!.width,minHeight:ui!.height}}>{ui!.kind==='button'?<button>{ui!.text}</button>:ui!.kind==='panel'?<div>{ui!.text}</div>:ui!.kind==='image'?<div className="runtime-image-placeholder">{ui!.text}</div>:<span>{ui!.text}</span>}</div>)}</div>;
}

function ForgeSplash() {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const ids = [
      window.setTimeout(() => setStage(1), 520),
      window.setTimeout(() => setStage(2), 1120),
      window.setTimeout(() => setStage(3), 1780),
    ];
    return () => ids.forEach(window.clearTimeout);
  }, []);
  return <div className="forge-splash">
    <div className="splash-backdrop"/>
    <div className="splash-vignette"/>
    <div className="splash-scanline"/>
    <div className="splash-grid"/>
    <div className="splash-orbit orbit-a"/>
    <div className="splash-orbit orbit-b"/>
    <div className="splash-frame">
      <div className="splash-image-wrap">
        <div className="splash-image-glow"/>
        <img className="splash-image" src="/forge-engine-intro.jpg" alt="Forge Engine" draggable={false}/>
      </div>
      <div className="splash-meta">
        <div className="splash-kicker"><span className="pulse-dot"/> FORGE ENGINE <span>DESKTOP EDITOR</span></div>
        <div className="splash-sub">Initializing Editor Core</div>
        <div className="splash-progress"><i/></div>
        <div className="splash-stages">
          <span className={stage >= 1 ? 'on' : ''}>CORE</span>
          <span className={stage >= 2 ? 'on' : ''}>RENDERER</span>
          <span className={stage >= 3 ? 'on' : ''}>TOOLS</span>
          <span className={stage >= 3 ? 'on' : ''}>READY</span>
        </div>
      </div>
    </div>
    <div className="splash-footer"><span>Forge Engine 0.5.3</span><span>Local • No account required</span></div>
  </div>;
}
function TopMenu({ label, items }: { label: string; items: { label: string; shortcut?: string; onClick: () => void }[] }) { const [open, setOpen] = useState(false); return <div className="top-menu"><button className={open ? 'open' : ''} onClick={() => setOpen((v) => !v)}>{label}</button>{open && <div className="top-menu-popover">{items.map((item) => <button key={item.label} onClick={() => { setOpen(false); item.onClick(); }}><span>{item.label}</span><kbd>{item.shortcut ?? ''}</kbd></button>)}</div>}</div>; }
function ToolbarButton({ label, icon, active, onClick, shortcut }: { label: string; icon: string; active: boolean; onClick: () => void; shortcut: string }) { return <button className={`tool-button ${active ? 'active' : ''}`} onClick={onClick} title={`${label} (${shortcut})`}><span>{icon}</span><small>{label}</small></button>; }
function toolLabel(tool: Tool) { return tool.charAt(0).toUpperCase() + tool.slice(1); }

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
