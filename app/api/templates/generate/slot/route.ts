import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Per-slot instructions for focused regeneration
const SLOT_INSTRUCTIONS: Record<string, string> = {
  subject_line: 'Write a compelling email subject line (max 60 chars). No emojis unless they add real value. Be specific to the product.',
  preheader: 'Write a preheader that complements the subject line (max 90 chars). Should add context or curiosity.',
  hero_headline: 'Write a punchy hero headline (2-5 words, ALL CAPS). Product-specific, benefit-focused.',
  hero_subheadline: 'Write a supporting subheadline (6-10 words, title case). Softer tone than the headline.',
  hero_body: 'Write 2-3 sentences of hero body copy. Introduce the product, its main benefit, and the discount offer naturally.',
  cta_button: 'Write a CTA button label (3-5 words). Action-oriented, specific.',
  cta_button_2: 'Write a second CTA button label (3-6 words). Can reference the product name or discount.',
  feature_1_title: 'Write a feature benefit title (2-4 words). Specific to the product.',
  feature_1_body: 'Write 1-2 sentences describing this product benefit. Be specific and concrete.',
  feature_2_title: 'Write a second feature benefit title (2-4 words). Different angle from feature 1.',
  feature_2_body: 'Write 1-2 sentences for the second feature. Different benefit from feature 1.',
  feature_3_title: 'Write a third feature benefit title (2-4 words). Different angle from features 1 and 2.',
  feature_3_body: 'Write 1-2 sentences for the third feature. Different benefit from features 1 and 2.',
  closing_copy: 'Write a single closing sentence that drives urgency to use the discount.',
  urgency_headline: 'Write 1-2 urgency sentences. FOMO-focused, discount expiring.',
  urgency_subheadline: 'Write a short urgency line (max 8 words). Time-sensitive.',
  urgency_body: 'Write 2-3 sentences of urgency copy. The discount is expiring in 24 hours.',
  body_copy: 'Write 2-3 sentences of body copy. Product-specific, benefit-focused.',
  testimonial_1: 'Write a fake but believable 5-star customer review (2-3 sentences). Product-specific, authentic voice.',
  testimonial_1_author: 'Write a fake customer name with first name and last initial (e.g. "Sarah M.")',
  testimonial_2: 'Write a second fake customer review (2-3 sentences). Different angle and voice from testimonial 1.',
  testimonial_2_author: 'Write a second fake customer name.',
  winback_eyebrow: 'Write a short eyebrow text (2-4 words, ALL CAPS). Nostalgic or attention-grabbing.',
  winback_headline: 'Write a winback headline (2-4 words, ALL CAPS). We miss you tone.',
  winback_body_1: 'Write 1-2 sentences of winback copy. Warm, personal, we miss you.',
  winback_body_2_prefix: 'Write 1 sentence teasing new products/offers.',
  guarantee_copy: 'Write 2-3 sentences about the money-back guarantee. Reassuring, objection-handling.',
}

/**
 * POST /api/templates/generate/slot
 * Regenerates a single copy slot using Claude.
 */
export async function POST(request: NextRequest) {
  try {
    const { templateId, slotKey, brand, product, currentSlots } = await request.json()

    if (!slotKey || !brand || !product) {
      return NextResponse.json(
        { error: 'slotKey, brand, and product are required' },
        { status: 400 }
      )
    }

    const instruction = SLOT_INSTRUCTIONS[slotKey]
    if (!instruction) {
      return NextResponse.json(
        { error: `No instruction for slot: ${slotKey}` },
        { status: 400 }
      )
    }

    // Build context from existing slots so Claude can be consistent
    const existingContext = Object.entries(currentSlots ?? {})
      .filter(([k, v]) => k !== slotKey && v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')

    const prompt = `You are an expert email copywriter for a dropshipping email marketing agency.

## Brand
- Name: ${brand.name}
- Tagline: ${brand.tagline ?? 'N/A'}

## Product
- Name: ${product.name}
- Price: ${product.price ?? 'N/A'}
- Description: ${product.description ?? 'N/A'}
- URL: ${product.productUrl}

## Template type: ${templateId}

${existingContext ? `## Existing copy in this email (for consistency)\n${existingContext}\n` : ''}

## Your task
${instruction}

Rules:
- Be specific to THIS product — mention the product name where natural
- Do NOT include coupon codes or Klaviyo template variables
- Do NOT include HTML tags
- Return ONLY the copy text, nothing else — no quotes, no explanation`

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const value = message.content[0].type === 'text'
      ? message.content[0].text.trim()
      : ''

    return NextResponse.json({ success: true, slotKey, value })
  } catch (error) {
    console.error('Slot regeneration error:', error)
    return NextResponse.json(
      { error: 'Regeneration failed', details: String(error) },
      { status: 500 }
    )
  }
}
