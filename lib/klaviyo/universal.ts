/**
 * Klaviyo Universal Content API
 * 
 * Universal content blocks (like buttons) can be created once
 * and reused across multiple templates.
 */

import { KlaviyoClient } from './client'

export interface UniversalContentBlock {
  type: 'universal-content'
  id: string
  attributes: {
    name: string
    definition: {
      content_type: string
      data: unknown
    }
    created: string
    updated: string
  }
}

export interface CreateButtonOptions {
  name: string
  text: string
  url: string
  backgroundColor: string
  textColor: string
  borderRadius?: string
  fontSize?: string
  fontFamily?: string
  padding?: string
}

/**
 * Create a universal button block in Klaviyo
 */
export async function createUniversalButton(
  client: KlaviyoClient,
  options: CreateButtonOptions
): Promise<UniversalContentBlock> {
  const {
    name,
    text,
    url,
    backgroundColor,
    textColor,
    borderRadius = '5px',
    fontSize = '16px',
    fontFamily = 'Helvetica, Arial, sans-serif',
    padding = '15px 25px',
  } = options

  // Button HTML for universal content
  const buttonHtml = generateButtonHtml({
    text,
    url,
    backgroundColor,
    textColor,
    borderRadius,
    fontSize,
    fontFamily,
    padding,
  })

  const payload = {
    data: {
      type: 'universal-content',
      attributes: {
        name,
        definition: {
          content_type: 'html',
          data: {
            source: buttonHtml,
          },
        },
      },
    },
  }

  const response = await client.post<{ data: UniversalContentBlock }>(
    '/universal-content/',
    payload
  )

  return response.data
}

/**
 * Generate button HTML that's email-client compatible
 */
function generateButtonHtml(options: {
  text: string
  url: string
  backgroundColor: string
  textColor: string
  borderRadius: string
  fontSize: string
  fontFamily: string
  padding: string
}): string {
  const { text, url, backgroundColor, textColor, borderRadius, fontSize, fontFamily, padding } = options

  // VML for Outlook compatibility
  return `
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:auto;v-text-anchor:middle;width:auto;" arcsize="10%" stroke="f" fillcolor="${backgroundColor}">
<w:anchorlock/>
<center>
<![endif]-->
<a href="${url}" style="background-color:${backgroundColor};border-radius:${borderRadius};color:${textColor};display:inline-block;font-family:${fontFamily};font-size:${fontSize};font-weight:bold;line-height:1.2;padding:${padding};text-align:center;text-decoration:none;-webkit-text-size-adjust:none;mso-hide:all;">${text}</a>
<!--[if mso]>
</center>
</v:roundrect>
<![endif]-->
`.trim()
}

/**
 * Get all universal content blocks
 */
export async function getUniversalContentBlocks(
  client: KlaviyoClient
): Promise<UniversalContentBlock[]> {
  const response = await client.get<{ data: UniversalContentBlock[] }>(
    '/universal-content/'
  )
  return response.data
}

/**
 * Get a specific universal content block by ID
 */
export async function getUniversalContentBlock(
  client: KlaviyoClient,
  blockId: string
): Promise<UniversalContentBlock> {
  const response = await client.get<{ data: UniversalContentBlock }>(
    `/universal-content/${blockId}/`
  )
  return response.data
}

/**
 * Delete a universal content block
 */
export async function deleteUniversalContentBlock(
  client: KlaviyoClient,
  blockId: string
): Promise<void> {
  await client.delete(`/universal-content/${blockId}/`)
}

/**
 * Generate the HTML snippet to embed a universal content block in a template
 */
export function getUniversalBlockEmbed(blockId: string): string {
  return `<div data-klaviyo-universal-block="${blockId}">&nbsp;</div>`
}

/**
 * Update an existing universal content block (e.g. to refresh button styling)
 */
export async function updateUniversalButton(
  client: KlaviyoClient,
  blockId: string,
  options: Partial<CreateButtonOptions>
): Promise<UniversalContentBlock> {
  const buttonHtml = generateButtonHtml({
    text: options.text ?? 'Shop Now',
    url: options.url ?? '#',
    backgroundColor: options.backgroundColor ?? '#000000',
    textColor: options.textColor ?? '#FFFFFF',
    borderRadius: options.borderRadius ?? '5px',
    fontSize: options.fontSize ?? '16px',
    fontFamily: options.fontFamily ?? 'Helvetica, Arial, sans-serif',
    padding: options.padding ?? '15px 25px',
  })

  const payload = {
    data: {
      type: 'universal-content',
      id: blockId,
      attributes: {
        ...(options.name && { name: options.name }),
        definition: {
          content_type: 'html',
          data: { source: buttonHtml },
        },
      },
    },
  }

  const response = await client.patch<{ data: UniversalContentBlock }>(
    `/universal-content/${blockId}/`,
    payload
  )

  return response.data
}

/**
 * Create a set of standard CTA buttons for a brand.
 *
 * @param ctaUrl  The URL (or Klaviyo variable such as `{{ event.extra.checkout_url }}`)
 *                to use for all buttons in this set.
 * @param fontFamily  Optional brand font; falls back to Helvetica stack.
 */
export async function createBrandButtons(
  client: KlaviyoClient,
  brandName: string,
  primaryColor: string,
  ctaUrl: string,
  textColor: string = '#FFFFFF',
  fontFamily?: string
): Promise<{
  primary: UniversalContentBlock
  cta: UniversalContentBlock
}> {
  const sharedOptions = {
    url: ctaUrl,
    backgroundColor: primaryColor,
    textColor,
    borderRadius: '5px',
    ...(fontFamily && { fontFamily }),
  }

  const primary = await createUniversalButton(client, {
    ...sharedOptions,
    name: `${brandName} - Primary Button`,
    text: 'Shop Now',
    padding: '16px 30px',
    fontSize: '20px',
  })

  const cta = await createUniversalButton(client, {
    ...sharedOptions,
    name: `${brandName} - CTA Button`,
    text: 'Complete Your Purchase',
    padding: '18px 35px',
    fontSize: '20px',
  })

  return { primary, cta }
}
