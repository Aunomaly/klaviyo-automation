/**
 * Klaviyo Flows API
 * 
 * Create and manage automated email flows in Klaviyo.
 * Supports time delays and split tests.
 */

import { KlaviyoClient } from './client'

export interface KlaviyoFlow {
  type: 'flow'
  id: string
  attributes: {
    name: string
    status: 'draft' | 'manual' | 'live'
    archived: boolean
    created: string
    updated: string
    trigger_type: string
  }
  relationships?: {
    'flow-actions'?: {
      data: Array<{ type: 'flow-action'; id: string }>
    }
  }
}

export interface KlaviyoFlowAction {
  type: 'flow-action'
  id: string
  attributes: {
    action_type: string
    status: 'draft' | 'manual' | 'live'
    created: string
    updated: string
    settings: Record<string, unknown>
  }
}

export type FlowTriggerType =
  | 'list' // List subscription
  | 'segment' // Segment entry
  | 'metric' // Custom event/metric
  | 'date_property' // Date property
  | 'price_drop' // Price drop

export interface TimeDelay {
  value: number
  unit: 'minutes' | 'hours' | 'days'
}

export interface FlowEmailAction {
  templateId: string
  subject: string
  previewText?: string
  fromEmail?: string
  fromName?: string
}

export interface FlowConfig {
  name: string
  triggerType: FlowTriggerType
  triggerConfig: Record<string, unknown>
  emails: Array<{
    delay: TimeDelay
    action: FlowEmailAction
  }>
  splitTest?: {
    variants: Array<{
      name: string
      weight: number // Percentage (0-100)
      delays: TimeDelay[]
    }>
  }
}

/**
 * Get all flows
 */
export async function getFlows(
  client: KlaviyoClient,
  options?: {
    filter?: string
    pageSize?: number
  }
): Promise<KlaviyoFlow[]> {
  let endpoint = '/flows/'
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

  const response = await client.get<{ data: KlaviyoFlow[] }>(endpoint)
  return response.data
}

/**
 * Get a specific flow by ID
 */
export async function getFlow(
  client: KlaviyoClient,
  flowId: string
): Promise<KlaviyoFlow> {
  const response = await client.get<{ data: KlaviyoFlow }>(
    `/flows/${flowId}/?include=flow-actions`
  )
  return response.data
}

/**
 * Get flow actions for a flow
 */
export async function getFlowActions(
  client: KlaviyoClient,
  flowId: string
): Promise<KlaviyoFlowAction[]> {
  const response = await client.get<{ data: KlaviyoFlowAction[] }>(
    `/flows/${flowId}/flow-actions/`
  )
  return response.data
}

/**
 * Update flow status
 */
export async function updateFlowStatus(
  client: KlaviyoClient,
  flowId: string,
  status: 'draft' | 'manual' | 'live'
): Promise<KlaviyoFlow> {
  const payload = {
    data: {
      type: 'flow',
      id: flowId,
      attributes: {
        status,
      },
    },
  }

  const response = await client.patch<{ data: KlaviyoFlow }>(
    `/flows/${flowId}/`,
    payload
  )

  return response.data
}

/**
 * Create a flow with actions
 * 
 * Note: The Klaviyo API for creating flows programmatically
 * may have limitations. This implementation provides the structure
 * but actual creation might need to use the Klaviyo Partner API
 * or be done via the UI first then configured via API.
 */
export async function createFlow(
  client: KlaviyoClient,
  config: FlowConfig
): Promise<KlaviyoFlow> {
  // Note: Full flow creation with actions may require Partner API access
  // This is a simplified implementation showing the structure
  
  const payload = {
    data: {
      type: 'flow',
      attributes: {
        name: config.name,
        trigger_type: mapTriggerType(config.triggerType),
        status: 'draft',
      },
    },
  }

  const response = await client.post<{ data: KlaviyoFlow }>(
    '/flows/',
    payload
  )

  return response.data
}

/**
 * Map our trigger types to Klaviyo's internal types
 */
function mapTriggerType(type: FlowTriggerType): string {
  const mapping: Record<FlowTriggerType, string> = {
    list: 'LIST_TRIGGER',
    segment: 'SEGMENT_TRIGGER',
    metric: 'METRIC_TRIGGER',
    date_property: 'DATE_TRIGGER',
    price_drop: 'PRICE_DROP_TRIGGER',
  }
  return mapping[type] || 'LIST_TRIGGER'
}

/**
 * Generate a flow configuration for common flow types
 */
export function generateFlowConfig(
  flowType: 'welcome' | 'abandoned_cart' | 'browse_abandonment' | 'winback',
  brandName: string,
  templateIds: string[]
): FlowConfig {
  const configs: Record<string, FlowConfig> = {
    welcome: {
      name: `${brandName} - Welcome Series`,
      triggerType: 'list',
      triggerConfig: {},
      emails: [
        {
          delay: { value: 0, unit: 'minutes' },
          action: {
            templateId: templateIds[0] || '',
            subject: `Welcome to ${brandName}!`,
            previewText: 'Your journey starts here',
          },
        },
        {
          delay: { value: 1, unit: 'days' },
          action: {
            templateId: templateIds[1] || '',
            subject: `Discover What Makes ${brandName} Special`,
            previewText: 'Explore our bestsellers',
          },
        },
        {
          delay: { value: 3, unit: 'days' },
          action: {
            templateId: templateIds[2] || '',
            subject: `Your 10% OFF is Waiting`,
            previewText: 'Don\'t miss out on your welcome discount',
          },
        },
      ],
    },
    abandoned_cart: {
      name: `${brandName} - Abandoned Cart`,
      triggerType: 'metric',
      triggerConfig: {
        metric: 'Started Checkout',
      },
      emails: [
        {
          delay: { value: 4, unit: 'hours' },
          action: {
            templateId: templateIds[0] || '',
            subject: 'You left something behind!',
            previewText: 'Your cart is waiting for you',
          },
        },
        {
          delay: { value: 24, unit: 'hours' },
          action: {
            templateId: templateIds[1] || '',
            subject: 'Still thinking it over?',
            previewText: 'Complete your order today',
          },
        },
        {
          delay: { value: 72, unit: 'hours' },
          action: {
            templateId: templateIds[2] || '',
            subject: 'Last chance for your items!',
            previewText: 'Don\'t let your cart expire',
          },
        },
      ],
      splitTest: {
        variants: [
          {
            name: 'Standard Timing',
            weight: 50,
            delays: [
              { value: 4, unit: 'hours' },
              { value: 24, unit: 'hours' },
              { value: 72, unit: 'hours' },
            ],
          },
          {
            name: 'Faster Timing',
            weight: 50,
            delays: [
              { value: 1, unit: 'hours' },
              { value: 12, unit: 'hours' },
              { value: 48, unit: 'hours' },
            ],
          },
        ],
      },
    },
    browse_abandonment: {
      name: `${brandName} - Browse Abandonment`,
      triggerType: 'metric',
      triggerConfig: {
        metric: 'Viewed Product',
      },
      emails: [
        {
          delay: { value: 2, unit: 'hours' },
          action: {
            templateId: templateIds[0] || '',
            subject: 'Still interested?',
            previewText: 'We noticed you looking',
          },
        },
        {
          delay: { value: 24, unit: 'hours' },
          action: {
            templateId: templateIds[1] || '',
            subject: 'Back for another look?',
            previewText: 'Your recently viewed items',
          },
        },
      ],
    },
    winback: {
      name: `${brandName} - Winback`,
      triggerType: 'segment',
      triggerConfig: {
        condition: 'no_purchase_in_60_days',
      },
      emails: [
        {
          delay: { value: 0, unit: 'minutes' },
          action: {
            templateId: templateIds[0] || '',
            subject: `We miss you, {{ first_name|default:'friend' }}!`,
            previewText: 'It\'s been a while',
          },
        },
        {
          delay: { value: 7, unit: 'days' },
          action: {
            templateId: templateIds[1] || '',
            subject: `Here's something special for you`,
            previewText: 'A special offer just for you',
          },
        },
      ],
    },
  }

  return configs[flowType]
}

/**
 * Get flow editor URL in Klaviyo
 */
export function getFlowEditorUrl(flowId: string): string {
  return `https://www.klaviyo.com/flow/${flowId}/edit`
}

/**
 * Convert delay to human-readable format
 */
export function formatDelay(delay: TimeDelay): string {
  const { value, unit } = delay
  
  if (value === 0) {
    return 'Immediately'
  }
  
  const unitLabel = value === 1 ? unit.slice(0, -1) : unit
  return `${value} ${unitLabel}`
}
