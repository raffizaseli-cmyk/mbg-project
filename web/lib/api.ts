import axios, { AxiosInstance } from "axios";

let apiClient: AxiosInstance | null = null;

export function getApiClient(): AxiosInstance {
  if (!apiClient) {
    apiClient = axios.create({
      baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000",
      timeout: 120_000,
    });

    // Request interceptor: attach JWT token
    apiClient.interceptors.request.use(
      (config) => {
        const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor: handle error codes
    apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        const status = error.response?.status;

        if (status === 401) {
          if (typeof window !== "undefined") {
            localStorage.removeItem("auth_token");
            window.location.href = "/login";
          }
        } else if (status === 429) {
          if (typeof window !== "undefined") {
            const event = new CustomEvent("app:toast", {
              detail: { message: "⚠️ Terlalu banyak request. Tunggu sebentar.", type: "warning" },
            });
            window.dispatchEvent(event);
          }
        } else if (status && status >= 500) {
          if (typeof window !== "undefined") {
            const event = new CustomEvent("app:toast", {
              detail: { message: "❌ Server sedang bermasalah. Coba lagi.", type: "error" },
            });
            window.dispatchEvent(event);
          }
        }

        return Promise.reject(error);
      }
    );



  }

  return apiClient;
}

// In-memory cache & in-flight promise map for request deduplication
interface CacheEntry {
  data: any;
  expiry: number;
}

const memoryCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

export function clearApiCache() {
  memoryCache.clear();
}

function getCacheKey(endpoint: string, params?: any): string {
  if (!params || Object.keys(params).length === 0) return endpoint;
  try {
    return `${endpoint}?${JSON.stringify(params)}`;
  } catch {
    return endpoint;
  }
}

export interface ApiGetOptions {
  bypassCache?: boolean;
  ttlMs?: number;
}

export async function apiGet(endpoint: string, params?: any, options?: ApiGetOptions) {
  const cacheKey = getCacheKey(endpoint, params);
  const now = Date.now();

  // 1. Check in-memory cache if not bypassing
  if (!options?.bypassCache) {
    const cached = memoryCache.get(cacheKey);
    if (cached && cached.expiry > now) {
      return cached.data;
    }
  }

  // 2. In-flight request deduplication
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  // 3. Execute HTTP request
  const fetchPromise = (async () => {
    const client = getApiClient();
    const response = await client.get(endpoint, { params });
    const data = response.data;

    // Cache TTL: Default 5 seconds for fast tab switches, 60s for static/master data
    let ttl = options?.ttlMs ?? 5_000;
    if (
      endpoint.includes("/auth/me") || 
      endpoint.includes("/recipes/components") || 
      endpoint.includes("/ingredients/master") ||
      endpoint.includes("/tenants/me")
    ) {
      ttl = options?.ttlMs ?? 60_000;
    }

    if (ttl > 0) {
      memoryCache.set(cacheKey, { data, expiry: Date.now() + ttl });
    }

    return data;
  })()
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

export async function apiPost(endpoint: string, data?: any) {
  clearApiCache();
  const client = getApiClient();
  const response = await client.post(endpoint, data);
  return response.data;
}

export async function apiPut(endpoint: string, data?: any) {
  clearApiCache();
  const client = getApiClient();
  const response = await client.put(endpoint, data);
  return response.data;
}

export async function apiDelete(endpoint: string) {
  clearApiCache();
  const client = getApiClient();
  const response = await client.delete(endpoint);
  return response.data;
}

export async function apiPatch(endpoint: string, data?: any) {
  clearApiCache();
  const client = getApiClient();
  const response = await client.patch(endpoint, data);
  return response.data;
}

export async function apiUpload(endpoint: string, formData: FormData) {
  clearApiCache();
  const client = getApiClient();
  const response = await client.post(endpoint, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function apiDownload(endpoint: string, filename: string) {
  const client = getApiClient();
  const response = await client.get(endpoint, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}


