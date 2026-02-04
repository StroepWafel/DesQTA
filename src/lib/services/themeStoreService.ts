import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger';
import type { ThemeManifest } from './themeService';

const DEFAULT_API_BASE_URL = 'https://betterseqta.org/api/themes';
const FALLBACK_TIMEOUT = 5000; // 5 seconds

// Get API base URL from localStorage (for dev purposes) or use default
function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const devUrl = localStorage.getItem('theme_store_dev_api_url');
    if (devUrl) {
      // Return base URL without /api/themes suffix (Rust will add it)
      return devUrl.endsWith('/api/themes') ? devUrl.replace('/api/themes', '') : devUrl;
    }
  }
  return DEFAULT_API_BASE_URL.replace('/api/themes', '');
}

// Resolve image URL - convert relative paths to absolute URLs
export function resolveImageUrl(imagePath: string | null | undefined): string | null {
  if (!imagePath) return null;

  // If already absolute URL, return as-is
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // If relative path starting with /, prepend API base URL
  if (imagePath.startsWith('/')) {
    const baseUrl = getApiBaseUrl();
    // Remove trailing slash from baseUrl if present
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBase}${imagePath}`;
  }

  // Otherwise return as-is (might be a data URL or other format)
  return imagePath;
}

export interface CloudTheme {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  author: string;
  license: string;
  category?: string;
  tags?: string[];
  status: string;
  featured: boolean;
  download_count: number;
  favorite_count: number;
  rating_average: number;
  rating_count: number;
  compatibility: {
    min: string;
    max?: string;
  };
  preview: {
    thumbnail?: string;
    screenshots?: string[];
  };
  created_at: number;
  updated_at: number;
  published_at?: number;
  file_size: number;
  is_favorited?: boolean;
  user_rating?: {
    rating: number;
    comment?: string;
  } | null;
}

export interface ThemeListResponse {
  themes: CloudTheme[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ThemeDetailResponse {
  theme: CloudTheme & {
    preview_thumbnail_url?: string;
    zip_download_url?: string;
    checksum?: string;
    manifest: ThemeManifest;
  };
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  slug: string;
  cover_image_url?: string;
  featured: boolean;
  theme_count: number;
  themes: CloudTheme[];
  created_at: number;
}

class ThemeStoreService {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private storeAvailable = true;
  private lastCheck = 0;
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private async checkStoreAvailability(): Promise<boolean> {
    const now = Date.now();
    if (now - this.lastCheck < this.CHECK_INTERVAL) {
      return this.storeAvailable;
    }

    try {
      const baseUrl = getApiBaseUrl();
      await invoke('theme_store_get_spotlight', {
        baseUrl: baseUrl || null,
      });
      this.storeAvailable = true;
      this.lastCheck = now;
      return true;
    } catch {
      this.storeAvailable = false;
      this.lastCheck = now;
      return false;
    }
  }

  private async request<T>(
    endpoint: string,
    method: string = 'GET',
    headers?: Record<string, string>,
    body?: any,
    invalidateCache?: boolean,
  ): Promise<T | null> {
    const available = await this.checkStoreAvailability();
    if (!available) {
      logger.warn('themeStoreService', 'request', 'Store unavailable, returning null', {
        endpoint,
      });
      return null;
    }

    const cacheKey = `${endpoint}:${method}:${JSON.stringify(headers)}:${JSON.stringify(body)}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    // Check if cache should be invalidated based on updated_at
    if (!invalidateCache && cached && now - cached.timestamp < this.CACHE_TTL) {
      return cached.data as T;
    }

    try {
      const baseUrl = getApiBaseUrl();
      const result = await invoke<any>('theme_store_request', {
        endpoint,
        method,
        headers: headers || null,
        body: body || null,
        baseUrl: baseUrl || null,
      });

      this.cache.set(cacheKey, { data: result, timestamp: now });
      return result as T;
    } catch (error) {
      logger.error('themeStoreService', 'request', `Failed to fetch ${endpoint}`, {
        error,
        endpoint,
      });
      this.storeAvailable = false;
      return null;
    }
  }

  // Invalidate cache for a specific theme if updated_at has changed
  async invalidateThemeCache(themeId: string, latestUpdatedAt: number): Promise<void> {
    try {
      // Get stored metadata for this theme
      const { invoke } = await import('@tauri-apps/api/core');
      const subset = await invoke<any>('get_settings_subset', {
        keys: ['downloaded_theme_metadata'],
      });
      const metadata: Record<string, { updated_at: number }> =
        subset?.downloaded_theme_metadata || {};
      const storedMetadata = metadata[themeId];

      // If theme was updated, invalidate related caches
      if (storedMetadata && latestUpdatedAt > storedMetadata.updated_at) {
        // Clear theme-specific caches
        const keysToDelete: string[] = [];
        for (const [key] of this.cache) {
          if (key.includes(`getTheme:${themeId}`) || key.includes(`listThemes`)) {
            keysToDelete.push(key);
          }
        }
        keysToDelete.forEach((key) => this.cache.delete(key));
        logger.debug('themeStoreService', 'invalidateThemeCache', 'Invalidated cache for theme', {
          themeId,
          latestUpdatedAt,
        });
      }
    } catch (error) {
      logger.error('themeStoreService', 'invalidateThemeCache', 'Failed to invalidate cache', {
        error,
        themeId,
      });
    }
  }

  async listThemes(params: {
    page?: number;
    limit?: number;
    category?: string;
    tags?: string[];
    search?: string;
    sort?: 'popular' | 'newest' | 'rating' | 'downloads' | 'name';
    featured?: boolean;
    min_rating?: number;
    compatible_version?: string;
  }): Promise<ThemeListResponse | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const cacheKey = `listThemes:${JSON.stringify(params)}`;
      const cached = this.cache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        return cached.data as ThemeListResponse;
      }

      const result = await invoke<ThemeListResponse>('theme_store_list_themes', {
        page: params.page || null,
        limit: params.limit || null,
        category: params.category || null,
        tags: params.tags || null,
        search: params.search || null,
        sort: params.sort || null,
        featured: params.featured !== undefined ? params.featured : null,
        minRating: params.min_rating || null,
        compatibleVersion: params.compatible_version || null,
        baseUrl: baseUrl || null,
      });

      this.cache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (error) {
      logger.error('themeStoreService', 'listThemes', 'Failed to list themes', { error });
      this.storeAvailable = false;
      return null;
    }
  }

  async getTheme(id: string, invalidateCache?: boolean): Promise<ThemeDetailResponse | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const cacheKey = `getTheme:${id}`;
      const cached = this.cache.get(cacheKey);
      const now = Date.now();

      if (!invalidateCache && cached && now - cached.timestamp < this.CACHE_TTL) {
        return cached.data as ThemeDetailResponse;
      }

      const result = await invoke<ThemeDetailResponse>('theme_store_get_theme', {
        id,
        baseUrl: baseUrl || null,
      });

      this.cache.set(cacheKey, { data: result, timestamp: now });

      // Check if we should invalidate cache based on updated_at
      if (result?.theme?.updated_at) {
        await this.invalidateThemeCache(id, result.theme.updated_at);
      }

      return result;
    } catch (error) {
      logger.error('themeStoreService', 'getTheme', `Failed to get theme ${id}`, { error });
      return null;
    }
  }

  async searchThemes(
    query: string,
    filters?: {
      categories?: string[];
      tags?: string[];
      features?: string[];
      min_rating?: number;
      compatible_version?: string;
    },
  ): Promise<ThemeListResponse | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const result = await invoke<ThemeListResponse>('theme_store_search_themes', {
        query,
        filters: filters || null,
        baseUrl: baseUrl || null,
      });
      return result;
    } catch (error) {
      logger.error('themeStoreService', 'searchThemes', 'Failed to search themes', { error });
      return null;
    }
  }

  async getCollections(): Promise<{ collections: Collection[] } | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const cacheKey = 'getCollections';
      const cached = this.cache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        return cached.data as { collections: Collection[] };
      }

      const result = await invoke<{ collections: Collection[] }>('theme_store_get_collections', {
        baseUrl: baseUrl || null,
      });

      this.cache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (error) {
      logger.error('themeStoreService', 'getCollections', 'Failed to get collections', {
        error,
      });
      return null;
    }
  }

  async getCollection(id: string): Promise<{ collection: Collection } | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const result = await invoke<{ collection: Collection }>('theme_store_get_collection', {
        id,
        baseUrl: baseUrl || null,
      });
      return result;
    } catch (error) {
      logger.error('themeStoreService', 'getCollection', `Failed to get collection ${id}`, {
        error,
      });
      return null;
    }
  }

  async getSpotlight(): Promise<ThemeListResponse | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const cacheKey = 'getSpotlight';
      const cached = this.cache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < this.CACHE_TTL) {
        return cached.data as ThemeListResponse;
      }

      const result = await invoke<ThemeListResponse>('theme_store_get_spotlight', {
        baseUrl: baseUrl || null,
      });

      this.cache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (error) {
      logger.error('themeStoreService', 'getSpotlight', 'Failed to get spotlight', { error });
      return null;
    }
  }

  async downloadTheme(id: string): Promise<{
    zip_download_url: string;
    checksum: string;
    file_size: number;
  } | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const result = await invoke<{
        zip_download_url: string;
        checksum: string;
        file_size: number;
      }>('theme_store_download_theme', {
        id,
        baseUrl: baseUrl || null,
      });
      return result;
    } catch (error) {
      logger.error('themeStoreService', 'downloadTheme', `Failed to get download info for ${id}`, {
        error,
      });
      return null;
    }
  }

  async favoriteTheme(id: string, authToken?: string | null): Promise<boolean> {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authToken || (await this.getAuthToken());
      const result = await invoke<{ favorited: boolean }>('theme_store_favorite_theme', {
        id,
        authToken: token || null,
        baseUrl: baseUrl || null,
      });
      return result?.favorited ?? false;
    } catch (error) {
      logger.error('themeStoreService', 'favoriteTheme', `Failed to favorite theme ${id}`, {
        error,
      });
      return false;
    }
  }

  async unfavoriteTheme(id: string, authToken?: string | null): Promise<boolean> {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authToken || (await this.getAuthToken());
      await invoke('theme_store_unfavorite_theme', {
        id,
        authToken: token || null,
        baseUrl: baseUrl || null,
      });
      return true;
    } catch (error) {
      logger.error('themeStoreService', 'unfavoriteTheme', `Failed to unfavorite theme ${id}`, {
        error,
      });
      return false;
    }
  }

  async getFavorites(authToken?: string | null): Promise<ThemeListResponse | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authToken || (await this.getAuthToken());
      const result = await invoke<ThemeListResponse>('theme_store_get_favorites', {
        authToken: token || null,
        baseUrl: baseUrl || null,
      });
      return result;
    } catch (error) {
      logger.error('themeStoreService', 'getFavorites', 'Failed to get favorites', { error });
      return null;
    }
  }

  async getUserStatus(
    themeId: string,
    authToken?: string | null,
  ): Promise<{
    is_favorited: boolean;
    has_rated: boolean;
    rating: { id: string; rating: number; comment?: string } | null;
  } | null> {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authToken || (await this.getAuthToken());
      const result = await invoke<{
        is_favorited: boolean;
        has_rated: boolean;
        rating: { id: string; rating: number; comment?: string } | null;
      }>('theme_store_get_user_status', {
        id: themeId,
        authToken: token || null,
        baseUrl: baseUrl || null,
      });
      return result;
    } catch (error) {
      logger.error(
        'themeStoreService',
        'getUserStatus',
        `Failed to get user status for ${themeId}`,
        {
          error,
        },
      );
      return null;
    }
  }

  async rateTheme(
    id: string,
    rating: number,
    comment?: string,
    authToken?: string | null,
  ): Promise<boolean> {
    try {
      const baseUrl = getApiBaseUrl();
      const token = authToken || (await this.getAuthToken());
      await invoke('theme_store_rate_theme', {
        id,
        rating,
        comment: comment || null,
        authToken: token || null,
        baseUrl: baseUrl || null,
      });
      return true;
    } catch (error) {
      logger.error('themeStoreService', 'rateTheme', `Failed to rate theme ${id}`, { error });
      return false;
    }
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const { cloudAuthService } = await import('./cloudAuthService');
      return await cloudAuthService.getToken();
    } catch {
      return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  isStoreAvailable(): boolean {
    return this.storeAvailable;
  }

  // Dev helper: Set custom API URL
  setDevApiUrl(url: string | null): void {
    if (typeof window !== 'undefined') {
      if (url) {
        localStorage.setItem('theme_store_dev_api_url', url);
      } else {
        localStorage.removeItem('theme_store_dev_api_url');
      }
      // Clear cache when URL changes
      this.clearCache();
      // Reset availability check
      this.storeAvailable = true;
      this.lastCheck = 0;
    }
  }

  // Dev helper: Get current API URL
  getCurrentApiUrl(): string {
    return getApiBaseUrl();
  }
}

export const themeStoreService = new ThemeStoreService();
