/**
 * Figma Design Generator
 * 
 * Generates email template designs in Figma using the MCP server.
 * Analyzes brand data and creates visual designs that can be approved
 * before being converted to Klaviyo templates.
 */

export interface BrandDesignContext {
  brandName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  fontPrimary: string
  fontSecondary?: string
  logoUrl?: string
  websiteUrl?: string
}

export interface TemplateDesignSpec {
  templateType: string // 'welcome_1', 'abandoned_cart_1', etc.
  templateName: string
  layout: {
    width: number
    sections: TemplateSection[]
  }
  content: {
    headline?: string
    subheadline?: string
    bodyText?: string
    ctaText?: string
    ctaUrl?: string
  }
}

export interface TemplateSection {
  type: 'header' | 'hero' | 'content' | 'cta' | 'footer'
  height?: number
  backgroundColor?: string
  padding?: number
}

export interface FigmaDesignResult {
  figmaFileUrl?: string
  figmaFileId?: string
  figmaFrameId?: string
  previewImageUrl?: string
  success: boolean
  error?: string
}

/**
 * Template design specifications
 */
export const TEMPLATE_DESIGNS: Record<string, TemplateDesignSpec> = {
  welcome_1: {
    templateType: 'welcome_1',
    templateName: 'Welcome Email #1',
    layout: {
      width: 600,
      sections: [
        { type: 'header', height: 80, padding: 20 },
        { type: 'hero', height: 400 },
        { type: 'content', height: 200, padding: 40 },
        { type: 'cta', height: 100 },
        { type: 'footer', height: 120, padding: 20 },
      ],
    },
    content: {
      headline: 'Welcome to {{brand_name}}!',
      subheadline: 'Get 10% off your first order',
      bodyText: 'We\'re thrilled to have you join our community. Discover our curated collection of products.',
      ctaText: 'Shop Now',
      ctaUrl: '{{shop_url}}',
    },
  },
  welcome_2: {
    templateType: 'welcome_2',
    templateName: 'Welcome Email #2',
    layout: {
      width: 600,
      sections: [
        { type: 'header', height: 80 },
        { type: 'hero', height: 350 },
        { type: 'content', height: 250, padding: 40 },
        { type: 'cta', height: 100 },
        { type: 'footer', height: 120 },
      ],
    },
    content: {
      headline: 'Discover What Makes Us Special',
      subheadline: 'Our bestsellers await',
      bodyText: 'From timeless classics to modern favorites, explore what our community loves.',
      ctaText: 'Explore Collection',
      ctaUrl: '{{shop_url}}',
    },
  },
  abandoned_cart_1: {
    templateType: 'abandoned_cart_1',
    templateName: 'Abandoned Cart #1',
    layout: {
      width: 600,
      sections: [
        { type: 'header', height: 80 },
        { type: 'hero', height: 300 },
        { type: 'content', height: 300, padding: 40 },
        { type: 'cta', height: 100 },
        { type: 'footer', height: 120 },
      ],
    },
    content: {
      headline: 'You Left Something Behind!',
      subheadline: 'Your cart is waiting for you',
      bodyText: 'Complete your order now and get these amazing items delivered to your door.',
      ctaText: 'Complete Purchase',
      ctaUrl: '{{checkout_url}}',
    },
  },
}

/**
 * Generate a design prompt for Claude based on brand and template data
 */
export function generateDesignPrompt(
  brand: BrandDesignContext,
  template: TemplateDesignSpec
): string {
  return `Create an email template design in Figma for ${brand.brandName} with the following specifications:

**Email Type:** ${template.templateName}

**Brand Guidelines:**
- Primary Color: ${brand.primaryColor}
- Secondary Color: ${brand.secondaryColor}
- Accent Color: ${brand.accentColor}
- Primary Font: ${brand.fontPrimary}
${brand.fontSecondary ? `- Secondary Font: ${brand.fontSecondary}` : ''}
${brand.logoUrl ? `- Logo: ${brand.logoUrl}` : ''}

**Layout:**
- Email Width: ${template.layout.width}px
- Sections: ${template.layout.sections.map(s => s.type).join(', ')}

**Content:**
${template.content.headline ? `- Headline: "${template.content.headline.replace('{{brand_name}}', brand.brandName)}"` : ''}
${template.content.subheadline ? `- Subheadline: "${template.content.subheadline}"` : ''}
${template.content.bodyText ? `- Body: "${template.content.bodyText}"` : ''}
${template.content.ctaText ? `- CTA Button: "${template.content.ctaText}"` : ''}

**Design Requirements:**
1. Create a modern, clean email template design
2. Use the brand colors throughout (primary for headers, accent for CTAs)
3. Include proper spacing and padding (20-40px)
4. Make the CTA button prominent and use the accent color
5. Add the logo in the header
6. Include footer with social icons and unsubscribe link
7. Ensure mobile-responsive layout principles

Create this as a Figma frame that can be easily converted to HTML/CSS for Klaviyo.`
}

/**
 * Generate design metadata from analysis
 */
export function generateDesignMetadata(
  brand: BrandDesignContext,
  template: TemplateDesignSpec
): Record<string, any> {
  return {
    colors: [brand.primaryColor, brand.secondaryColor, brand.accentColor],
    fonts: [brand.fontPrimary, brand.fontSecondary].filter(Boolean),
    layout: {
      width: template.layout.width,
      sections: template.layout.sections.length,
    },
    components: template.layout.sections.map(s => s.type),
    templateType: template.templateType,
    generatedFor: brand.brandName,
  }
}

/**
 * Get template design spec
 */
export function getTemplateDesign(templateType: string): TemplateDesignSpec | null {
  return TEMPLATE_DESIGNS[templateType] || null
}

/**
 * Get all available template designs
 */
export function getAllTemplateDesigns(): TemplateDesignSpec[] {
  return Object.values(TEMPLATE_DESIGNS)
}

/**
 * Create design context from brand data
 */
export function createBrandContext(brand: {
  name: string
  primary_color?: string
  secondary_color?: string
  accent_color?: string
  font_primary?: string
  font_secondary?: string
  logo_url?: string
  website_url?: string
}): BrandDesignContext {
  return {
    brandName: brand.name,
    primaryColor: brand.primary_color || '#000000',
    secondaryColor: brand.secondary_color || '#FFFFFF',
    accentColor: brand.accent_color || '#666666',
    fontPrimary: brand.font_primary || 'Helvetica, Arial, sans-serif',
    fontSecondary: brand.font_secondary,
    logoUrl: brand.logo_url,
    websiteUrl: brand.website_url,
  }
}
