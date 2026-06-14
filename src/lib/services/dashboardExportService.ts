import { invoke } from '@tauri-apps/api/core';
import { save, open } from '@tauri-apps/plugin-dialog';
import type { WidgetLayout } from '../types/widgets';
import { widgetService } from './widgetService';
import { logger } from '../../utils/logger';

export interface DashboardExportPayload {
  format: 'DQDash';
  format_version: 1;
  exported_at: string;
  exported_by: string;
  name: string;
  description?: string;
  layout: WidgetLayout;
}

export const dashboardExportService = {
  async exportCurrentLayout(name: string, description?: string): Promise<boolean> {
    try {
      const layout = await widgetService.loadLayout();
      const payload: DashboardExportPayload = {
        format: 'DQDash',
        format_version: 1,
        exported_at: new Date().toISOString(),
        exported_by: 'DesQTA',
        name,
        description,
        layout,
      };

      const safeName = name.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') || 'dashboard';
      const filePath = await save({
        filters: [{ name: 'DesQTA Dashboard', extensions: ['DQDash'] }],
        defaultPath: `${safeName}.DQDash`,
      });

      if (!filePath) return false;

      await invoke('export_dashboard_dqdash', { filePath, payload });
      return true;
    } catch (e) {
      logger.error('dashboardExportService', 'exportCurrentLayout', `Export failed: ${e}`, {
        error: e,
      });
      throw e;
    }
  },

  async importLayoutFile(): Promise<WidgetLayout | null> {
    try {
      const filePath = await open({
        filters: [{ name: 'DesQTA Dashboard', extensions: ['DQDash', 'dqdash'] }],
        multiple: false,
      });

      if (!filePath || Array.isArray(filePath)) return null;

      const payload = await invoke<DashboardExportPayload>('import_dashboard_dqdash', {
        filePath,
      });

      if (!payload?.layout?.widgets) {
        throw new Error('Invalid dashboard file');
      }

      return payload.layout;
    } catch (e) {
      logger.error('dashboardExportService', 'importLayoutFile', `Import failed: ${e}`, {
        error: e,
      });
      throw e;
    }
  },

  async applyImportedLayout(layout: WidgetLayout): Promise<void> {
    await widgetService.saveLayout({
      ...layout,
      lastModified: new Date(),
    });
  },

  /** Dev: pick a .DQDash file and write pretty JSON beside it (same folder, .json extension). */
  async extractDqDashToJson(): Promise<string | null> {
    try {
      const filePath = await open({
        filters: [{ name: 'DesQTA Dashboard', extensions: ['DQDash', 'dqdash'] }],
        multiple: false,
      });

      if (!filePath || Array.isArray(filePath)) return null;

      const outputPath = await invoke<string>('extract_dqdash_to_json', { filePath });
      return outputPath;
    } catch (e) {
      logger.error('dashboardExportService', 'extractDqDashToJson', `Extract failed: ${e}`, {
        error: e,
      });
      throw e;
    }
  },
};
