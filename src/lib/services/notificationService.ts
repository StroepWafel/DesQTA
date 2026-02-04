/**
 * Notification Service
 *
 * Manages OS notifications for assessments using SQLite for persistent storage.
 * Handles scheduling, sending, and tracking of notifications.
 */

import { invoke } from '@tauri-apps/api/core';
import { notify } from '../../utils/notify';
import { logger } from '../../utils/logger';
import type { Assessment } from '../types';

export type NotificationType = 'reminder_3days' | 'reminder_1day' | 'due_date' | 'overdue';

interface Notification {
  id: number;
  assessment_id: number;
  notification_type: NotificationType;
  scheduled_for: number;
  sent_at: number | null;
  created_at: number;
}

interface AssessmentNotification {
  assessment: Assessment;
  notification: Notification;
}

class NotificationService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private isRunning = false;

  /**
   * Schedule notifications for a list of assessments
   */
  async scheduleNotifications(assessments: Assessment[]): Promise<void> {
    try {
      const now = Date.now();
      const nowSeconds = Math.floor(now / 1000);

      for (const assessment of assessments) {
        await this.scheduleAssessmentNotifications(assessment, nowSeconds);
      }

      logger.info(
        'notificationService',
        'scheduleNotifications',
        `Scheduled notifications for ${assessments.length} assessments`,
      );
    } catch (error) {
      logger.error(
        'notificationService',
        'scheduleNotifications',
        'Failed to schedule notifications',
        { error },
      );
    }
  }

  /**
   * Schedule all notification types for a single assessment
   */
  private async scheduleAssessmentNotifications(
    assessment: Assessment,
    nowSeconds: number,
  ): Promise<void> {
    const dueDate = new Date(assessment.due);
    const dueTimestamp = Math.floor(dueDate.getTime() / 1000);
    const now = nowSeconds;

    // Calculate reminder times
    const reminder3Days = dueTimestamp - 3 * 24 * 60 * 60; // 3 days before
    const reminder1Day = dueTimestamp - 1 * 24 * 60 * 60; // 1 day before
    const dueDateTimestamp = dueTimestamp;

    // Check if overdue
    const isOverdue = assessment.overdue || dueDate.getTime() < Date.now();

    // Schedule reminders only if they're in the future
    if (reminder3Days > now) {
      await this.scheduleNotification(assessment.id, 'reminder_3days', reminder3Days);
    }

    if (reminder1Day > now) {
      await this.scheduleNotification(assessment.id, 'reminder_1day', reminder1Day);
    }

    if (dueDateTimestamp > now) {
      await this.scheduleNotification(assessment.id, 'due_date', dueDateTimestamp);
    }

    // Handle overdue notification (one-time only)
    if (isOverdue) {
      // Check if overdue notification already sent
      const existingNotifications = await invoke<Notification[]>(
        'db_notification_get_by_assessment',
        { assessmentId: assessment.id },
      );

      const overdueNotification = existingNotifications.find(
        (n) => n.notification_type === 'overdue',
      );

      if (!overdueNotification || !overdueNotification.sent_at) {
        // Schedule overdue notification immediately (or mark as due now)
        await this.scheduleNotification(assessment.id, 'overdue', now);
      }
    }
  }

  /**
   * Schedule a single notification
   */
  private async scheduleNotification(
    assessmentId: number,
    notificationType: NotificationType,
    scheduledFor: number,
  ): Promise<void> {
    try {
      await invoke('db_notification_schedule', {
        assessmentId,
        notificationType,
        scheduledFor,
      });
    } catch (error) {
      logger.error(
        'notificationService',
        'scheduleNotification',
        `Failed to schedule ${notificationType} notification for assessment ${assessmentId}`,
        { error },
      );
    }
  }

  /**
   * Check for due notifications and send them
   */
  async checkAndSendDueNotifications(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const dueNotifications = await invoke<Notification[]>('db_notification_get_due', {
        nowTimestamp: now,
      });

      if (dueNotifications.length === 0) {
        return;
      }

      logger.info(
        'notificationService',
        'checkAndSendDueNotifications',
        `Found ${dueNotifications.length} due notifications`,
      );

      // Get assessment data for notifications
      // Fetch assessments to get titles and details
      let assessmentsData: { assessments: Assessment[] } | null = null;
      try {
        assessmentsData = await invoke<{
          assessments: Assessment[];
        }>('get_processed_assessments');
      } catch (error) {
        logger.warn(
          'notificationService',
          'checkAndSendDueNotifications',
          'Failed to fetch assessments, skipping notification details',
          { error },
        );
      }

      const assessmentsMap = new Map<number, Assessment>();
      if (assessmentsData?.assessments) {
        assessmentsData.assessments.forEach((a) => {
          assessmentsMap.set(a.id, a);
        });
      }

      // Send notifications with spacing to prevent batch sending
      for (let i = 0; i < dueNotifications.length; i++) {
        const notification = dueNotifications[i];
        const assessment = assessmentsMap.get(notification.assessment_id);

        if (assessment) {
          await this.sendNotification(notification, assessment);
        } else {
          // Assessment not found - send basic notification with available info
          logger.warn(
            'notificationService',
            'checkAndSendDueNotifications',
            `Assessment ${notification.assessment_id} not found, sending basic notification`,
          );

          const title = this.getNotificationTitle(
            notification.notification_type as NotificationType,
          );
          await notify({
            title,
            body: `Assessment #${notification.assessment_id}`,
          });

          // Mark as sent to avoid retrying
          await invoke('db_notification_mark_sent', { notificationId: notification.id });
        }

        // Space out notifications by 100ms to prevent batch sending
        if (i < dueNotifications.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      logger.error(
        'notificationService',
        'checkAndSendDueNotifications',
        'Failed to check and send notifications',
        { error },
      );
    }
  }

  /**
   * Send a notification and mark it as sent
   */
  private async sendNotification(
    notification: Notification,
    assessment: Assessment,
  ): Promise<void> {
    try {
      const title = this.getNotificationTitle(notification.notification_type);
      const body = this.getNotificationBody(notification.notification_type, assessment);

      await notify({
        title,
        body,
        sound: notification.notification_type === 'overdue' ? 'default' : undefined,
      });

      // Mark as sent immediately after sending
      await invoke('db_notification_mark_sent', { notificationId: notification.id });

      logger.info(
        'notificationService',
        'sendNotification',
        `Sent ${notification.notification_type} notification for assessment ${assessment.id}`,
      );
    } catch (error) {
      logger.error(
        'notificationService',
        'sendNotification',
        `Failed to send notification ${notification.id}`,
        { error },
      );
    }
  }

  /**
   * Get notification title based on type
   */
  private getNotificationTitle(type: NotificationType): string {
    switch (type) {
      case 'reminder_3days':
        return 'Assessment Reminder';
      case 'reminder_1day':
        return 'Assessment Due Tomorrow';
      case 'due_date':
        return 'Assessment Due Today';
      case 'overdue':
        return 'Assessment Overdue';
      default:
        return 'Assessment Notification';
    }
  }

  /**
   * Get notification body based on type and assessment
   */
  private getNotificationBody(type: NotificationType, assessment: Assessment): string {
    const title = assessment.title || 'Untitled Assessment';
    const subject = assessment.subject || 'Unknown Subject';

    switch (type) {
      case 'reminder_3days':
        return `${title} (${subject}) is due in 3 days!`;
      case 'reminder_1day':
        return `${title} (${subject}) is due tomorrow!`;
      case 'due_date':
        return `${title} (${subject}) is due today!`;
      case 'overdue':
        return `${title} (${subject}) is overdue!`;
      default:
        return `${title} (${subject})`;
    }
  }

  /**
   * Start the background notification checker
   */
  startBackgroundChecker(): void {
    if (this.isRunning) {
      logger.warn(
        'notificationService',
        'startBackgroundChecker',
        'Background checker is already running',
      );
      return;
    }

    this.isRunning = true;

    // Run initial check immediately
    this.checkAndSendDueNotifications().catch((error) => {
      logger.error(
        'notificationService',
        'startBackgroundChecker',
        'Initial notification check failed',
        { error },
      );
    });

    // Set up periodic checking
    this.checkInterval = setInterval(() => {
      this.checkAndSendDueNotifications().catch((error) => {
        logger.error(
          'notificationService',
          'startBackgroundChecker',
          'Periodic notification check failed',
          { error },
        );
      });
    }, this.CHECK_INTERVAL_MS);

    logger.info(
      'notificationService',
      'startBackgroundChecker',
      'Background notification checker started',
    );
  }

  /**
   * Stop the background notification checker
   */
  stopBackgroundChecker(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.isRunning = false;
      logger.info(
        'notificationService',
        'stopBackgroundChecker',
        'Background notification checker stopped',
      );
    }
  }

  /**
   * Get pending notifications
   */
  async getPendingNotifications(): Promise<Notification[]> {
    try {
      const now = Math.floor(Date.now() / 1000);
      return await invoke<Notification[]>('db_notification_get_due', { nowTimestamp: now });
    } catch (error) {
      logger.error(
        'notificationService',
        'getPendingNotifications',
        'Failed to get pending notifications',
        { error },
      );
      return [];
    }
  }

  /**
   * Cleanup old sent notifications
   */
  async cleanupOldNotifications(daysToKeep: number = 30): Promise<void> {
    try {
      await invoke('db_notification_cleanup_old', { daysToKeep });
      logger.info(
        'notificationService',
        'cleanupOldNotifications',
        `Cleaned up notifications older than ${daysToKeep} days`,
      );
    } catch (error) {
      logger.error(
        'notificationService',
        'cleanupOldNotifications',
        'Failed to cleanup old notifications',
        { error },
      );
    }
  }

  /**
   * Delete notifications for a specific assessment
   */
  async deleteNotificationsForAssessment(assessmentId: number): Promise<void> {
    try {
      await invoke('db_notification_delete_by_assessment', { assessmentId });
      logger.info(
        'notificationService',
        'deleteNotificationsForAssessment',
        `Deleted notifications for assessment ${assessmentId}`,
      );
    } catch (error) {
      logger.error(
        'notificationService',
        'deleteNotificationsForAssessment',
        `Failed to delete notifications for assessment ${assessmentId}`,
        { error },
      );
    }
  }

  /**
   * Migrate localStorage data to database (one-time migration)
   */
  async migrateLocalStorageData(): Promise<void> {
    try {
      // Check if migration already done
      const migrationKey = 'notification_migration_complete';
      const migrationDone = localStorage.getItem(migrationKey);

      if (migrationDone === 'true') {
        logger.debug(
          'notificationService',
          'migrateLocalStorageData',
          'Migration already completed',
        );
        return;
      }

      // Get old localStorage data
      const scheduledReminders = localStorage.getItem('scheduledAssessmentReminders');
      if (!scheduledReminders) {
        // No data to migrate
        localStorage.setItem(migrationKey, 'true');
        return;
      }

      try {
        const assessmentIds = JSON.parse(scheduledReminders) as number[];
        logger.info(
          'notificationService',
          'migrateLocalStorageData',
          `Migrating ${assessmentIds.length} scheduled reminders from localStorage`,
        );

        // The old system only scheduled 1-day reminders, but we can't recreate those exact times
        // So we'll just mark migration as complete and let the new system reschedule properly
        // when assessments are loaded

        // Clear old localStorage data
        localStorage.removeItem('scheduledAssessmentReminders');
        localStorage.setItem(migrationKey, 'true');

        logger.info(
          'notificationService',
          'migrateLocalStorageData',
          'Migration completed - old data cleared, new system will reschedule',
        );
      } catch (parseError) {
        logger.error(
          'notificationService',
          'migrateLocalStorageData',
          'Failed to parse localStorage data',
          { error: parseError },
        );
        // Still mark as migrated to avoid retrying
        localStorage.setItem(migrationKey, 'true');
      }
    } catch (error) {
      logger.error('notificationService', 'migrateLocalStorageData', 'Migration failed', { error });
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
