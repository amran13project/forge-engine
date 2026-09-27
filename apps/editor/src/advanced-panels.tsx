import React, { useEffect, useMemo, useState } from 'react';
import { ForgeAnimationComponent, ForgeAudioSourceComponent, ForgeGameObject, ForgePrefabLinkComponent, ForgeRuntimeUIComponent, ForgeVisualScriptComponent, ForgeScriptComponent, type ForgeVisualGraph, type ForgeVisualNodeType } from '@forge/core';
import { useEditorStore } from './store';

export function AssetsPanel({ project }: { project: { root: string } }) {
  const [files,setFiles]=useState<Array<{path:string;size:number;kind:'file'|'folder'}>>([]);
  const [busy,setBusy]=useState(false);
  const load=async()=>{setBusy(true);try{setFiles(await window.forgeDesktop.listFiles(project.root,'Assets'));}finally{setBusy(false);}};
  useEffect(()=>{void load();},[project.root]);
  async function importAsset(){const source=await window.forgeDesktop.chooseAsset();if(!source)return;try{const rel=await window.forgeDesktop.importAsset(project.root,source);useEditorStore.getState().log('INFO',`Imported ${rel}`);void load();}catch(e){useEditorStore.getState().log('ERROR',e instanceof Error?e.message:String(e));}}
  return <div className="advanced-panel"><div className="advanced-toolbar"><strong>Assets</strong><span>{files.filter(f=>f.kind==='file').length} files</span><div><button onClick={() => void load()} disabled={busy}>Refresh</button><button onClick={() => void importAsset()}>Import</button></div></div><div className="asset-grid">{files.length===0?<div className="asset-empty"><span>▧</span><p>Assets is empty</p><small>Import PNG, JPG, WebP, WAV, MP3, OGG, GLB, GLTF, OBJ, TS or JSON.</small></div>:files.filter(f=>f.kind==='file').map(f=><button key={f.path} className="asset-card" title={f.path}><span className="asset-type">{f.path.split('.').pop()?.toUpperCase()||'FILE'}</span><strong>{f.path.split('/').pop()}</strong><small>{formatBytes(f.size)}</small></button>)}</div></div>;
}

export function PrefabPanel({ project, scene, selected, onMutate, onSelect }: { project:{root:string}; scene:any; selected:ForgeGameObject|null; onMutate:(fn:(o:ForgeGameObject)=>void)=>void; onSelect:(id:string)=>void }) {
  const [files,setFiles]=useState<Array<{path:string;size:number;kind:'file'|'folder'}>>([]);
  const [pick,setPick]=useState('');
  async function load(){setFiles(await window.forgeDesktop.listFiles(project.root,'Prefabs'));}
  useEffect(()=>{void load();},[project.root]);
  async function createPrefab(){if(!selected){useEditorStore.getState().log('WARN','Select an object first.');return;}const rel=`Prefabs/${selected.name.replace(/[^A-Za-z0-9_-]/g,'_')}.forge-prefab.json`;try{await window.forgeDesktop.saveJson(project.root,rel,selected.serialize());onMutate(o=>{const link=o.getComponent<ForgePrefabLinkComponent>('PrefabLink')??(o.addComponent(new ForgePrefabLinkComponent()) as ForgePrefabLinkComponent);link.prefabPath=rel;link.sourceHash=JSON.stringify(selected.serialize()).length.toString(16);});useEditorStore.getState().log('INFO',`Created prefab ${rel}`);await load();}catch(e){useEditorStore.getState().log('ERROR',e instanceof Error?e.message:String(e));}}
  async function instantiate(){if(!pick)return;try{const raw=await window.forgeDesktop.readScene(project.root,pick);const data=JSON.parse(raw);const obj=ForgeGameObjectDeserializeForPrefab(data);scene.addObject(obj,null);onSelect(obj.id);useEditorStore.setState({dirty:true});useEditorStore.getState().log('INFO',`Instantiated ${pick}`);}catch(e){useEditorStore.getState().log('ERROR',e instanceof Error?e.message:String(e));}}
  return <div className="advanced-panel"><div className="advanced-toolbar"><div><strong>Prefabs</strong><span>Reusable scene objects</span></div><div><button onClick={() => void createPrefab()} disabled={!selected}>Create Prefab</button><button onClick={() => void load()}>Refresh</button></div></div><div className="prefab-workbench"><div className="prefab-list">{files.filter(f=>f.kind==='file').length===0?<div className="coming-small">No prefabs yet.</div>:files.filter(f=>f.kind==='file').map(f=><button key={f.path} className={pick===f.path?'selected':''} onClick={()=>setPick(f.path)}>{f.path.replace('Prefabs/','')}</button>)}</div><div className="prefab-actions"><div><span>Selected</span><strong>{selected?.name??'—'}</strong></div><button onClick={()=>void instantiate()} disabled={!pick}>Instantiate</button><small>Prefab instances carry a PrefabLink component so the source path remains explicit in the scene data.</small></div></div></div>;
}

function ForgeGameObjectDeserializeForPrefab(data:any):ForgeGameObject {
  const object=new ForgeGameObject(data.name||'Prefab Instance');
  object.transform.position={...data.transform.position};object.transform.rotation={...data.transform.rotation};object.transform.scale={...data.transform.scale};object.active=data.active!==false;
  if(Array.isArray(data.components)){
    const raw=data.components.find((c:any)=>c.type==='PrefabLink');
    if(raw){const link=new ForgePrefabLinkComponent();Object.assign(link,raw.properties);object.addComponent(link);}
  }
  return object;
}

export function AnimationPanel({ selected, onMutate }: { selected:ForgeGameObject|null; onMutate:(fn:(o:ForgeGameObject)=>void)=>void }) {
  const animator=selected?.getComponent<ForgeAnimationComponent>('Animator');
  const [,tick]=useState(0);
  const force=()=>tick(v=>v+1);
  if(!selected)return <EmptyPanel icon="◫" title="Animation" text="Select an object to create transform clips."/>;
  function ensure(){onMutate(o=>{if(!o.getComponent('Animator'))o.addComponent(new ForgeAnimationComponent());});}
  function addClip(){ensure();onMutate(o=>{const a=o.getComponent<ForgeAnimationComponent>('Animator')!;if(a.clips.some(c=>c.name==='Take 001'))return;a.clips.push({name:'Take 001',length:1,loop:true,keyframes:[{time:0,position:{...o.transform.position},rotation:{...o.transform.rotation},scale:{...o.transform.scale}}]});a.clip='Take 001';});force();}
  function key(time:number){onMutate(o=>{const a=o.getComponent<ForgeAnimationComponent>('Animator');if(!a||!a.clip)return;const clip=a.clips.find(c=>c.name===a.clip);if(!clip)return;const found=clip.keyframes.find(k=>Math.abs(k.time-time)<0.001);const key={time,position:{...o.transform.position},rotation:{...o.transform.rotation},scale:{...o.transform.scale}};if(found)Object.assign(found,key);else clip.keyframes.push(key);clip.keyframes.sort((x,y)=>x.time-y.time);});force();}
  function togglePlay(){onMutate(o=>{const a=o.getComponent<ForgeAnimationComponent>('Animator');if(a)a.playing=!a.playing;});force();}
  return <div className="advanced-panel"><div className="advanced-toolbar"><div><strong>Animation</strong><span>{selected.name}</span></div><div><button onClick={addClip}>New Clip</button><button onClick={togglePlay} disabled={!animator?.clip}>{animator?.playing?'Stop Preview':'Preview'}</button></div></div>{!animator?<div className="animation-onboard"><p>No Animator component yet.</p><button onClick={ensure}>Add Animator</button></div>:<div className="animation-editor"><div className="animation-controls"><label>Clip<select value={animator.clip} onChange={e=>{onMutate(o=>{const a=o.getComponent<ForgeAnimationComponent>('Animator');if(a)a.clip=e.target.value;});force();}}><option value="">Select...</option>{animator.clips.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select></label><label>Speed<input type="number" min="0" step="0.1" value={animator.speed} onChange={e=>{onMutate(o=>{const a=o.getComponent<ForgeAnimationComponent>('Animator');if(a)a.speed=Number(e.target.value);});force();}}/></label></div><div className="timeline-ruler"><button onClick={()=>key(0)}>◆ 0s</button><button onClick={()=>key(0.25)}>◆ .25</button><button onClick={()=>key(0.5)}>◆ .50</button><button onClick={()=>key(0.75)}>◆ .75</button><button onClick={()=>key(1)}>◆ 1s</button></div><div className="timeline-track">{(animator.clips.find(c=>c.name===animator.clip)?.keyframes??[]).map(k=><div className="keyframe" style={{left:`${Math.min(98,k.time*100)}%`}} key={k.time} title={`Key ${k.time}s`}>◆</div>)}</div><small>Transform animation is stored as real clip/keyframe data and evaluated during Play Mode.</small></div>}</div>;
}

export function VisualScriptingPanel({ project, selected, onMutate }: { project:{root:string}; selected:ForgeGameObject|null; onMutate:(fn:(o:ForgeGameObject)=>void)=>void }) {
  const component=selected?.getComponent<ForgeVisualScriptComponent>('VisualScript');
  const [graph,setGraph]=useState<ForgeVisualGraph>({nodes:[],connections:[],variables:{}});
  const [connectFrom,setConnectFrom]=useState<string|null>(null);
  const [status,setStatus]=useState('Select a GameObject with a Visual Script.');
  useEffect(()=>{let dead=false;(async()=>{if(!component){setGraph({nodes:[],connections:[],variables:{}});setStatus('Attach Visual Script to begin.');return;}try{const raw=await window.forgeDesktop.readScene(project.root,component.graphPath);if(!dead)setGraph(JSON.parse(raw));}catch{if(!dead)setGraph({nodes:[{id:'start',type:'OnStart',x:30,y:30}],connections:[],variables:{}});}})();return()=>{dead=true}},[project.root,component?.graphPath]);
  if(!selected)return <EmptyPanel icon="⌘" title="Visual Scripting" text="Select an object and attach a Visual Script component."/>;
  function ensure(){onMutate(o=>{if(!o.getComponent('VisualScript'))o.addComponent(new ForgeVisualScriptComponent());});setStatus('Visual Script component added.');}
  function addNode(type:ForgeVisualNodeType){const node={id:`node_${Date.now()}_${graph.nodes.length}`,type,x:40+graph.nodes.length*18,y:40+graph.nodes.length*18,values:type==='Translate'?{x:0,y:1,z:0}:type==='Rotate'?{y:45}:type==='Log'?{message:'Hello from Visual Script'}:{}};setGraph(g=>({...g,nodes:[...g.nodes,node]}));}
  function connect(id:string){if(!connectFrom){setConnectFrom(id);return;}if(connectFrom!==id)setGraph(g=>({...g,connections:[...g.connections,{from:connectFrom,to:id}]}));setConnectFrom(null)}
  async function save(){if(!component)return;try{await window.forgeDesktop.saveJson(project.root,component.graphPath,graph);setStatus(`Saved ${component.graphPath}`);}catch(e){setStatus(e instanceof Error?e.message:String(e));}}
  return <div className="advanced-panel"><div className="advanced-toolbar"><div><strong>Visual Scripting</strong><span>{component?component.graphPath:'Not attached'}</span></div><div>{(['OnStart','OnUpdate','Translate','Rotate','SetScale','Log','Branch'] as ForgeVisualNodeType[]).map(t=><button key={t} onClick={()=>addNode(t)}>{t.replace('On','')}</button>)}<button onClick={()=>void save()} disabled={!component}>Save Graph</button></div></div>{!component?<div className="animation-onboard"><p>This object has no VisualScript.</p><button onClick={ensure}>Add Visual Script</button></div>:<div className="node-editor">{graph.nodes.map(n=><div key={n.id} className={`graph-node ${connectFrom===n.id?'armed':''}`} style={{left:n.x,top:n.y}}><header><span>{n.type}</span><button onClick={()=>connect(n.id)}>●</button></header><div>{n.type==='Translate'?<><label>X<input type="number" value={Number(n.values?.x??0)} onChange={e=>setGraph(g=>({...g,nodes:g.nodes.map(v=>v.id===n.id?{...v,values:{...v.values,x:Number(e.target.value)}}:v)}))}/></label><label>Y<input type="number" value={Number(n.values?.y??0)} onChange={e=>setGraph(g=>({...g,nodes:g.nodes.map(v=>v.id===n.id?{...v,values:{...v.values,y:Number(e.target.value)}}:v)}))}/></label></>:n.type==='Log'?<input value={String(n.values?.message??'')} onChange={e=>setGraph(g=>({...g,nodes:g.nodes.map(v=>v.id===n.id?{...v,values:{...v.values,message:e.target.value}}:v)}))}/>:<small>{n.type==='Branch'?'Condition node':'Runtime operation'}</small>}</div></div>)}<div className="graph-connections">{graph.connections.map((c,i)=><span key={i}>{c.from} → {c.to}</span>)}</div></div>}</div>;
}

export function AudioPanel({ selected, onMutate }: { selected:ForgeGameObject|null; onMutate:(fn:(o:ForgeGameObject)=>void)=>void }) {
  const audio=selected?.getComponent<ForgeAudioSourceComponent>('AudioSource');
  if(!selected)return <EmptyPanel icon="♪" title="Audio" text="Select an object to configure AudioSource."/>;
  function ensure(){onMutate(o=>{if(!o.getComponent('AudioSource'))o.addComponent(new ForgeAudioSourceComponent());});}
  if(!audio)return <div className="audio-onboard"><p>No AudioSource component.</p><button onClick={ensure}>Add AudioSource</button></div>;
  return <div className="advanced-panel"><div className="advanced-toolbar"><div><strong>Audio</strong><span>{selected.name}</span></div></div><div className="audio-form"><label>Clip path<input value={audio.clipPath} onChange={e=>onMutate(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).clipPath=e.target.value;})} placeholder="Audio/music.ogg"/></label><label>Volume<input type="range" min="0" max="1" step="0.01" value={audio.volume} onChange={e=>onMutate(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).volume=Number(e.target.value);})}/><span>{audio.volume.toFixed(2)}</span></label><label>Rate<input type="number" min="0.05" max="4" step="0.05" value={audio.rate} onChange={e=>onMutate(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).rate=Number(e.target.value);})}/></label><label><input type="checkbox" checked={audio.loop} onChange={e=>onMutate(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).loop=e.target.checked;})}/> Loop</label><label><input type="checkbox" checked={audio.autoplay} onChange={e=>onMutate(o=>{(o.getComponent('AudioSource') as ForgeAudioSourceComponent).autoplay=e.target.checked;})}/> Autoplay in Play Mode</label></div></div>;
}

export function RuntimeUIPanel({ selected, onMutate }: { selected:ForgeGameObject|null; onMutate:(fn:(o:ForgeGameObject)=>void)=>void }) {
  const ui=selected?.getComponent<ForgeRuntimeUIComponent>('RuntimeUI');
  if(!selected)return <EmptyPanel icon="▤" title="Runtime UI" text="Select an object to create a runtime UI element."/>;
  function ensure(){onMutate(o=>{if(!o.getComponent('RuntimeUI'))o.addComponent(new ForgeRuntimeUIComponent());});}
  if(!ui)return <div className="audio-onboard"><p>No RuntimeUI component.</p><button onClick={ensure}>Add Runtime UI</button></div>;
  return <div className="advanced-panel"><div className="advanced-toolbar"><div><strong>Runtime UI</strong><span>{selected.name}</span></div></div><div className="audio-form"><label>Kind<select value={ui.kind} onChange={e=>onMutate(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).kind=e.target.value as ForgeRuntimeUIComponent['kind'];})}><option>text</option><option>button</option><option>panel</option><option>image</option></select></label><label>Text<input value={ui.text} onChange={e=>onMutate(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).text=e.target.value;})}/></label><label>Position<input value={`${ui.x}, ${ui.y}`} readOnly/></label><label>Width<input type="number" value={ui.width} onChange={e=>onMutate(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).width=Number(e.target.value);})}/></label><label>Height<input type="number" value={ui.height} onChange={e=>onMutate(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).height=Number(e.target.value);})}/></label><label><input type="checkbox" checked={ui.visible} onChange={e=>onMutate(o=>{(o.getComponent('RuntimeUI') as ForgeRuntimeUIComponent).visible=e.target.checked;})}/> Visible</label></div></div>;
}

export function AIHelpPanel({ project, scene, selected }: { project:{root:string}; scene:any; selected:ForgeGameObject|null }) {
  type ChatMessage = { role: 'user' | 'assistant'; content: string };
  const storageKey = `forge.ai.chat:${project.root}`;
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? JSON.parse(raw) as ChatMessage[] : [];
    } catch { return []; }
  });
  const [question, setQuestion] = useState('');
  const [models, setModels] = useState<Array<{name:string;size:number;modifiedAt:string}>>([]);
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState('Forge AI · Offline');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Checking local AI…');
  const [copied, setCopied] = useState(false);

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40))); }, [messages, storageKey]);
  useEffect(() => { void refreshModels(); }, []);

  async function refreshModels() {
    try {
      const list = await window.forgeDesktop.aiModels();
      setModels(list);
      if (!model && list[0]) setModel(list[0].name);
      setStatus(list.length ? `${list.length} local model${list.length === 1 ? '' : 's'} ready` : 'No local model found');
    } catch { setModels([]); setStatus('Local AI unavailable'); }
  }

  function buildContext() {
    const selectedData = selected ? {
      id: selected.id,
      name: selected.name,
      active: selected.active,
      transform: selected.transform,
      components: selected.components.map((c:any) => ({ type: c.type, enabled: c.enabled, properties: c.properties ?? {} })),
    } : null;
    const sceneData = scene?.serialize?.() ?? {};
    return JSON.stringify({
      engine: 'Forge Engine 0.7.0',
      projectMode: scene?.mode ?? '3D',
      scene: { name: scene?.name ?? 'Scene', objectCount: scene?.getObjects?.().length ?? 0, objects: sceneData.objects?.slice?.(0, 80) ?? [] },
      selected: selectedData,
      capabilities: ['2D', '3D', 'TypeScript', 'Monaco', 'Rapier physics MVP', 'Visual scripting MVP', 'Assets MVP', 'Prefabs MVP', 'Animation MVP', 'Audio MVP', 'Runtime UI MVP', 'Web build experimental'],
    }, null, 2);
  }

  async function ask(text?: string) {
    const content = (text ?? question).trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setQuestion('');
    setBusy(true);
    setStatus('Thinking…');
    try {
      const result = await window.forgeDesktop.aiChat(next, buildContext(), model || undefined);
      setProvider(result.provider);
      setMessages((current) => [...current, { role: 'assistant', content: result.answer }]);
      setStatus(result.local ? (result.model === 'built-in' ? 'Offline fallback' : 'Running locally') : 'Remote free model');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMessages((current) => [...current, { role: 'assistant', content: `Forge AI error: ${message}` }]);
      setStatus('AI request failed');
    } finally { setBusy(false); }
  }

  function newChat() { setMessages([]); setProvider('Forge AI · Offline'); setStatus(models.length ? `${models.length} local model${models.length === 1 ? '' : 's'} ready` : 'No local model found'); }
  function extractCode(text: string) {
    const fenced = text.match(/```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)```/i);
    return fenced?.[1]?.trim() || text.trim();
  }
  async function saveGeneratedScript() {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    const script = selected?.getComponent<ForgeScriptComponent>('Script');
    if (!last || !script) { setStatus('Select an object with a Script component first.'); return; }
    try {
      await window.forgeDesktop.saveScript(project.root, script.scriptPath, extractCode(last.content));
      useEditorStore.getState().log('INFO', `Forge AI saved ${script.scriptPath}`);
      setStatus(`Saved ${script.scriptPath}`);
    } catch (error) { setStatus(error instanceof Error ? error.message : String(error)); }
  }
  async function copyLast() {
    const last = [...messages].reverse().find(m => m.role === 'assistant');
    if (!last) return;
    await navigator.clipboard.writeText(last.content);
    setCopied(true); window.setTimeout(() => setCopied(false), 1200);
  }

  const quick = selected
    ? ['Explain this selected object', 'Write a TypeScript controller for this object', 'Add physics to this object', 'Improve this object for a 3D game']
    : ['How do I make a 2D platformer?', 'How do I make a 3D character controller?', 'Explain Forge Engine physics', 'How do I create a visual script?'];

  return <div className="advanced-panel forge-ai-panel">
    <div className="ai-header">
      <div className="ai-title-wrap"><div className="ai-avatar">F</div><div><strong>Forge AI</strong><span>{provider}</span></div></div>
      <div className="ai-header-actions"><button onClick={()=>void refreshModels()}>↻</button><button onClick={newChat}>New chat</button></div>
    </div>
    <div className="ai-model-bar">
      <span className={`ai-live-dot ${models.length ? 'online' : ''}`}/>
      <span>{status}</span>
      <select value={model} onChange={e=>setModel(e.target.value)} disabled={!models.length} title="Local Ollama model">
        {models.length ? models.map(m=><option key={m.name} value={m.name}>{m.name}</option>) : <option value="">Built-in offline help</option>}
      </select>
      <span className="ai-free-badge">FREE LOCAL</span>
    </div>
    <div className="ai-context-strip"><span>Context</span><b>{scene?.name ?? 'Scene'}</b><i>•</i><b>{scene?.mode ?? '3D'}</b><i>•</i><b>{selected?.name ?? 'No selection'}</b></div>
    <div className="ai-chat-scroll">
      {messages.length === 0 ? <div className="ai-welcome"><div className="ai-welcome-mark">✦</div><h3>Build with Forge AI</h3><p>Your local game-engine copilot. Ask for scripts, scene ideas, debugging help, component setup, or explanations.</p><div className="ai-quick-grid">{quick.map(q=><button key={q} onClick={()=>void ask(q)}>{q}<span>↗</span></button>)}</div><small>Local AI uses Ollama on your PC. No subscription or API key is required.</small></div> : messages.map((m,i)=><div className={`ai-message ${m.role}`} key={`${i}-${m.content.slice(0,12)}`}><div className="ai-message-avatar">{m.role==='user'?'You':'F'}</div><div className="ai-message-bubble"><div className="ai-message-label">{m.role==='user'?'You':'Forge AI'}</div><pre>{m.content}</pre></div></div>)}
      {busy && <div className="ai-message assistant"><div className="ai-message-avatar">F</div><div className="ai-thinking"><span/><span/><span/></div></div>}
    </div>
    {messages.some(m=>m.role==='assistant') && <div className="ai-action-row"><button onClick={()=>void copyLast()}>{copied?'Copied':'Copy answer'}</button><button onClick={()=>void saveGeneratedScript()} disabled={!selected?.getComponent<ForgeScriptComponent>('Script')}>Save answer to selected Script</button></div>}
    <div className="ai-composer"><textarea value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void ask();}}} placeholder="Message Forge AI…" rows={2}/><button className="ai-send" onClick={()=>void ask()} disabled={busy||!question.trim()}>➤</button></div>
    <div className="ai-footer"><span>Enter to send · Shift+Enter for a new line</span><span>Local-first • Free</span></div>
  </div>;
}

export function EmptyPanel({ icon, title, text }: { icon:string;title:string;text:string }) { return <div className="coming-panel"><div className="coming-icon">{icon}</div><strong>{title}</strong><span>{text}</span></div>; }
function formatBytes(n:number){if(n<1024)return `${n} B`;if(n<1024*1024)return `${(n/1024).toFixed(1)} KB`;return `${(n/1024/1024).toFixed(1)} MB`;}
