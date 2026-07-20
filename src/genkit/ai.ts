import 'dotenv/config';
import { genkit, type Genkit } from 'genkit';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { xAI } from '@genkit-ai/compat-oai/xai';
import { openAICompatible } from '@genkit-ai/compat-oai';

// Modelo por defecto de cada proveedor (sobreescribible con AI_MODEL).
const DEFAULT_MODELS: Record<string, string> = {
  openai: 'gpt-4o-mini',
  ollama: 'llava',
  xai: 'grok-2-vision-1212',
};

const provider = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
const model = process.env.AI_MODEL ?? DEFAULT_MODELS[provider] ?? '';

/**
 * Registra solo los proveedores utilizables: OpenAI y xAI exigen clave para
 * instanciarse; Ollama es local y no necesita clave real.
 */
function buildPlugins() {
  const plugins = [];
  if (process.env.OPENAI_API_KEY) {
    plugins.push(openAI());
  }
  if (process.env.XAI_API_KEY) {
    plugins.push(xAI());
  }
  plugins.push(
    openAICompatible({
      name: 'ollama',
      apiKey: process.env.OLLAMA_API_KEY || 'ollama',
      baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
    }),
  );
  return plugins;
}

/**
 * Instancia única de Genkit para el backend (ver docs/0005).
 * El proveedor/modelo activo se cambia por variables de entorno, sin tocar
 * los flows: AI_PROVIDER (openai | ollama | xai) y AI_MODEL.
 */
export const ai: Genkit = genkit({ plugins: buildPlugins() });

/** Referencia del modelo activo, p. ej. `openai/gpt-4o-mini` o `xai/grok-2-vision-1212`. */
export function currentModel(): string {
  return `${provider}/${model}`;
}
