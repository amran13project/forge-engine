# Forge Engine 0.6.0 Feature Audit

## Implemented
- Secure Electron main/preload/renderer boundary
- Project Manager with 2D/3D project selection
- Scene/GameObject/Component serialization
- Undo/Redo command history foundation
- Real 3D Three.js/WebGL2 viewport, orbit camera and transform gizmos
- Dedicated 2D Canvas viewport
- TypeScript scripting + Monaco + compile diagnostics + lifecycle runtime
- Contextual Help (F1 / ?)
- Professional startup splash animation
- Rapier 3D rigidbody + box collider runtime MVP
- JSON Visual Scripting graph editor + runtime node execution MVP
- Asset Browser with local import/indexing and binary data access
- Prefab JSON creation + PrefabLink instance metadata MVP
- Transform animation clips/keyframes + runtime sampling MVP
- Howler AudioSource runtime MVP
- Runtime UI component + Game View overlay MVP
- Web export packaging scene + Assets + local Three.js runtime when available
- AI Help panel with built-in no-network fallback
- Optional local Ollama AI adapter (no API bill for local inference)
- Optional OpenRouter free-model adapter (requires user-provided API key)

## Experimental / Partial
- Web build: basic 2D/3D rendering is packaged and executable, but arbitrary TypeScript gameplay scripts are not yet bundled/executed in the generated Web build.
- Visual Scripting: graph JSON persistence and basic execution are implemented; production-grade typed ports, full flow/data routing, and graph compiler are later work.
- Physics: 3D rigidbody/box collider MVP exists; 2D physics, joints, materials, layers/masks, and full collision events remain later work.
- Assets: initial importer/indexing exists; GLTF dependency files, texture processing, thumbnails and advanced import settings remain later work.
- Prefabs: source-linked prefab metadata and instantiation foundation exists; deep overrides, nested prefabs, apply/revert and live propagation remain later work.
- Animation: transform keyframe system exists; skeletal animation, state machines, blending and timeline tooling remain later work.
- Audio: basic AudioSource playback exists; mixer buses, spatial attenuation, editor waveform tools and full listener workflow remain later work.
- Runtime UI: basic persisted UI elements render in Game View; responsive anchors, events, layout groups and full runtime input are later work.

## Not yet implemented
- Mobile APK exporter/validation
- Terrain sculpting and painting
- Navigation mesh baking/agent system
- Production profiling/memory inspection
- Full Windows/Linux/macOS exporters
## 0.5.1 Fix
- Core runtime component exports are included in `packages/core/src/index.ts`.
- Development startup rebuilds package dist outputs before launching the editor.
- Prevents stale-dist missing export failures.



## 0.6.0 Dashboard Workspace
- Professional Forge Dashboard / Project Hub is implemented as the launch workspace.
- Home, Projects, Templates, Learn and Preferences sections are functional local UI flows.
- New 2D / New 3D quick-start actions reuse the real project creation system.
- Recent Projects search/open uses the existing local project workflow.
- Continue Editing returns to the active editor without creating a second engine state.
- Dashboard is accessible from the editor through File > Dashboard and the editor toolbar button.
- Dashboard uses the supplied Forge Engine artwork as original project branding.

## 0.6.0 Design Rule
The dashboard and editor use Forge-specific branding, terminology, layout details and workflows. They are inspired by professional engine workflows but do not copy proprietary source code, assets or branding from other engines.
