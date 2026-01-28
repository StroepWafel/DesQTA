import { seqtaFetch } from '../../utils/netUtil';
import { logger } from '../../utils/logger';
import { invoke } from '@tauri-apps/api/core';
import { authService } from './authService';

interface ForumMessage {
  uuid?: string;
  [key: string]: any;
}

interface ForumDetail {
  messages?: ForumMessage[];
  [key: string]: any;
}

interface Forum {
  id: number;
  title: string;
  closed: string | null;
  [key: string]: any;
}

interface ForumsResponse {
  payload?: {
    forums?: Forum[];
    me?: string;
  };
  status?: string;
  [key: string]: any;
}

/**
 * Background service to sync forum photos
 * Scans all forums, extracts UUIDs, and downloads high-quality photos
 */
export const forumPhotoSyncService = {
  /**
   * Check if forums are enabled
   */
  async checkForumsEnabled(): Promise<boolean> {
    try {
      const response = await seqtaFetch('/seqta/student/load/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {},
      });

      const data = typeof response === 'string' ? JSON.parse(response) : response;
      const forumsPageEnabled = data?.payload?.['coneqt-s.page.forums']?.value === 'enabled';
      const forumsGreetingExists = data?.payload?.['coneqt-s.forum.greeting'] !== undefined;
      return forumsPageEnabled || forumsGreetingExists;
    } catch (e) {
      logger.error('forumPhotoSyncService', 'checkForumsEnabled', `Failed to check forums enabled: ${e}`, { error: e });
      return false;
    }
  },

  /**
   * Extract all UUIDs from forum messages
   */
  async extractAllUUIDs(): Promise<{ uuids: Set<string>; uuidNameMap: Map<string, string> }> {
    const uuids = new Set<string>();
    const uuidNameMap = new Map<string, string>();
    
    try {
      // Fetch all forums (including closed ones) using 'list' mode
      const response = await seqtaFetch('/seqta/student/load/forums', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { mode: 'list' },
      });

      const data: ForumsResponse = typeof response === 'string' ? JSON.parse(response) : response;
      const forums = data?.payload?.forums || [];

      logger.info('forumPhotoSyncService', 'extractAllUUIDs', `Found ${forums.length} forums (including closed)`, {
        forumCount: forums.length,
        responseData: data,
      });

      if (forums.length === 0) {
        logger.warn('forumPhotoSyncService', 'extractAllUUIDs', 'No forums returned from API', {
          response: data,
        });
        return { uuids, uuidNameMap };
      }

      // Process each forum to get messages (both open and closed)
      for (const forum of forums) {
        try {
          const isClosed = forum.closed !== null && forum.closed !== undefined;
          logger.debug('forumPhotoSyncService', 'extractAllUUIDs', `Loading forum ${forum.id}`, {
            forumId: forum.id,
            title: forum.title,
            closed: isClosed,
          });

          const forumResponse = await seqtaFetch('/seqta/student/load/forums', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { mode: 'normal', id: forum.id },
          });

          const forumResponseData = typeof forumResponse === 'string' ? JSON.parse(forumResponse) : forumResponse;
          
          // The response structure is: { status: '200', payload: { messages: [...], ... } }
          let messages: ForumMessage[] = [];
          if (forumResponseData?.status === '200' && forumResponseData?.payload) {
            messages = forumResponseData.payload.messages || [];
          } else if (forumResponseData?.messages) {
            // Fallback: messages might be directly in the response
            messages = forumResponseData.messages;
          } else if (forumResponseData?.payload?.messages) {
            // Another fallback pattern
            messages = forumResponseData.payload.messages;
          }

          logger.debug('forumPhotoSyncService', 'extractAllUUIDs', `Loaded forum ${forum.id}`, {
            forumId: forum.id,
            title: forum.title,
            closed: isClosed,
            messageCount: messages.length,
            responseStatus: forumResponseData?.status,
            hasPayload: !!forumResponseData?.payload,
          });

          // Extract UUIDs from messages with names for mapping
          for (const message of messages) {
            if (message.uuid && typeof message.uuid === 'string' && message.uuid.trim()) {
              const uuid = message.uuid.trim();
              uuids.add(uuid);
              // Store UUID -> name mapping for directory lookups
              if (message.name && typeof message.name === 'string') {
                uuidNameMap.set(uuid, message.name);
              }
            }
          }

          logger.debug('forumPhotoSyncService', 'extractAllUUIDs', `Processed forum ${forum.id}`, {
            forumId: forum.id,
            title: forum.title,
            closed: isClosed,
            messageCount: messages.length,
            uuidCount: uuids.size,
            extractedUUIDs: Array.from(uuids).slice(-5), // Last 5 UUIDs for debugging
          });
        } catch (e) {
          logger.error('forumPhotoSyncService', 'extractAllUUIDs', `Failed to load forum ${forum.id}: ${e}`, {
            error: e,
            forumId: forum.id,
            forumTitle: forum.title,
          });
          // Continue with other forums
        }
      }

      logger.info('forumPhotoSyncService', 'extractAllUUIDs', `Extracted ${uuids.size} unique UUIDs`, {
        totalUUIDs: uuids.size,
        nameMappings: uuidNameMap.size,
      });
    } catch (e) {
      logger.error('forumPhotoSyncService', 'extractAllUUIDs', `Failed to extract UUIDs: ${e}`, { error: e });
    }

    return { uuids, uuidNameMap };
  },

  /**
   * Download and save a photo for a UUID
   * Returns true if photo was downloaded or already exists, false otherwise
   */
  async downloadPhoto(uuid: string, name?: string): Promise<boolean> {
    try {
      // Check if photo already exists (double-check to avoid duplicate downloads)
      const existingPath = await invoke<string | null>('get_forum_photo_path', { uuid });
      if (existingPath) {
        logger.debug('forumPhotoSyncService', 'downloadPhoto', `Photo already exists, skipping UUID: ${uuid}`, {
          uuid,
          name,
          path: existingPath,
        });
        return true; // Return true to indicate "success" (already exists)
      }

      // Download photo in high format
      const profileImage = await seqtaFetch(`/seqta/student/photo/get`, {
        params: { uuid: uuid.trim(), format: 'high' },
        is_image: true,
      });

      if (!profileImage) {
        logger.debug('forumPhotoSyncService', 'downloadPhoto', `No photo data for UUID: ${uuid}`);
        return false;
      }

      // Save photo to profile directory
      const base64Data = `data:image/png;base64,${profileImage}`;
      await invoke('save_forum_photo', {
        uuid: uuid.trim(),
        base64Data,
        name: name || null,
      });

      logger.debug('forumPhotoSyncService', 'downloadPhoto', `Saved photo for UUID: ${uuid}`, { name });
      return true;
    } catch (e) {
      logger.error('forumPhotoSyncService', 'downloadPhoto', `Failed to download photo for UUID ${uuid}: ${e}`, {
        error: e,
        uuid,
        name,
      });
      return false;
    }
  },

  /**
   * Check which UUIDs already have photos downloaded
   */
  async filterExistingPhotos(uuids: Set<string>): Promise<{ existing: Set<string>; missing: Set<string> }> {
    const existing = new Set<string>();
    const missing = new Set<string>();

    logger.debug('forumPhotoSyncService', 'filterExistingPhotos', `Checking ${uuids.size} UUIDs for existing photos`);

    // Check all UUIDs in parallel (but in smaller batches to avoid overwhelming)
    const uuidArray = Array.from(uuids);
    const checkBatchSize = 10;

    for (let i = 0; i < uuidArray.length; i += checkBatchSize) {
      const batch = uuidArray.slice(i, i + checkBatchSize);
      const checkResults = await Promise.allSettled(
        batch.map(async (uuid) => {
          const path = await invoke<string | null>('get_forum_photo_path', { uuid });
          return { uuid, exists: !!path };
        })
      );

      for (const result of checkResults) {
        if (result.status === 'fulfilled') {
          const { uuid, exists } = result.value;
          if (exists) {
            existing.add(uuid);
          } else {
            missing.add(uuid);
          }
        } else {
          // On error, assume it doesn't exist and try to download
          const uuid = batch[checkResults.indexOf(result)];
          if (uuid) {
            missing.add(uuid);
          }
        }
      }
    }

    logger.info('forumPhotoSyncService', 'filterExistingPhotos', `Filtered UUIDs`, {
      total: uuids.size,
      existing: existing.size,
      missing: missing.size,
    });

    return { existing, missing };
  },

  /**
   * Sync all forum photos (main entry point)
   */
  async syncAllPhotos(): Promise<void> {
    try {
      logger.info('forumPhotoSyncService', 'syncAllPhotos', 'Starting forum photo sync');

      // Check if forums are enabled
      const forumsEnabled = await this.checkForumsEnabled();
      if (!forumsEnabled) {
        logger.info('forumPhotoSyncService', 'syncAllPhotos', 'Forums not enabled, skipping sync');
        return;
      }

      // Extract all UUIDs with name mappings from forums
      const { uuids, uuidNameMap } = await this.extractAllUUIDs();
      
      // Also add the current logged-in user's photo
      try {
        const userInfo = await authService.loadUserInfo({ disableSchoolPicture: true });
        if (userInfo?.personUUID) {
          const userUUID = userInfo.personUUID.trim();
          uuids.add(userUUID);
          // Use displayName or userName for the name mapping
          const userName = userInfo.displayName || userInfo.userName || 'Current User';
          uuidNameMap.set(userUUID, userName);
          logger.debug('forumPhotoSyncService', 'syncAllPhotos', `Added current user to sync list`, {
            uuid: userUUID,
            name: userName,
          });
        }
      } catch (e) {
        logger.warn('forumPhotoSyncService', 'syncAllPhotos', `Failed to get current user info: ${e}`, { error: e });
        // Continue with forum UUIDs even if we can't get current user
      }

      if (uuids.size === 0) {
        logger.info('forumPhotoSyncService', 'syncAllPhotos', 'No UUIDs found, nothing to sync');
        return;
      }

      // Filter out UUIDs that already have photos downloaded
      const { existing, missing } = await this.filterExistingPhotos(uuids);

      if (existing.size > 0) {
        logger.info('forumPhotoSyncService', 'syncAllPhotos', `Skipping ${existing.size} already-downloaded photos`);
      }

      if (missing.size === 0) {
        logger.info('forumPhotoSyncService', 'syncAllPhotos', 'All photos already downloaded, nothing to sync');
        return;
      }

      // Download only missing photos in batches to avoid overwhelming the server
      const batchSize = 5;
      const uuidArray = Array.from(missing);
      let successCount = 0;
      let failCount = 0;
      let skippedCount = existing.size;

      logger.info('forumPhotoSyncService', 'syncAllPhotos', `Starting download of ${missing.size} photos`, {
        totalUUIDs: uuids.size,
        toDownload: missing.size,
        alreadyDownloaded: existing.size,
      });

      for (let i = 0; i < uuidArray.length; i += batchSize) {
        const batch = uuidArray.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((uuid) => {
            // Double-check before downloading (in case it was downloaded in parallel)
            return this.downloadPhoto(uuid, uuidNameMap.get(uuid));
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled') {
            if (result.value) {
              successCount++;
            } else {
              // downloadPhoto returns false if photo already exists or download failed
              // Check if it exists now (might have been downloaded by another batch)
              skippedCount++;
            }
          } else {
            failCount++;
          }
        }

        logger.debug('forumPhotoSyncService', 'syncAllPhotos', `Processed batch ${Math.floor(i / batchSize) + 1}`, {
          batch: Math.floor(i / batchSize) + 1,
          totalBatches: Math.ceil(uuidArray.length / batchSize),
          successCount,
          skippedCount,
          failCount,
        });

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < uuidArray.length) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      logger.info('forumPhotoSyncService', 'syncAllPhotos', 'Completed forum photo sync', {
        totalUUIDs: uuids.size,
        downloaded: successCount,
        skipped: skippedCount,
        failed: failCount,
      });
    } catch (e) {
      logger.error('forumPhotoSyncService', 'syncAllPhotos', `Failed to sync forum photos: ${e}`, { error: e });
    }
  },
};
