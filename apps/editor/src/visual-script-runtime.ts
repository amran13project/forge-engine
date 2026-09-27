import type { ForgeScene, ForgeVisualGraph, ForgeVisualScriptComponent } from '@forge/core';

export class ForgeVisualScriptRuntime {
  private graphs = new Map<string, ForgeVisualGraph>();
  private initialized = new Set<string>();
  setGraph(path:string, graph:ForgeVisualGraph){this.graphs.set(path,graph);}
  start(scene:ForgeScene, log:(level:'INFO'|'WARN'|'ERROR',message:string)=>void){
    for(const object of scene.getObjects()){
      const comp=object.getComponent<ForgeVisualScriptComponent>('VisualScript');
      if(!comp?.enabled||!comp.autoRun||this.initialized.has(object.id))continue;
      const graph=this.graphs.get(comp.graphPath); if(!graph)continue;
      for(const node of graph.nodes.filter(n=>n.type==='OnStart'))this.executeNode(node,object,graph,scene,log);
      this.initialized.add(object.id);
    }
  }
  update(scene:ForgeScene,log:(level:'INFO'|'WARN'|'ERROR',message:string)=>void){
    for(const object of scene.getObjects()){
      const comp=object.getComponent<ForgeVisualScriptComponent>('VisualScript'); if(!comp?.enabled)continue;
      const graph=this.graphs.get(comp.graphPath); if(!graph)continue;
      for(const node of graph.nodes.filter(n=>n.type==='OnUpdate'))this.executeNode(node,object,graph,scene,log);
    }
  }
  clear(){this.initialized.clear();}
  private executeNode(node:any,object:any,graph:any,scene:any,log:any){
    switch(node.type){
      case 'Translate': object.transform.position.x += Number(node.values?.x??0); object.transform.position.y += Number(node.values?.y??0); object.transform.position.z += Number(node.values?.z??0); break;
      case 'Rotate': object.transform.rotation.y += Number(node.values?.y??0); break;
      case 'SetScale': { const s=Number(node.values?.value??1); object.transform.scale={x:s,y:s,z:s}; break; }
      case 'Log': log('INFO',String(node.values?.message??'Visual Script')); break;
      case 'Branch': break;
      default: break;
    }
  }
}
