/**
 * Klaviyo API Client
 * 
 * Base client for making authenticated requests to Klaviyo API
 */

const KLAVIYO_API_BASE = 'https://a.klaviyo.com/api'
const KLAVIYO_API_VERSION = '2024-02-15'

interface KlaviyoRequestOptions {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  endpoint: string
  body?: unknown
  apiKey: string
}

interface KlaviyoError {
  id: string
  status: number
  code: string
  title: string
  detail: string
  source?: {
    pointer?: string
    parameter?: string
  }
}

interface KlaviyoErrorResponse {
  errors: KlaviyoError[]
}

export class KlaviyoAPIError extends Error {
  status: number
  code: string
  errors: KlaviyoError[]

  constructor(message: string, status: number, code: string, errors: KlaviyoError[]) {
    super(message)
    this.name = 'KlaviyoAPIError'
    this.status = status
    this.code = code
    this.errors = errors
  }
}

/**
 * Make an authenticated request to Klaviyo API
 */
export async function klaviyoRequest<T>({
  method,
  endpoint,
  body,
  apiKey,
}: KlaviyoRequestOptions): Promise<T> {
  const url = `${KLAVIYO_API_BASE}${endpoint}`
  
  const headers: HeadersInit = {
    'Authorization': `Klaviyo-API-Key ${apiKey}`,
    'revision': KLAVIYO_API_VERSION,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }

  const options: RequestInit = {
    method,
    headers,
  }

  if (body && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(body)
  }

  const response = await fetch(url, options)

  if (!response.ok) {
    let errorData: KlaviyoErrorResponse
    try {
      errorData = await response.json()
    } catch {
      throw new KlaviyoAPIError(
        `Klaviyo API error: ${response.statusText}`,
        response.status,
        'UNKNOWN',
        []
      )
    }

    const firstError = errorData.errors?.[0]
    throw new KlaviyoAPIError(
      firstError?.detail || firstError?.title || 'Unknown Klaviyo error',
      response.status,
      firstError?.code || 'UNKNOWN',
      errorData.errors || []
    )
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}

/**
 * Klaviyo client instance with bound API key
 */
export class KlaviyoClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async get<T>(endpoint: string): Promise<T> {
    return klaviyoRequest<T>({
      method: 'GET',
      endpoint,
      apiKey: this.apiKey,
    })
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return klaviyoRequest<T>({
      method: 'POST',
      endpoint,
      body,
      apiKey: this.apiKey,
    })
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return klaviyoRequest<T>({
      method: 'PATCH',
      endpoint,
      body,
      apiKey: this.apiKey,
    })
  }

  async delete(endpoint: string): Promise<void> {
    return klaviyoRequest<void>({
      method: 'DELETE',
      endpoint,
      apiKey: this.apiKey,
    })
  }
}
