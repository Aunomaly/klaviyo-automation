/**
 * Klaviyo Coupons API
 * 
 * Create and manage discount codes in Klaviyo.
 */

import { KlaviyoClient } from './client'

export interface KlaviyoCoupon {
  type: 'coupon'
  id: string
  attributes: {
    external_id: string
    description?: string
    expires_at?: string
  }
}

export interface KlaviyoCouponCode {
  type: 'coupon-code'
  id: string
  attributes: {
    unique_code: string
    expires_at?: string
    status: 'assigned' | 'unassigned' | 'used'
  }
  relationships?: {
    coupon?: {
      data: { type: 'coupon'; id: string }
    }
  }
}

export interface CreateCouponOptions {
  externalId: string // Your internal coupon identifier
  description?: string
  expiresAt?: string // ISO 8601 date
}

export interface CreateCouponCodeOptions {
  couponId: string
  uniqueCode: string
  expiresAt?: string
}

/**
 * Create a new coupon in Klaviyo
 */
export async function createCoupon(
  client: KlaviyoClient,
  options: CreateCouponOptions
): Promise<KlaviyoCoupon> {
  const payload = {
    data: {
      type: 'coupon',
      attributes: {
        external_id: options.externalId,
        description: options.description,
        expires_at: options.expiresAt,
      },
    },
  }

  const response = await client.post<{ data: KlaviyoCoupon }>(
    '/coupons/',
    payload
  )

  return response.data
}

/**
 * Get all coupons
 */
export async function getCoupons(
  client: KlaviyoClient,
  options?: {
    filter?: string
    pageSize?: number
  }
): Promise<KlaviyoCoupon[]> {
  let endpoint = '/coupons/'
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

  const response = await client.get<{ data: KlaviyoCoupon[] }>(endpoint)
  return response.data
}

/**
 * Get a specific coupon by ID
 */
export async function getCoupon(
  client: KlaviyoClient,
  couponId: string
): Promise<KlaviyoCoupon> {
  const response = await client.get<{ data: KlaviyoCoupon }>(
    `/coupons/${couponId}/`
  )
  return response.data
}

/**
 * Create a coupon code for a coupon
 */
export async function createCouponCode(
  client: KlaviyoClient,
  options: CreateCouponCodeOptions
): Promise<KlaviyoCouponCode> {
  const payload = {
    data: {
      type: 'coupon-code',
      attributes: {
        unique_code: options.uniqueCode,
        expires_at: options.expiresAt,
      },
      relationships: {
        coupon: {
          data: {
            type: 'coupon',
            id: options.couponId,
          },
        },
      },
    },
  }

  const response = await client.post<{ data: KlaviyoCouponCode }>(
    '/coupon-codes/',
    payload
  )

  return response.data
}

/**
 * Get all coupon codes
 */
export async function getCouponCodes(
  client: KlaviyoClient,
  options?: {
    filter?: string
    couponId?: string
    pageSize?: number
  }
): Promise<KlaviyoCouponCode[]> {
  let endpoint = '/coupon-codes/'
  const params: string[] = []

  if (options?.filter) {
    params.push(`filter=${encodeURIComponent(options.filter)}`)
  }
  if (options?.couponId) {
    params.push(`filter=equals(coupon.id,"${options.couponId}")`)
  }
  if (options?.pageSize) {
    params.push(`page[size]=${options.pageSize}`)
  }

  if (params.length > 0) {
    endpoint += `?${params.join('&')}`
  }

  const response = await client.get<{ data: KlaviyoCouponCode[] }>(endpoint)
  return response.data
}

/**
 * Update a coupon code status
 */
export async function updateCouponCode(
  client: KlaviyoClient,
  codeId: string,
  updates: {
    status?: 'assigned' | 'unassigned' | 'used'
    expiresAt?: string
  }
): Promise<KlaviyoCouponCode> {
  const payload = {
    data: {
      type: 'coupon-code',
      id: codeId,
      attributes: {
        status: updates.status,
        expires_at: updates.expiresAt,
      },
    },
  }

  const response = await client.patch<{ data: KlaviyoCouponCode }>(
    `/coupon-codes/${codeId}/`,
    payload
  )

  return response.data
}

/**
 * Helper: Create a welcome discount coupon with codes
 */
export async function createWelcomeDiscount(
  client: KlaviyoClient,
  brandName: string,
  discountCode: string,
  options?: {
    description?: string
    expiresAt?: string
  }
): Promise<{
  coupon: KlaviyoCoupon
  code: KlaviyoCouponCode
}> {
  // Create the coupon
  const coupon = await createCoupon(client, {
    externalId: `${brandName.toLowerCase().replace(/\s+/g, '-')}-welcome-10`,
    description: options?.description || `${brandName} Welcome Discount - 10% Off`,
    expiresAt: options?.expiresAt,
  })

  // Create a coupon code for it
  const code = await createCouponCode(client, {
    couponId: coupon.id,
    uniqueCode: discountCode,
    expiresAt: options?.expiresAt,
  })

  return { coupon, code }
}

/**
 * Helper: Generate multiple unique coupon codes
 */
export async function generateBulkCouponCodes(
  client: KlaviyoClient,
  couponId: string,
  prefix: string,
  count: number,
  expiresAt?: string
): Promise<KlaviyoCouponCode[]> {
  const codes: KlaviyoCouponCode[] = []

  for (let i = 0; i < count; i++) {
    const uniqueCode = `${prefix}${generateRandomString(8)}`
    
    try {
      const code = await createCouponCode(client, {
        couponId,
        uniqueCode,
        expiresAt,
      })
      codes.push(code)
    } catch (error) {
      console.error(`Failed to create code ${uniqueCode}:`, error)
    }
  }

  return codes
}

/**
 * Generate a random alphanumeric string
 */
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Get coupon URL in Klaviyo
 */
export function getCouponUrl(couponId: string): string {
  return `https://www.klaviyo.com/coupon/${couponId}`
}
