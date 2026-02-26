/**
 * Template Loader
 * 
 * Loads base HTML templates from the file system
 */

import fs from 'fs'
import path from 'path'
import { TemplateType, TemplateInfo, TEMPLATE_REGISTRY } from './types'

// Base path for templates (relative to project root)
const TEMPLATES_BASE_PATH = path.join(process.cwd(), '..')

/**
 * Load a template by its type ID
 */
export async function loadTemplate(templateType: TemplateType): Promise<string> {
  const templateInfo = TEMPLATE_REGISTRY.find(t => t.id === templateType)
  
  if (!templateInfo) {
    throw new Error(`Template not found: ${templateType}`)
  }

  return loadTemplateByPath(templateInfo.filePath)
}

/**
 * Load a template by file path
 */
export async function loadTemplateByPath(relativePath: string): Promise<string> {
  // Resolve the path relative to the lib/templates directory
  const absolutePath = path.resolve(
    process.cwd(),
    'lib',
    'templates',
    relativePath
  )

  try {
    const html = await fs.promises.readFile(absolutePath, 'utf-8')
    return html
  } catch (error) {
    throw new Error(`Failed to load template: ${absolutePath}`)
  }
}

/**
 * Get all available templates
 */
export function getAvailableTemplates(): TemplateInfo[] {
  return TEMPLATE_REGISTRY
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateInfo['category']): TemplateInfo[] {
  return TEMPLATE_REGISTRY.filter(t => t.category === category)
}

/**
 * Check if all templates exist
 */
export async function validateTemplates(): Promise<{
  valid: boolean
  missing: string[]
}> {
  const missing: string[] = []

  for (const template of TEMPLATE_REGISTRY) {
    const absolutePath = path.resolve(
      process.cwd(),
      'lib',
      'templates',
      template.filePath
    )

    try {
      await fs.promises.access(absolutePath)
    } catch {
      missing.push(template.id)
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  }
}

/**
 * Template categories with metadata
 */
export const TEMPLATE_CATEGORIES = {
  welcome: {
    name: 'Welcome Series',
    description: 'Onboard new subscribers with a warm welcome',
    templateCount: TEMPLATE_REGISTRY.filter(t => t.category === 'welcome').length,
  },
  abandoned_cart: {
    name: 'Abandoned Cart',
    description: 'Recover lost sales from cart abandonment',
    templateCount: TEMPLATE_REGISTRY.filter(t => t.category === 'abandoned_cart').length,
  },
  browse_abandonment: {
    name: 'Browse Abandonment',
    description: 'Re-engage visitors who browsed but did not purchase',
    templateCount: TEMPLATE_REGISTRY.filter(t => t.category === 'browse_abandonment').length,
  },
  winback: {
    name: 'Winback',
    description: 'Re-activate lapsed customers',
    templateCount: TEMPLATE_REGISTRY.filter(t => t.category === 'winback').length,
  },
  post_purchase: {
    name: 'Post Purchase',
    description: 'Follow up after a purchase',
    templateCount: TEMPLATE_REGISTRY.filter(t => t.category === 'post_purchase').length,
  },
}
