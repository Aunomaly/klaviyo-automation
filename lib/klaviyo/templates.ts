/**
 * Klaviyo Templates API
 * 
 * Create and manage email templates in Klaviyo.
 * Supports hybrid templates with editable regions.
 */

import { KlaviyoClient } from './client'

export interface KlaviyoTemplate {
  type: 'template'
  id: string
  attributes: {
    name: string
    editor_type: 'CODE' | 'USER_DRAGGABLE' | 'HYBRID'
    html: string
    text: string | null
    created: string
    updated: string
  }
}

export interface CreateTemplateOptions {
  name: string
  html: string
  editorType?: 'CODE' | 'USER_DRAGGABLE' | 'HYBRID'
}

export interface UpdateTemplateOptions {
  name?: string
  html?: string
}

/**
 * Create a new email template in Klaviyo
 */
export async function createTemplate(
  client: KlaviyoClient,
  options: CreateTemplateOptions
): Promise<KlaviyoTemplate> {
  const { name, html, editorType = 'HYBRID' } = options

  const payload = {
    data: {
      type: 'template',
      attributes: {
        name,
        editor_type: editorType,
        html,
      },
    },
  }

  const response = await client.post<{ data: KlaviyoTemplate }>(
    '/templates/',
    payload
  )

  return response.data
}

/**
 * Get a template by ID
 */
export async function getTemplate(
  client: KlaviyoClient,
  templateId: string
): Promise<KlaviyoTemplate> {
  const response = await client.get<{ data: KlaviyoTemplate }>(
    `/templates/${templateId}/`
  )
  return response.data
}

/**
 * Get all templates
 */
export async function getTemplates(
  client: KlaviyoClient,
  options?: {
    filter?: string
    pageSize?: number
  }
): Promise<KlaviyoTemplate[]> {
  let endpoint = '/templates/'
  const params: string[] = []

  if (options?.filter) {
    params.push(`filter=${encodeURIComponent(options.filter)}`)
  }
  if (options?.pageSize) {
    params.push(`page[size]=${options.pageSize}`)
  }

  if (params.length > 0) {
    endpoint += `?${params.join('&')}`
  }

  const response = await client.get<{ data: KlaviyoTemplate[] }>(endpoint)
  return response.data
}

/**
 * Update a template
 */
export async function updateTemplate(
  client: KlaviyoClient,
  templateId: string,
  options: UpdateTemplateOptions
): Promise<KlaviyoTemplate> {
  const payload = {
    data: {
      type: 'template',
      id: templateId,
      attributes: options,
    },
  }

  const response = await client.patch<{ data: KlaviyoTemplate }>(
    `/templates/${templateId}/`,
    payload
  )

  return response.data
}

/**
 * Delete a template
 */
export async function deleteTemplate(
  client: KlaviyoClient,
  templateId: string
): Promise<void> {
  await client.delete(`/templates/${templateId}/`)
}

/**
 * Clone a template
 */
export async function cloneTemplate(
  client: KlaviyoClient,
  templateId: string,
  newName: string
): Promise<KlaviyoTemplate> {
  // First get the original template
  const original = await getTemplate(client, templateId)
  
  // Create a new template with the same HTML
  return createTemplate(client, {
    name: newName,
    html: original.attributes.html,
    editorType: original.attributes.editor_type,
  })
}

/**
 * Get the Klaviyo editor URL for a template
 */
export function getTemplateEditorUrl(templateId: string): string {
  return `https://www.klaviyo.com/email-editor/${templateId}/edit`
}

/**
 * Add editable regions to HTML for hybrid template support
 * 
 * This wraps content in Klaviyo-compatible editable regions
 * so users can edit in the visual editor after deployment.
 */
export function addEditableRegions(html: string): string {
  // Add region wrapper to main content areas
  let processed = html

  // Find main content td elements and add region attributes
  processed = processed.replace(
    /<td([^>]*)(class="[^"]*mob-no-spc[^"]*")([^>]*)>/gi,
    '<td$1$2$3 data-klaviyo-region="true" data-klaviyo-region-width-pixels="600">'
  )

  // Add editable text block class to text content divs
  processed = processed.replace(
    /<div([^>]*)(class="[^"]*kl-text[^"]*")([^>]*)>/gi,
    (match, before, classAttr, after) => {
      // Add klaviyo-block class if not present
      if (!classAttr.includes('klaviyo-block')) {
        const newClass = classAttr.replace('class="', 'class="klaviyo-block klaviyo-text-block ')
        return `<div${before}${newClass}${after}>`
      }
      return match
    }
  )

  return processed
}

/**
 * Prepare HTML for Klaviyo template upload
 * 
 * Ensures the HTML is properly formatted for Klaviyo's template system
 */
export function prepareTemplateHtml(html: string, options?: {
  addEditableRegions?: boolean
  stripKlaviyoBranding?: boolean
}): string {
  let processed = html

  // Add editable regions if requested
  if (options?.addEditableRegions) {
    processed = addEditableRegions(processed)
  }

  // Ensure unsubscribe link exists
  if (!processed.includes('{% unsubscribe')) {
    // Table-based layout required for Outlook compatibility
    const unsubscribeHtml = `<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tbody><tr><td align="center" style="padding:20px;font-size:12px;color:#666666;font-family:Helvetica,Arial,sans-serif;">{% unsubscribe "Unsubscribe" %}</td></tr></tbody></table>`
    processed = processed.replace(/<\/body>/i, `${unsubscribeHtml}</body>`)
  }

  // Strip Klaviyo branding if requested (it will be auto-added based on account)
  if (options?.stripKlaviyoBranding) {
    processed = processed.replace(
      /<[^>]*class="[^"]*klBranding[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi,
      ''
    )
  }

  return processed
}
