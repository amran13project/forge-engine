import { ForgeGameObject, ForgeLightComponent, ForgeScene, type ForgePrimitive } from '@forge/core';
export type EditorMode = 'editor' | 'play';
export type ProjectInfo = {
    root: string;
    name: string;
    mainScene: string;
    mode: '2D' | '3D';
};
export declare const useEditorStore: any;
export declare function addDefaultComponent(object: ForgeGameObject, type: string): ForgeGameObject;
export declare function createPrimitive(scene: ForgeScene, primitive: ForgePrimitive, name?: string): ForgeGameObject;
export declare function createCamera(scene: ForgeScene, name?: string): ForgeGameObject;
export declare function createLight(scene: ForgeScene, kind?: ForgeLightComponent['kind'], name?: string): ForgeGameObject;
