/**
 * Klaviyo Lists API
 * 
 * Create and manage lists for email and SMS subscribers in Klaviyo.
 */

import { KlaviyoClient } from './client'

export interface KlaviyoList {
  type: 'list'
  id: string
  attributes: {
    name: string
    created: string
    updated: string
    opt_in_process?: 'single_opt_in' | 'double_opt_in'
  }
}

export interface CreateListOptions {
  name: string
  optInProcess?: 'single_opt_in' | 'double_opt_in'
}

/**
 * Create a new list in Klaviyo
 */
export async function createList(
  client: KlaviyoClient,
  options: CreateListOptions
): Promise<KlaviyoList> {
  const payload = {
    data: {
      type: 'list',
      attributes: {
        name: options.name,
        opt_in_process: options.optInProcess || 'single_opt_in',
      },
    },
  }

  const response = await client.post<{ data: KlaviyoList }>(
    '/lists/',
    payload
  )

  return response.data
}

/**
 * Get all lists
 */
export async function getLists(
  client: KlaviyoClient,
  options?: {
    filter?: string
    pageSize?: number
  }
): Promise<KlaviyoList[]> {
  let endpoint = '/lists/'
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

  const response = await client.get<{ data: KlaviyoList[] }>(endpoint)
  return response.data
}

/**
 * Get a specific list by ID
 */
export async function getList(
  client: KlaviyoClient,
  listId: string
): Promise<KlaviyoList> {
  const response = await client.get<{ data: KlaviyoList }>(`/lists/${listId}/`)
  return response.data
}

/**
 * Update a list
 */
export async function updateList(
  client: KlaviyoClient,
  listId: string,
  updates: { name?: string }
): Promise<KlaviyoList> {
  const payload = {
    data: {
      type: 'list',
      id: listId,
      attributes: updates,
    },
  }

  const response = await client.patch<{ data: KlaviyoList }>(
    `/lists/${listId}/`,
    payload
  )

  return response.data
}

/**
 * Delete a list
 */
export async function deleteList(
  client: KlaviyoClient,
  listId: string
): Promise<void> {
  await client.delete(`/lists/${listId}/`)
}

/**
 * Add profiles to a list
 */
export async function addProfilesToList(
  client: KlaviyoClient,
  listId: string,
  profileIds: string[]
): Promise<void> {
  const payload = {
    data: profileIds.map(id => ({
      type: 'profile',
      id,
    })),
  }

  await client.post(
    `/lists/${listId}/relationships/profiles/`,
    payload
  )
}

/**
 * Helper: Create both email and SMS lists for a brand
 */
export async function createBrandLists(
  client: KlaviyoClient,
  brandName: string
): Promise<{
  emailList: KlaviyoList
  smsList: KlaviyoList
}> {
  const emailList = await createList(client, {
    name: `${brandName} - Email Subscribers`,
    optInProcess: 'double_opt_in',
  })

  const smsList = await createList(client, {
    name: `${brandName} - SMS Subscribers`,
    optInProcess: 'double_opt_in',
  })

  return { emailList, smsList }
}

/**
 * Get list URL in Klaviyo
 */
export function getListUrl(listId: string): string {
  return `https://www.klaviyo.com/lists/${listId}`
}
