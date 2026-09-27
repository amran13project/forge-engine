# Forge Engine 0.5.0

Forge Engine is a local-first desktop 2D + 3D game editor with an original architecture, branding and data format.

## 0.5.0 systems
- Professional dark editor workflow
- 2D + 3D project modes
- Three.js/WebGL2 3D editor with orbit camera and transform gizmos
- Dedicated 2D Canvas renderer
- TypeScript + Monaco scripting
- Rapier physics MVP
- Visual Scripting JSON graphs + runtime MVP
- Local Asset Browser + import
- Prefab JSON + PrefabLink foundation
- Transform Animation keyframes + runtime sampling
- Howler AudioSource MVP
- Runtime UI Game View overlay MVP
- Web build packaging for scene + Assets + local Three.js runtime when available
- Help system (F1 / ?)
- Startup animation
- AI Help: built-in local fallback, optional local Ollama, optional OpenRouter free-model adapter

## Run on Windows
Use Node.js 22+ and npm 10+.

```powershell
npm.cmd install
npm.cmd run dev
```

If PowerShell blocks `npm.ps1`, `npm.cmd` avoids that policy issue.

## Validation

```powershell
npm.cmd run typecheck
npm.cmd run test
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
npm.cmd run test:e2e
```

The model-generation environment used to prepare this archive did not have npm registry access, so full dependency installation and Electron/Vite build validation must be run on the development machine.

## Free AI Help
Forge Help always works without an account using its built-in fallback.

### Local AI with Ollama
Forge checks `http://127.0.0.1:11434` first. When Ollama is installed and has a local model, Forge sends the prompt through the local Ollama API. Local model execution does not require per-token API billing.

No API key is embedded in Forge. The detected Ollama model is used automatically.

### OpenRouter fallback
If Ollama is unavailable and `OPENROUTER_API_KEY` exists in the Electron process environment, Forge can use `openrouter/free`. This is an optional cloud adapter and free-model availability can change.

## Startup image
The splash is deliberately separated from the engine UI. A future uploaded Forge logo/splash image can replace the central animated mark without changing the renderer architecture.

## Feature status
See `FEATURE_AUDIT.md` for the exact implemented/experimental/not-yet-implemented state. The editor does not advertise incomplete systems as production-ready.
## Fix: package build synchronization

`npm.cmd run dev` now rebuilds Forge shared/core/renderer packages before starting Vite. This prevents stale `packages/core/dist` files from causing missing-export errors such as `ForgeBoxColliderComponent`.



### Startup intro
The editor uses `apps/editor/public/forge-engine-intro.jpg` as the startup splash artwork. Replace that file with another image of the same type to customize the intro without changing the React code.


## 0.5.4 hotfix notes
- Vite development aliases resolve Forge workspace packages from TypeScript source instead of stale/missing dist output.
- Vite filesystem access is explicitly allowed for the repository root.
- Renderer package manifests expose dist exports for packaged/production consumers.
- This prevents `Failed to resolve import "@forge/renderer-2d"` caused by missing or stale workspace package output.


## Forge 0.6 Dashboard

Forge opens into a dedicated Project Hub before the editor. The dashboard includes:

- Home / quick-start workspace
- Recent local projects with search
- 2D and 3D project creation
- Starter workflow cards
- Forge learning/help cards
- Local editor preferences
- Engine system status

The editor can return to the dashboard at any time through **File > Dashboard** or the Dashboard button in the editor chrome.

The dashboard is an original Forge workflow rather than a copy of another engine's UI.

## Forge AI — free local copilot

Forge AI is a local-first game-engine assistant. It runs through the Electron main process and talks to a local Ollama server on `127.0.0.1:11434`, so the editor does not need to ship an API key.

Features:
- Chat history per project
- Current scene + selected-object context
- Local model picker
- Script generation/debugging prompts
- Copy answers
- Save generated TypeScript to the selected Script component
- Built-in offline fallback when no local model is available

Setup: install Ollama separately, start a local model, then run Forge Engine. No paid subscription is required for the local path.

The optional OpenRouter adapter remains available when `OPENROUTER_API_KEY` is configured outside the renderer, but it is not required for Forge AI.

See `AI_SETUP.md` for the optional local Ollama setup.
