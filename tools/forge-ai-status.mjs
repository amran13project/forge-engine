const base = process.env.OLLAMA_HOST?.replace(/\/$/, '') || 'http://127.0.0.1:11434';
try {
  const response = await fetch(`${base}/api/tags`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  const models = (body.models ?? []).map((m) => m.name).filter(Boolean);
  console.log(`Forge AI: Ollama online at ${base}`);
  console.log(models.length ? `Models: ${models.join(', ')}` : 'No local models installed. Install a model with Ollama, then restart Forge AI.');
} catch (error) {
  console.log(`Forge AI: local Ollama unavailable at ${base}.`);
  console.log('Start Ollama and a local model to enable the free local copilot.');
  console.log(`Details: ${error instanceof Error ? error.message : String(error)}`);
}
