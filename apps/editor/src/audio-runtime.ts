import { Howl } from 'howler';
import type { ForgeScene, ForgeAudioSourceComponent } from '@forge/core';

export class ForgeAudioRuntime {
  private sounds = new Map<string,Howl>();
  async start(scene:ForgeScene,root:string,readAsset:(root:string,path:string)=>Promise<string>,log:(level:'INFO'|'WARN'|'ERROR',message:string)=>void){
    for(const object of scene.getObjects()){
      const source=object.getComponent<ForgeAudioSourceComponent>('AudioSource');
      if(!source?.enabled||!source.clipPath||!source.autoplay)continue;
      try{
        const url=await readAsset(root,source.clipPath);
        const howl=new Howl({src:[url],volume:Math.max(0,Math.min(1,source.volume)),loop:source.loop,rate:Math.max(.05,source.rate),onloaderror:(_id,err)=>log('ERROR',`Audio load failed: ${String(err)}`)});
        this.sounds.set(object.id,howl); howl.play();
      }catch(e){log('ERROR',e instanceof Error?e.message:String(e));}
    }
  }
  clear(){for(const sound of this.sounds.values())sound.unload();this.sounds.clear();}
}
