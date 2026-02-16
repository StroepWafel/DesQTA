import { queueAll, queueDelete } from './idb';
import { flushSettingsQueue } from './settingsSync';
import { seqtaFetch } from '../../utils/netUtil';

export async function flushMessageDrafts(): Promise<void> {
  const items = await queueAll();
  for (const item of items) {
    if (item.type !== 'message_draft') continue;
    try {
      const payload = item.payload || {};
      const participants = (payload.recipients || []).map((r: any) =>
        r.staff ? { staff: true, id: r.id } : { student: true, id: r.id }
      );
      const res = await seqtaFetch('/seqta/student/save/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          subject: payload.subject,
          contents: payload.contents,
          participants,
          blind: !!payload.blind,
          files: payload.files || [],
        }
      });
      const json = typeof res === 'string' ? JSON.parse(res) : res;
      if (json && (json.status === '200' || json.status === 200)) {
        await queueDelete(item.id!);
      } else {
        // Stop on first failure to avoid spin
        break;
      }
    } catch {
      // Network/offline. Stop and retry later
      break;
    }
  }
}

export async function flushAll(): Promise<void> {
  let flushedCount = 0;
  
  // Check items before flushing
  const allItems = await queueAll();
  const settingsToFlush = allItems.filter((item) => item.type === 'settings_patch').length;
  const messagesToFlush = allItems.filter((item) => item.type === 'message_draft').length;
  
  // Flush settings queue
  await flushSettingsQueue();
  if (settingsToFlush > 0) {
    flushedCount += settingsToFlush;
  }
  
  // Flush message drafts
  await flushMessageDrafts();
  if (messagesToFlush > 0) {
    flushedCount += messagesToFlush;
  }
  
  // Show toast if items were flushed
  if (flushedCount > 0) {
    const { toastStore } = await import('../stores/toast');
    toastStore.success(`Synced ${flushedCount} offline ${flushedCount === 1 ? 'item' : 'items'}`);
  }
}

// Online handler moved to queueService - single coalesced handler


