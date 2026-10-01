export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  token?: string | null;
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
}

export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly data?: any;

  constructor(
    status: number,
    statusText: string,
    data?: any,
    message?: string,
  ) {
    super(message || `Request failed with status ${status} (${statusText})`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

// Token getter function that can be set or dynamically read without circular dependencies
let tokenProvider: (() => string | null) | null = null;

export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

/**
 * Universal JSON fetch wrapper for client requests.
 * Handles query parameter serialization, auth header injection, timeouts, and error normalization.
 */
export async function apiRequest<T>(
  url: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const {
    body,
    token,
    params,
    timeoutMs,
    headers: customHeaders,
    signal: userSignal,
    ...restOptions
  } = options;

  // 1. Build URL with query parameters if present
  const apiBase = (import.meta.env.VITE_API_GATEWAY_URL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  let fullUrl = url.startsWith('/') && apiBase ? `${apiBase}${url}` : url;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
    }
  }

  // 2. Prepare headers
  const headers = new Headers(customHeaders);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // Determine token: explicit token takes priority, then dynamic token provider
  const resolvedToken = token !== undefined ? token : tokenProvider ? tokenProvider() : null;
  if (resolvedToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${resolvedToken}`);
  }

  // Handle request payload
  let requestBody: BodyInit | undefined = undefined;
  if (body !== undefined && body !== null) {
    if (body instanceof FormData || body instanceof Blob || typeof body === 'string') {
      requestBody = body;
    } else {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      requestBody = JSON.stringify(body);
    }
  }

  // 3. Setup timeout and signal cancellation
  const abortController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeoutMs);
  }

  // Combine user signal and timeout signal if user provided a signal
  if (userSignal) {
    if (userSignal.aborted) {
      abortController.abort();
    } else {
      userSignal.addEventListener('abort', () => abortController.abort(), { once: true });
    }
  }

  try {
    const response = await fetch(fullUrl, {
      ...restOptions,
      headers,
      body: requestBody,
      signal: abortController.signal,
    });

    if (!response.ok) {
      let errorData: any = null;
      try {
        errorData = await response.json();
      } catch {
        // Response wasn't JSON
      }

      const errorMessage =
        Array.isArray(errorData?.message)
          ? errorData.message.join(', ')
          : errorData?.message ||
            (response.status === 401
              ? 'Unauthorized: Session expired or missing access token'
              : `HTTP ${response.status}: ${response.statusText}`);

      throw new ApiError(response.status, response.statusText, errorData, errorMessage);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return (await response.json()) as T;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Convenient shorthand object for REST methods.
 */
export const apiClient = {
  get: <T>(url: string, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),

  post: <T>(url: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'POST', body }),

  put: <T>(url: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'PUT', body }),

  patch: <T>(url: string, body?: any, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'PATCH', body }),

  delete: <T>(url: string, options?: ApiRequestOptions) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),
};
