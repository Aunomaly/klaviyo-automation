import { geminiProvider } from './gemini'
import type { ImageProvider, ModelDescriptor } from './types'

// ─── Provider registry ────────────────────────────────────────────────────────
// To add a new provider (Imagen, Flux, etc.):
//   1. Create lib/image-providers/<name>.ts implementing ImageProvider
//   2. Import it here and add to PROVIDERS
//   3. No other changes needed — the API route and UI pick it up automatically

const PROVIDERS = new Map<string, ImageProvider>([
  ['gemini', geminiProvider],
  // ['imagen', imagenProvider],
  // ['fal', falProvider],
])

export function getProvider(providerId: string): ImageProvider {
  const provider = PROVIDERS.get(providerId)
  if (!provider) throw new Error(`Unknown image provider: "${providerId}"`)
  return provider
}

// Flat list of all models across all providers — used by the UI model picker
export const ALL_MODELS: ModelDescriptor[] = Array.from(PROVIDERS.values()).flatMap(
  (p) => p.models
)

export function getModelDescriptor(providerId: string, modelId: string): ModelDescriptor {
  const provider = getProvider(providerId)
  const model = provider.models.find((m) => m.id === modelId)
  if (!model) throw new Error(`Unknown model "${modelId}" for provider "${providerId}"`)
  return model
}

export type { ImageProvider, ImageGenerationRequest, ImageGenerationResult, ModelDescriptor } from './types'
