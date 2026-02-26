import { GoogleGenAI } from '@google/genai'
import type {
  ImageProvider,
  ImageGenerationRequest,
  ImageGenerationResult,
  ModelDescriptor,
} from './types'

const MODELS: ModelDescriptor[] = [
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    provider: 'gemini',
    speed: 'fast',
    maxReferenceImages: 3,
    supportedSizes: ['1K'],
    supportedRatios: ['1:1', '16:9', '4:3', '3:4', '9:16'],
    supportsNegativePrompt: false,
    supportsThinking: false,
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    provider: 'gemini',
    speed: 'slow',
    maxReferenceImages: 14,
    supportedSizes: ['1K', '2K', '4K'],
    supportedRatios: ['1:1', '16:9', '4:3', '3:4', '9:16'],
    supportsNegativePrompt: false,
    supportsThinking: true,
  },
]

async function fetchImageAsBase64(
  url: string
): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not fetch reference image: ${url}`)
  const buffer = await res.arrayBuffer()
  return {
    data: Buffer.from(buffer).toString('base64'),
    mimeType: res.headers.get('content-type') ?? 'image/jpeg',
  }
}

export const geminiProvider: ImageProvider = {
  id: 'gemini',
  name: 'Google Gemini',
  models: MODELS,

  async generate(
    modelId: string,
    req: ImageGenerationRequest
  ): Promise<ImageGenerationResult> {
    const model = MODELS.find((m) => m.id === modelId)
    if (!model) throw new Error(`Unknown Gemini model: ${modelId}`)

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

    // Build the parts array — reference images first, then the prompt
    const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

    if (req.referenceImages && req.referenceImages.length > 0) {
      const capped = req.referenceImages.slice(0, model.maxReferenceImages)
      for (const ref of capped) {
        const { data, mimeType } = await fetchImageAsBase64(ref.url)
        parts.push({ inlineData: { mimeType: ref.mimeType ?? mimeType, data } })
      }
    }

    // Build the full prompt with brand/product context
    let fullPrompt = req.prompt
    if (req.brandName || req.productName) {
      const context = [req.brandName, req.productName].filter(Boolean).join(' — ')
      fullPrompt = `${context}\n\n${req.prompt}`
    }
    parts.push({ text: fullPrompt })

    const imageConfig: Record<string, string> = {}
    if (req.aspectRatio) imageConfig.aspectRatio = req.aspectRatio
    if (req.imageSize && model.supportedSizes.includes(req.imageSize)) {
      imageConfig.imageSize = req.imageSize
    }

    const config: Record<string, unknown> = {
      responseModalities: ['IMAGE', 'TEXT'],
    }
    if (Object.keys(imageConfig).length > 0) config.imageConfig = imageConfig
    if (req.temperature !== undefined) config.temperature = req.temperature

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts }],
      config,
    })

    const responseParts = response.candidates?.[0]?.content?.parts ?? []
    const imagePart = responseParts.find(
      (p: { inlineData?: { data?: string; mimeType?: string } }) =>
        p.inlineData?.data
    )

    if (!imagePart?.inlineData?.data) {
      const textPart = responseParts.find((p: { text?: string }) => p.text)
      throw new Error(
        `No image returned from ${modelId}: ${textPart?.text ?? 'Unknown error'}`
      )
    }

    return {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType ?? 'image/png',
      model: modelId,
      provider: 'gemini',
    }
  },
}
