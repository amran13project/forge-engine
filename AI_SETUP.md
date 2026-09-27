# Forge AI — local, free copilot

Forge AI is designed to run locally through Ollama. The Forge renderer never receives a private AI key; the Electron main process calls the local Ollama HTTP API.

## 1. Install Ollama
Install Ollama separately on the development PC using the official installer.

## 2. Install a local model
Use any model supported by your Ollama installation. For example, from a terminal you can run:

```powershell
ollama pull <your-model>
```

Then start it with:

```powershell
ollama run <your-model>
```

The exact model and its disk/RAM requirements are your choice.

## 3. Start Forge Engine

```powershell
npm.cmd run dev
```

Open **Forge AI** from the top toolbar or the **AI Help** panel.

## What Forge AI knows

Forge sends the current editor context with each chat request:

- current project mode (2D/3D)
- current scene
- object count and scene data
- selected GameObject
- selected Transform
- selected components and properties
- Forge Engine capabilities

The assistant can explain errors, write TypeScript, suggest components, explain physics/animation/visual scripting, and save a generated answer to the selected Script component.

## No local model

Forge AI still has an offline built-in fallback. It does not pretend that an LLM is running when none is available.

## Optional remote adapter

The existing OpenRouter free-model adapter remains optional. It is disabled unless `OPENROUTER_API_KEY` exists in the Electron process environment.
