import { ForgeAnimationComponent, ForgeScene, type ForgeAnimationClip, type ForgeAnimationKeyframe } from '@forge/core';

function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
function sample(keys: ForgeAnimationKeyframe[], time: number) {
  if (!keys.length) return null;
  const sorted=[...keys].sort((a,b)=>a.time-b.time);
  if(time<=sorted[0].time)return sorted[0];
  const last=sorted[sorted.length-1]; if(time>=last.time)return last;
  let left=sorted[0],right=sorted[1];
  for(let i=1;i<sorted.length;i++){if(time<=sorted[i].time){left=sorted[i-1];right=sorted[i];break;}}
  const t=(time-left.time)/Math.max(0.0001,right.time-left.time);
  const out:ForgeAnimationKeyframe={time};
  if(left.position&&right.position)out.position={x:lerp(left.position.x,right.position.x,t),y:lerp(left.position.y,right.position.y,t),z:lerp(left.position.z,right.position.z,t)};
  if(left.rotation&&right.rotation)out.rotation={x:lerp(left.rotation.x,right.rotation.x,t),y:lerp(left.rotation.y,right.rotation.y,t),z:lerp(left.rotation.z,right.rotation.z,t)};
  if(left.scale&&right.scale)out.scale={x:lerp(left.scale.x,right.scale.x,t),y:lerp(left.scale.y,right.scale.y,t),z:lerp(left.scale.z,right.scale.z,t)};
  return out;
}

export class ForgeAnimationRuntime {
  private clocks=new Map<string,number>();
  update(scene: ForgeScene, delta:number) {
    for(const object of scene.getObjects()){
      const animator=object.getComponent<ForgeAnimationComponent>('Animator');
      if(!animator?.enabled||!animator.playing||!animator.clip)continue;
      const clip=animator.clips.find(c=>c.name===animator.clip); if(!clip)continue;
      let time=(this.clocks.get(object.id)??0)+delta*animator.speed;
      if(clip.loop)time=clip.length?time%clip.length:0; else time=Math.min(time,clip.length);
      this.clocks.set(object.id,time);
      const pose=sample(clip.keyframes,time); if(!pose)continue;
      if(pose.position)object.transform.position={...pose.position};
      if(pose.rotation)object.transform.rotation={...pose.rotation};
      if(pose.scale)object.transform.scale={...pose.scale};
    }
  }
  reset(){this.clocks.clear();}
}

export function makeTransformClip(name='Take 001'): ForgeAnimationClip {
  return {name,length:1,loop:true,keyframes:[{time:0},{time:1}]};
}
