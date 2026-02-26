export type AspectRatio = '1:1' | '16:9' | '4:3' | '3:4' | '9:16'
export type ImageSize = '1K' | '2K' | '4K'
export type ImageType = 'hero' | 'product' | 'lifestyle' | 'ad' | 'content'

export interface ReferenceImage {
  url: string
  mimeType?: string
}

export interface ImageGenerationRequest {
  prompt: string
  negativePrompt?: string
  referenceImages?: ReferenceImage[]
  aspectRatio?: AspectRatio
  imageSize?: ImageSize       // only supported by some models
  temperature?: number
  brandName?: string
  productName?: string
  imageType?: ImageType
}

export interface ImageGenerationResult {
  base64: string
  mimeType: string
  model: string
  provider: string
}

export interface ModelDescriptor {
  id: string               // e.g. 'gemini-2.5-flash-image'
  label: string            // e.g. 'Nano Banana'
  provider: string         // e.g. 'gemini'
  speed: 'fast' | 'slow'
  maxReferenceImages: number
  supportedSizes: ImageSize[]
  supportedRatios: AspectRatio[]
  supportsNegativePrompt: boolean
  supportsThinking: boolean
}

export interface ImageProvider {
  id: string
  name: string
  models: ModelDescriptor[]
  generate(modelId: string, req: ImageGenerationRequest): Promise<ImageGenerationResult>
}
