import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── Slot definitions per template ───────────────────────────────────────────
// Each entry describes what Claude needs to write for that template type.
// Keys become the replacement tokens in the engine.

export interface GeneratedSlots {
  subject_line: string
  preheader: string
  hero_headline?: string
  hero_subheadline?: string
  hero_body?: string
  cta_button?: string
  cta_button_2?: string
  feature_1_title?: string
  feature_1_body?: string
  feature_2_title?: string
  feature_2_body?: string
  feature_3_title?: string
  feature_3_body?: string
  closing_copy?: string
  urgency_headline?: string
  urgency_body?: string
  body_copy?: string
  testimonial_1?: string
  testimonial_2?: string
  winback_headline?: string
  winback_body?: string
  guarantee_copy?: string
}

const SLOT_SPECS: Record<string, { slots: string[]; instructions: string }> = {
  welcome_1: {
    slots: [
      'subject_line (max 60 chars)',
      'preheader (max 90 chars)',
      'hero_headline (2-4 words, ALL CAPS, punchy — e.g. "KNOT FREE IN MINUTES")',
      'hero_body (2-3 sentences: introduce the product, mention 10% welcome discount)',
      'cta_button (3-5 words)',
      'cta_button_2 (3-6 words, includes product name)',
      'feature_1_title (2-4 words)',
      'feature_1_body (1-2 sentences, specific product benefit)',
      'feature_2_title (2-4 words)',
      'feature_2_body (1-2 sentences, specific product benefit)',
      'feature_3_title (2-4 words)',
      'feature_3_body (1-2 sentences, specific product benefit)',
      'closing_copy (1 sentence, drive urgency to use discount)',
    ],
    instructions: 'This is the first welcome email. Tone: warm, excited, benefit-focused. Lead with the product\'s main transformation/benefit. Include the 10% welcome discount naturally.',
  },
  welcome_2: {
    slots: [
      'subject_line (max 60 chars)',
      'preheader (max 90 chars)',
      'hero_headline (5-8 words, title case)',
      'hero_subheadline (6-10 words, italic tone)',
      'hero_body (3-4 sentences: expand on product benefits, social proof angle)',
      'cta_button (4-6 words, includes discount)',
      'testimonial_1 (2-3 sentences, fake but believable 5-star review from a customer, product-specific)',
      'testimonial_2 (2-3 sentences, different angle, also product-specific)',
    ],
    instructions: 'Second welcome email. Tone: social proof, confidence-building. Use testimonials to reinforce the purchase decision. Remind of the 10% discount.',
  },
  welcome_3: {
    slots: [
      'subject_line (max 60 chars — urgency, last chance)',
      'preheader (max 90 chars)',
      'urgency_headline (1-2 sentences, FOMO — discount expires soon)',
      'hero_headline (3-5 words, ALL CAPS italic)',
      'body_copy (3-4 sentences: last chance urgency, product benefits recap)',
      'cta_button (3-5 words)',
      'cta_button_2 (3-5 words)',
    ],
    instructions: 'Third and final welcome email. Tone: urgent, last chance. The 10% discount expires in 24 hours. Drive action now.',
  },
  abandoned_cart_1: {
    slots: [
      'subject_line (max 60 chars)',
      'preheader (max 90 chars)',
      'hero_headline (4-6 words, casual/friendly)',
      'body_copy (2-3 sentences: friendly reminder they left something, mention 10% off to complete)',
      'cta_button (3-5 words)',
      'cta_button_2 (3-5 words)',
    ],
    instructions: 'First abandoned cart email. Tone: friendly, low pressure. Just a reminder. Offer 10% off to complete the order.',
  },
  abandoned_cart_2: {
    slots: [
      'subject_line (max 60 chars — urgency)',
      'preheader (max 90 chars)',
      'hero_headline (4-6 words, urgency)',
      'urgency_body (2-3 sentences: stock/time urgency, 10% off code expiring)',
      'cta_button (3-5 words)',
      'cta_button_2 (3-5 words)',
    ],
    instructions: 'Second abandoned cart email. Tone: urgency, scarcity. The 10% code is expiring in 24 hours.',
  },
  abandoned_cart_3: {
    slots: [
      'subject_line (max 60 chars)',
      'preheader (max 90 chars)',
      'hero_headline (3-5 words)',
      'guarantee_copy (3-4 sentences: address objections, money-back guarantee, 15% final offer)',
      'cta_button (3-5 words)',
      'cta_button_2 (3-5 words)',
    ],
    instructions: 'Final abandoned cart email. Tone: reassuring, objection-handling. Offer 15% off and highlight the money-back guarantee.',
  },
  browse_abandonment_1: {
    slots: [
      'subject_line (max 60 chars)',
      'preheader (max 90 chars)',
      'body_copy (2-3 sentences: noticed they were looking, gift them 10% off)',
      'cta_button (3-5 words)',
    ],
    instructions: 'First browse abandonment email. Tone: casual, gift-giving. They viewed the product but didn\'t add to cart. Offer 10% off.',
  },
  browse_abandonment_2: {
    slots: [
      'subject_line (max 60 chars — urgency)',
      'preheader (max 90 chars)',
      'hero_headline (4-6 words, urgency)',
      'body_copy (2-3 sentences: 15% off expires in 24 hours)',
      'cta_button (4-6 words)',
    ],
    instructions: 'Second browse abandonment email. Tone: urgent. 15% off expires in 24 hours.',
  },
  winback_1: {
    slots: [
      'subject_line (max 60 chars)',
      'preheader (max 90 chars)',
      'winback_headline (2-4 words, ALL CAPS, nostalgic)',
      'winback_body (3-4 sentences: we miss you, new things available, 20% off)',
      'cta_button (4-6 words)',
    ],
    instructions: 'First winback email. Tone: warm, we miss you. Customer hasn\'t bought in 60+ days. Offer 20% off.',
  },
  winback_2: {
    slots: [
      'subject_line (max 60 chars)',
      'preheader (max 90 chars)',
      'body_copy (4-6 sentences: conversational, personal tone from founder, why consistent use matters for the product, 20% off expires in 24 hours)',
      'cta_button (3-5 words)',
    ],
    instructions: 'Second winback email. Tone: personal, founder voice, plain text style. Make it feel like a real person wrote it. 20% off expires in 24 hours.',
  },
}

/**
 * POST /api/templates/generate
 * Uses Claude to rewrite all text slots for a given template type,
 * tailored to the specific brand and product.
 */
export async function POST(request: NextRequest) {
  try {
    const { templateId, brand, product } = await request.json()

    if (!templateId || !brand || !product) {
      return NextResponse.json(
        { error: 'templateId, brand, and product are required' },
        { status: 400 }
      )
    }

    const spec = SLOT_SPECS[templateId]
    if (!spec) {
      return NextResponse.json(
        { error: `No generation spec for template: ${templateId}` },
        { status: 400 }
      )
    }

    const prompt = buildPrompt({ templateId, brand, product, spec })

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Extract JSON from Claude's response
    const jsonMatch = raw.match(/```json\n?([\s\S]*?)\n?```/) || raw.match(/(\{[\s\S]*\})/)
    if (!jsonMatch) {
      return NextResponse.json(
        { error: 'Claude did not return valid JSON', raw },
        { status: 500 }
      )
    }

    const slots: GeneratedSlots = JSON.parse(jsonMatch[1])

    return NextResponse.json({ success: true, templateId, slots })
  } catch (error) {
    console.error('Generate error:', error)
    return NextResponse.json(
      { error: 'Generation failed', details: String(error) },
      { status: 500 }
    )
  }
}

function buildPrompt({
  templateId,
  brand,
  product,
  spec,
}: {
  templateId: string
  brand: { name: string; primaryColor: string; tagline?: string }
  product: { name: string; description?: string; price?: string; productUrl: string }
  spec: { slots: string[]; instructions: string }
}): string {
  return `You are an expert email copywriter for a dropshipping email marketing agency. Write conversion-focused email copy for a specific product.

## Brand
- Name: ${brand.name}
- Tagline: ${brand.tagline ?? 'N/A'}
- Primary color: ${brand.primaryColor}

## Product
- Name: ${product.name}
- Price: ${product.price ?? 'N/A'}
- Description: ${product.description ?? 'N/A'}
- URL: ${product.productUrl}

## Template
- Type: ${templateId}
- Instructions: ${spec.instructions}

## Your Task
Write copy for each of the following slots. Be specific to THIS product — never use generic placeholder language. Keep coupon codes as-is (they use Klaviyo template syntax like {% coupon_code 'Welcome10' %} — do NOT include them in your output, they are already in the template).

Slots to write:
${spec.slots.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Return ONLY a JSON object with the slot names as keys (use the part before the parentheses as the key, in snake_case). Example format:
\`\`\`json
{
  "subject_line": "...",
  "preheader": "...",
  "hero_headline": "..."
}
\`\`\`

Rules:
- Be specific to the product — mention the product name where natural
- Match the tone described in the instructions
- Keep copy tight and punchy — no fluff
- Do NOT include coupon codes or Klaviyo variables
- Do NOT include HTML tags`
}
