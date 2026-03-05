/**
 * Template Engine
 * 
 * Applies brand customizations to base HTML email templates
 */

import { BrandCustomizations, ProcessedTemplate, TemplateType } from './types'

export class TemplateEngine {
  private html: string
  private customizations: BrandCustomizations

  constructor(html: string, customizations: BrandCustomizations) {
    this.html = html
    this.customizations = customizations
  }

  /**
   * Process the template with all customizations
   */
  process(): ProcessedTemplate {
    let processed = this.html

    // Apply customizations in order
    processed = this.replaceHeaderWithUniversalBlock(processed)
    processed = this.replaceFooterWithUniversalBlock(processed)
    processed = this.replaceButtonsWithUniversalBlocks(processed)
    processed = this.replaceColors(processed)
    processed = this.replaceFonts(processed)
    processed = this.replaceLogo(processed)
    processed = this.replaceBrandName(processed)
    processed = this.replaceProductData(processed)
    processed = this.replaceFeatureImages(processed)
    processed = this.applyGeneratedSlots(processed)
    processed = this.applySlotStyles(processed)
    processed = this.applySectionSpacing(processed)
    processed = this.updateTitle(processed)
    processed = this.updatePreheader(processed)
    processed = this.addEditableRegions(processed)

    return {
      html: processed,
      templateType: 'welcome_1', // This should be passed in
      customizations: this.customizations,
      hasEditableRegions: true,
    }
  }

  /**
   * Replace the header logo section with a Klaviyo Universal Content block embed.
   * Templates must have <!-- KL:header-start --> / <!-- KL:header-end --> markers
   * around the hlb-wrapper div. No-op if universalHeader is not configured.
   */
  private replaceHeaderWithUniversalBlock(html: string): string {
    const { universalHeader } = this.customizations
    if (!universalHeader) return html
    return html.replace(
      /<!-- KL:header-start -->[\s\S]*?<!-- KL:header-end -->/gi,
      `<div data-klaviyo-universal-block="${universalHeader}">&nbsp;</div>`
    )
  }

  /**
   * Replace the footer section with a Klaviyo Universal Content block embed.
   * Templates must have <!-- KL:footer-start --> / <!-- KL:footer-end --> markers
   * around the kl-section table that contains {% unsubscribe %}.
   * No-op if universalFooter is not configured.
   */
  private replaceFooterWithUniversalBlock(html: string): string {
    const { universalFooter } = this.customizations
    if (!universalFooter) return html
    return html.replace(
      /<!-- KL:footer-start -->[\s\S]*?<!-- KL:footer-end -->/gi,
      `<div data-klaviyo-universal-block="${universalFooter}">&nbsp;</div>`
    )
  }

  /**
   * Replace inline button tables with Klaviyo Universal Content block embeds.
   *
   * Each button in the templates is structured as:
   *   <table style="border-collapse:separate;line-height:100%;">   ← unique to button cells
   *     <tr><td bgcolor="...">
   *       <a data-slot="cta_button" ...>Text</a>
   *     </td></tr>
   *   </table>
   *
   * This step swaps that entire inner table with:
   *   <div data-klaviyo-universal-block="BLOCK_ID">&nbsp;</div>
   *
   * The surrounding <td class="kl-button"> centering wrapper is preserved.
   * If universalButtons is not configured the method is a no-op, and the
   * normal color/font passes will style the inline buttons instead.
   */
  private replaceButtonsWithUniversalBlocks(html: string): string {
    const { universalButtons } = this.customizations
    if (!universalButtons?.primary) return html

    return html.replace(
      /<table\b[^>]*\bstyle="border-collapse:separate;line-height:100%;"[^>]*>[\s\S]*?<\/table>/gi,
      (match) => {
        const slotMatch = match.match(/\bdata-slot="(cta_button(?:_\w+)?)"/i)
        if (!slotMatch) return match

        const slotName = slotMatch[1]
        const blockId =
          slotName !== 'cta_button'
            ? (universalButtons.cta ?? universalButtons.primary!)
            : universalButtons.primary!

        return `<div data-klaviyo-universal-block="${blockId}">&nbsp;</div>`
      }
    )
  }

  /**
   * Replace color values throughout the template
   */
  private replaceColors(html: string): string {
    const { primaryColor, secondaryColor, accentColor, backgroundColor, textColor } = this.customizations

    // Replace common color patterns
    // Background colors
    html = this.replaceColorValue(html, '#000000', primaryColor, 'background')
    html = this.replaceColorValue(html, '#FFFFFF', secondaryColor, 'background')
    
    // Button colors
    html = html.replace(
      /background-color:\s*#000000/gi,
      `background-color: ${primaryColor}`
    )
    html = html.replace(
      /background:\s*#000000/gi,
      `background: ${primaryColor}`
    )
    html = html.replace(
      /bgcolor="#000000"/gi,
      `bgcolor="${primaryColor}"`
    )

    // Text colors (be careful with white text on dark backgrounds)
    if (textColor) {
      html = html.replace(
        /color:\s*rgb\(0,\s*0,\s*0\)/gi,
        `color: ${textColor}`
      )
    }

    return html
  }

  /**
   * Replace specific color values
   */
  private replaceColorValue(html: string, oldColor: string, newColor: string, context: string): string {
    // Only replace in appropriate contexts
    const patterns = [
      new RegExp(`background-color:\\s*${oldColor}`, 'gi'),
      new RegExp(`background:\\s*${oldColor}`, 'gi'),
      new RegExp(`bgcolor="${oldColor}"`, 'gi'),
    ]

    for (const pattern of patterns) {
      html = html.replace(pattern, (match) => match.replace(new RegExp(oldColor, 'gi'), newColor))
    }

    return html
  }

  /**
   * Replace font families throughout the template.
   * If a Google Font is selected, injects an @import into the <head>.
   */
  private replaceFonts(html: string): string {
    const { fontPrimary, fontSecondary } = this.customizations

    // ── Primary font replacement ───────────────────────────────────────────────
    // Matches every sans-serif stack used in the templates (with or without space after colon)
    const primaryPatterns = [
      // font-family:Helvetica, Arial, sans-serif  (no space)
      /font-family:Helvetica,\s*Arial,\s*sans-serif/gi,
      // font-family: Helvetica, Arial, sans-serif  (with space)
      /font-family:\s+Helvetica,\s*Arial,\s*sans-serif/gi,
      // font-family:Ubuntu, Helvetica, Arial, sans-serif
      /font-family:\s*Ubuntu,\s*Helvetica,\s*Arial,\s*sans-serif/gi,
      // font-family:Arial  (standalone)
      /font-family:Arial(?=[;'"\s])/gi,
      // font-family: Arial, …
      /font-family:\s+Arial,\s*['"]?Helvetica[^;'"]*/gi,
      // font-family: 'Helvetica Neue', Arial…
      /font-family:\s*['"]?Helvetica Neue['"]?,\s*Arial[^;'"]*/gi,
    ]
    for (const pattern of primaryPatterns) {
      html = html.replace(pattern, `font-family: ${fontPrimary}`)
    }

    // ── Secondary font replacement ─────────────────────────────────────────────
    // Matches Georgia serif stacks (with or without Times)
    if (fontSecondary) {
      html = html.replace(
        /font-family:\s*Georgia,\s*Times,\s*['"]?Times New Roman['"]?,?\s*serif/gi,
        `font-family: ${fontSecondary}`
      )
      html = html.replace(
        /font-family:\s*Georgia,\s*['"]?Times New Roman['"]?,?\s*serif/gi,
        `font-family: ${fontSecondary}`
      )
      html = html.replace(
        /font-family:\s*Georgia,\s*serif/gi,
        `font-family: ${fontSecondary}`
      )
    }

    // ── Google Fonts @import injection ────────────────────────────────────────
    const GOOGLE_FONT_NAMES = [
      'Montserrat', 'Playfair Display', 'Lato', 'Raleway',
      'Oswald', 'Merriweather', 'Poppins', 'Inter',
      'Open Sans', 'Roboto', 'Nunito', 'Source Sans 3',
      'Work Sans', 'DM Sans', 'Barlow', 'Outfit',
      'Plus Jakarta Sans', 'Manrope', 'Sora', 'Lexend',
      'Figtree', 'Space Grotesk', 'Rubik', 'Quicksand',
      'Cormorant Garamond', 'Libre Baskerville', 'DM Serif Display', 'Bebas Neue',
    ]
    const googleFonts: string[] = []
    for (const font of [fontPrimary, fontSecondary]) {
      if (!font) continue
      const name = font.split(',')[0].trim()
      if (GOOGLE_FONT_NAMES.includes(name) && !googleFonts.includes(name.replace(/ /g, '+'))) {
        googleFonts.push(name.replace(/ /g, '+'))
      }
    }
    if (googleFonts.length > 0) {
      const importUrl = `https://fonts.googleapis.com/css2?family=${googleFonts.map((f) => `${f}:wght@400;500;600;700`).join('&family=')}&display=swap`
      const importTag = `<style>@import url('${importUrl}');</style>`
      // Inject before </head>, or at start of <style> block if no </head>
      if (html.includes('</head>')) {
        html = html.replace('</head>', `${importTag}\n</head>`)
      } else {
        html = importTag + '\n' + html
      }
    }

    return html
  }

  /**
   * Replace logo images.
   * Templates use the original brand name (e.g. "Zyra Essentials") in the alt attribute
   * of logo <img> tags. We identify logos by alt text matching the placeholder brand name
   * and swap their src to the new logo URL.
   */
  private replaceLogo(html: string): string {
    const { logoUrl } = this.customizations

    if (!logoUrl) return html

    // Replace src on any img whose alt contains "Zyra Essentials" (the placeholder brand)
    html = html.replace(
      /(<img[^>]*alt="Zyra Essentials[^"]*"[^>]*src=")([^"]+)(")/gi,
      `$1${logoUrl}$3`
    )
    html = html.replace(
      /(<img[^>]*src=")([^"]+)("[^>]*alt="Zyra Essentials[^"]*")/gi,
      `$1${logoUrl}$3`
    )

    return html
  }

  /**
   * Replace brand name in footer and other locations.
   * Also replaces the brand homepage URL in logo links.
   */
  private replaceBrandName(html: string): string {
    const { brandName, brandUrl } = this.customizations

    html = html.replace(/Zyra Essentials/gi, brandName)

    // Replace brand homepage links (logo wrapping <a> tags pointing to the old store root)
    if (brandUrl) {
      html = html.replace(
        /href="https?:\/\/zyraessentials\.com\/?"/gi,
        `href="${brandUrl}"`
      )
      // Also replace any href pointing to the store root (no /products/ path)
      html = html.replace(
        /href="https?:\/\/[^"]*(?<!\/products\/[^"]*)"(?=[^>]*kl-img-link)/gi,
        `href="${brandUrl}"`
      )
    }

    return html
  }

  /**
   * Replace product-specific data: hero image, all CTA links, product name in copy.
   * Templates are built around a single product (dropshipper model), so we swap
   * every product image src and every href pointing to the old product URL.
   */
  private replaceProductData(html: string): string {
    const { productName, productUrl, productImageUrl, brandName } = this.customizations

    // Replace product URL in all hrefs and as standalone text
    if (productUrl) {
      // Replace any existing /products/... href with the new product URL
      html = html.replace(
        /href="https?:\/\/[^"]*\/products\/[^"]*"/gi,
        `href="${productUrl}"`
      )
    }

    // Replace the hero/main product image using the data-slot="img_hero" marker.
    if (productImageUrl) {
      html = html.replace(
        /(<img[^>]*data-slot="img_hero"[^>]*src=")([^"]+)(")/gi,
        `$1${productImageUrl}$3`
      )
      html = html.replace(
        /(<img[^>]*src=")([^"]+)("[^>]*data-slot="img_hero"[^>]*)/gi,
        `$1${productImageUrl}$3`
      )
    }

    // Replace product name in visible copy (headlines, alt text)
    if (productName) {
      // Replace alt text on product images
      html = html.replace(/alt="[^"]*(?:Palazzo|Pants|Product|Hero)[^"]*"/gi, `alt="${productName}"`)
    }

    return html
  }

  /**
   * Swap the 3 × 260px feature/benefit images with product's additional images.
   * The shadow image (bottom_shadow_444.png) is explicitly protected.
   * Images are matched by width="260" — these are always the feature grid images.
   */
  private replaceFeatureImages(html: string): string {
    const { productImages } = this.customizations
    if (!productImages || productImages.length === 0) return html

    let imageIndex = 0

    // Replace each 260px-wide image in order, skipping the shadow image
    html = html.replace(
      /(<img[^>]*width="260"[^>]*src=")([^"]+)(")/gi,
      (match, prefix, src, suffix) => {
        if (src.includes('bottom_shadow')) return match
        if (imageIndex >= productImages.length) return match
        const replacement = `${prefix}${productImages[imageIndex]}${suffix}`
        imageIndex++
        return replacement
      }
    )
    // Also handle src-first variant
    html = html.replace(
      /(<img[^>]*src=")([^"]+)("[^>]*width="260")/gi,
      (match, prefix, src, suffix) => {
        if (src.includes('bottom_shadow')) return match
        if (imageIndex >= productImages.length) return match
        const replacement = `${prefix}${productImages[imageIndex]}${suffix}`
        imageIndex++
        return replacement
      }
    )

    return html
  }

  /**
   * Apply AI-generated (or manually edited) copy slots to the template.
   * Uses data-slot markers injected into the HTML templates for reliable replacement.
   *
   * For <span data-slot="name">…</span>: replaces inner content.
   * For <a data-slot="name" …>…</a>: replaces inner text content only.
   * For <img data-slot="name" …/>: replaces the src attribute.
   */
  private applyGeneratedSlots(html: string): string {
    const { generatedSlots } = this.customizations
    if (!generatedSlots) return html

    for (const [slotName, rawValue] of Object.entries(generatedSlots)) {
      if (!rawValue) continue

      // Strip trailing <br/> tags and whitespace so template structural
      // spacing (margins, padding) controls section gaps, not slot content.
      const value = rawValue.replace(/(<br\s*\/?>\s*)+$/gi, '').trim()

      // ── <span data-slot="name">…</span> ──────────────────────────────────
      // Use [\s\S]*? to handle content that contains child tags (e.g. <br/>)
      html = html.replace(
        new RegExp(`(<span[^>]*data-slot="${slotName}"[^>]*>)[\\s\\S]*?(</span>)`, 'gi'),
        `$1${value}$2`
      )

      // ── <a data-slot="name" …>…</a> (button text) ────────────────────────
      // Use [\s\S]*? to handle newlines between the tag and its text content
      html = html.replace(
        new RegExp(`(<a\\b[^>]*data-slot="${slotName}"[^>]*>)[\\s\\S]*?(</a>)`, 'gi'),
        `$1${value}$2`
      )

      // ── <img data-slot="name" … src="…" …/> (image src) ──────────────────
      html = html.replace(
        new RegExp(`(<img[^>]*data-slot="${slotName}"[^>]*src=")([^"]*)(")`, 'gi'),
        `$1${value}$3`
      )
      // src-first variant
      html = html.replace(
        new RegExp(`(<img[^>]*src=")([^"]*)(\"[^>]*data-slot="${slotName}"[^>]*)`, 'gi'),
        `$1${value}$3`
      )
    }

    return html
  }

  /**
   * Apply per-slot font-family and font-size overrides.
   * Finds elements with data-slot="name" and merges the style overrides
   * into their existing inline style attribute (or adds one).
   */
  private applySlotStyles(html: string): string {
    const { slotStyles } = this.customizations
    if (!slotStyles || Object.keys(slotStyles).length === 0) return html

    for (const [slotName, styles] of Object.entries(slotStyles)) {
      if (!styles) continue
      const { fontFamily, fontSize } = styles
      if (!fontFamily && !fontSize) continue

      // Build the style fragment to inject
      const styleFragment = [
        fontFamily ? `font-family: ${fontFamily}` : '',
        fontSize ? `font-size: ${fontSize}` : '',
      ].filter(Boolean).join('; ')

      // Match any element with data-slot="slotName" and inject/merge styles
      html = html.replace(
        new RegExp(`(<[a-z][^>]*\\bdata-slot="${slotName}"[^>]*)`, 'gi'),
        (match) => {
          // If element already has a style attribute, merge into it
          if (/\bstyle="/i.test(match)) {
            return match.replace(
              /\bstyle="([^"]*)"/i,
              (_, existing) => `style="${existing.replace(/;\s*$/, '')}; ${styleFragment}"`
            )
          }
          // Otherwise inject a new style attribute before the closing >
          return match.replace(/>?$/, ` style="${styleFragment}"`)
        }
      )
    }

    return html
  }

  /**
   * Scale vertical padding on all <td> elements by the sectionSpacing multiplier.
   * Only affects padding-top and padding-bottom; horizontal padding is untouched.
   * Values of 0 are left at 0 to avoid adding unwanted gaps.
   */
  private applySectionSpacing(html: string): string {
    const { sectionSpacing } = this.customizations
    if (!sectionSpacing || sectionSpacing === 1) return html

    const multiplier = Math.max(0.25, Math.min(2, sectionSpacing))

    return html.replace(
      /\bpadding-(top|bottom):(\d+)px/gi,
      (_, direction: string, px: string) => {
        const original = parseInt(px, 10)
        if (original === 0) return `padding-${direction}:0px`
        const scaled = Math.round(original * multiplier)
        return `padding-${direction}:${scaled}px`
      }
    )
  }

  /**
   * Update the title tag
   */
  private updateTitle(html: string): string {
    const { brandName, subjectLine } = this.customizations
    
    const newTitle = subjectLine || `Welcome to ${brandName}`
    
    html = html.replace(
      /<title>[^<]*<\/title>/i,
      `<title>${newTitle}</title>`
    )

    return html
  }

  /**
   * Update or add preheader text
   */
  private updatePreheader(html: string): string {
    const { preheaderText, brandName } = this.customizations
    
    if (!preheaderText) return html

    // Look for existing preheader div
    const preheaderPattern = /<div[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/i
    
    if (preheaderPattern.test(html)) {
      // Replace existing preheader content
      html = html.replace(preheaderPattern, (match) => {
        return match.replace(/>[\s\S]*?<\/div>/i, `>${preheaderText}</div>`)
      })
    }

    return html
  }

  /**
   * Add Klaviyo editable regions for hybrid template support
   */
  private addEditableRegions(html: string): string {
    // Add data attributes to main content areas
    // This enables editing in Klaviyo's visual editor
    
    // Add region attribute to main content table cells
    html = html.replace(
      /<td([^>]*class="[^"]*kl-text[^"]*"[^>]*)>/gi,
      '<td$1 data-klaviyo-editable="true">'
    )

    return html
  }
}

/**
 * Process a template with brand customizations
 */
export function processTemplate(
  html: string,
  customizations: BrandCustomizations
): ProcessedTemplate {
  const engine = new TemplateEngine(html, customizations)
  return engine.process()
}

/**
 * Generate CSS style overrides for a brand
 */
export function generateBrandStyles(customizations: BrandCustomizations): string {
  const { primaryColor, secondaryColor, fontPrimary, fontSecondary } = customizations

  return `
/* Brand Color Overrides */
.brand-primary { color: ${primaryColor} !important; }
.brand-primary-bg { background-color: ${primaryColor} !important; }
.brand-secondary { color: ${secondaryColor} !important; }
.brand-secondary-bg { background-color: ${secondaryColor} !important; }

/* Brand Typography */
.brand-font-primary { font-family: ${fontPrimary} !important; }
.brand-font-secondary { font-family: ${fontSecondary || 'Georgia, serif'} !important; }

/* Button Styles */
.kl-button a {
  background-color: ${primaryColor} !important;
  color: #FFFFFF !important;
}
.kl-button a:hover {
  opacity: 0.9;
}
`.trim()
}
