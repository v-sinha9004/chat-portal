export interface RequestJsonOptions extends RequestInit {
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Universal JSON fetch helper with built-in timeout, error parsing, and type safety.
 */
export async function requestJson<T>(
  url: string,
  options: RequestJsonOptions = {},
): Promise<T | null> {
  const { timeoutMs = 5000, headers, ...restOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new HttpError(
        response.status,
        response.statusText,
        `Request to ${url} failed with status ${response.status}`,
      );
    }

    const data = (await response.json()) as T;
    return data;
  } finally {
    clearTimeout(timeoutId);
  }
}
