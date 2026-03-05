/**
 * Template system types
 */

export type TemplateType = 
  | 'welcome_1'
  | 'welcome_2'
  | 'welcome_3'
  | 'abandoned_cart_1'
  | 'abandoned_cart_2'
  | 'abandoned_cart_3'
  | 'browse_abandonment_1'
  | 'browse_abandonment_2'
  | 'winback_1'
  | 'winback_2'

export interface TemplateInfo {
  id: TemplateType
  name: string
  description: string
  category: 'welcome' | 'abandoned_cart' | 'browse_abandonment' | 'winback' | 'post_purchase'
  filePath: string
  previewImage?: string
}

export interface BrandCustomizations {
  // Colors
  primaryColor: string
  secondaryColor: string
  accentColor: string
  backgroundColor?: string
  textColor?: string
  
  // Typography
  fontPrimary: string
  fontSecondary?: string
  
  // Brand assets
  logoUrl?: string
  brandUrl?: string
  
  // Content customizations
  brandName: string
  subjectLine?: string
  preheaderText?: string
  heroHeadline?: string
  heroSubheadline?: string
  ctaButtonText?: string
  ctaButtonUrl?: string
  footerText?: string

  // Product-specific (for product-focused flows)
  productName?: string
  productUrl?: string
  productImageUrl?: string
  productImages?: string[]   // Additional product images for feature slots
  productPrice?: string
  productDescription?: string

  // AI-generated copy slots (from /api/templates/generate)
  generatedSlots?: Record<string, string>

  // Per-slot typography overrides: { slot_key: { fontFamily, fontSize } }
  slotStyles?: Record<string, { fontFamily?: string; fontSize?: string }>

  // Section spacing multiplier: 0.5 = tighter, 1 = default, 1.5 = looser
  sectionSpacing?: number

  // Klaviyo Universal Content block IDs for CTA buttons.
  // When set, the engine replaces inline button HTML with universal block embeds
  // so button styling is managed centrally in Klaviyo rather than baked per-template.
  universalButtons?: {
    primary?: string  // block ID for cta_button slots
    cta?: string      // block ID for cta_button_2 slots (falls back to primary)
  }

  // Klaviyo Universal Content block IDs for header and footer sections.
  // When set, the engine replaces the header logo section and footer with universal
  // block embeds so they can be updated centrally in Klaviyo's drag-and-drop builder.
  universalHeader?: string  // block ID for the header logo section
  universalFooter?: string  // block ID for the footer (logo, questions, unsubscribe)
}

export interface ProcessedTemplate {
  html: string
  templateType: TemplateType
  customizations: BrandCustomizations
  hasEditableRegions: boolean
}

// Template registry
export const TEMPLATE_REGISTRY: TemplateInfo[] = [
  {
    id: 'welcome_1',
    name: 'Welcome Email 1 - Hero',
    description: 'Welcome email with hero image and feature highlights',
    category: 'welcome',
    filePath: '../../../welcome-series/welcome-email1b.html',
  },
  {
    id: 'welcome_2',
    name: 'Welcome Email 2 - Product Focus',
    description: 'Second welcome email focusing on product benefits',
    category: 'welcome',
    filePath: '../../../welcome-series/welcome-email2.html',
  },
  {
    id: 'welcome_3',
    name: 'Welcome Email 3 - Collection',
    description: 'Third welcome email showcasing product collection',
    category: 'welcome',
    filePath: '../../../welcome-series/welcome-email3.html',
  },
  {
    id: 'abandoned_cart_1',
    name: 'Abandoned Cart 1 - Reminder',
    description: 'First cart abandonment reminder',
    category: 'abandoned_cart',
    filePath: '../../../abandoned-checkout/abandoned-checkout-email1.html',
  },
  {
    id: 'abandoned_cart_2',
    name: 'Abandoned Cart 2 - Urgency',
    description: 'Second cart abandonment with urgency',
    category: 'abandoned_cart',
    filePath: '../../../abandoned-checkout/abandoned-checkout-email3.html',
  },
  {
    id: 'abandoned_cart_3',
    name: 'Abandoned Cart 3 - Last Chance',
    description: 'Final cart abandonment email',
    category: 'abandoned_cart',
    filePath: '../../../abandoned-checkout/abandoned-checkout-email4.html',
  },
  {
    id: 'browse_abandonment_1',
    name: 'Browse Abandonment 1',
    description: 'First browse abandonment email',
    category: 'browse_abandonment',
    filePath: '../../../browse-abandonment/browse-abandonment-email1.html',
  },
  {
    id: 'browse_abandonment_2',
    name: 'Browse Abandonment 2',
    description: 'Second browse abandonment email',
    category: 'browse_abandonment',
    filePath: '../../../browse-abandonment/browse-abandonment-email3.html',
  },
  {
    id: 'winback_1',
    name: 'Winback Email 1',
    description: 'First winback/re-engagement email',
    category: 'winback',
    filePath: '../../../winback/winback-email1.html',
  },
  {
    id: 'winback_2',
    name: 'Winback Email 2',
    description: 'Second winback email with offer',
    category: 'winback',
    filePath: '../../../winback/winback-email2.html',
  },
]
