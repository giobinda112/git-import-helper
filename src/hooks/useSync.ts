import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { SyncData, FixtureSheetPayload, VesselOnSubsEntry, MetaSyncPayload } from '../types';

async function postPlainNoCors(webhookUrl: string, payload: unknown): Promise<void> {
  await fetch(webhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    body: JSON.stringify(payload),
  });
}

export function useSync(onDataReceived: (data: SyncData) => void) {
  const [webhookUrl, setWebhookUrl] = useLocalStorage<string>('ship-fixtures-webhook', '');
  const [showUrlPrompt, setShowUrlPrompt] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string>('');
  const [syncError, setSyncError] = useState<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!webhookUrl) {
      setShowUrlPrompt(true);
    }
  }, []);

  const pull = useCallback(async () => {
    if (!webhookUrl) return;

    setSyncing(true);
    setSyncError('');

    try {
      const response = await fetch(`${webhookUrl}?action=pull4`, {
        method: 'GET',
        mode: 'cors',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();

      if (!text || text.trim() === '') {
        console.log('[useSync] Empty response from server');
        setLastSync(new Date().toLocaleTimeString());
        return;
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch {
        console.log('[useSync] Failed to parse response:', text.substring(0, 100));
        throw new Error('Invalid JSON response');
      }

      const data = result?.data || result;
      if (data && typeof data === 'object') {
        try {
          onDataReceived(data as SyncData);
        } catch (callbackErr) {
          console.error('[useSync] onDataReceived failed:', callbackErr);
          setSyncError(callbackErr instanceof Error ? callbackErr.message : 'Failed to apply synced data');
        }
      }
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      console.log('[useSync] Pull error:', err);
      setSyncError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setSyncing(false);
    }
  }, [webhookUrl, onDataReceived]);

  /** Runs many fixture POSTs under a single spinner (sequential, same transport as single row). */
  const applyFixtureOps = useCallback(
    async (ops: { deleteIds: string[]; upsertRows: FixtureSheetPayload[] }) => {
      if (!webhookUrl) {
        setShowUrlPrompt(true);
        return;
      }
      if (ops.deleteIds.length === 0 && ops.upsertRows.length === 0) return;
      setSyncing(true);
      setSyncError('');
      try {
        for (const id of ops.deleteIds) {
          await postPlainNoCors(webhookUrl, { action: 'fixtureDelete4', id });
        }
        for (const row of ops.upsertRows) {
          await postPlainNoCors(webhookUrl, { action: 'rowUpsert4', row });
        }
        setLastSync(new Date().toLocaleTimeString());
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Fixture batch sync failed');
      } finally {
        setSyncing(false);
      }
    },
    [webhookUrl]
  );

  const upsertFixtureRow = useCallback(
    async (row: FixtureSheetPayload) => {
      await applyFixtureOps({ deleteIds: [], upsertRows: [row] });
    },
    [applyFixtureOps]
  );

  const deleteFixtureRow = useCallback(
    async (id: string) => {
      await applyFixtureOps({ deleteIds: [id], upsertRows: [] });
    },
    [applyFixtureOps]
  );

  const applySubsDeletes = useCallback(
    async (ids: string[]) => {
      if (!webhookUrl) {
        setShowUrlPrompt(true);
        return;
      }
      if (ids.length === 0) return;
      setSyncing(true);
      setSyncError('');
      try {
        for (const id of ids) {
          await postPlainNoCors(webhookUrl, { action: 'subsRowDelete4', id });
        }
        setLastSync(new Date().toLocaleTimeString());
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Subs delete batch failed');
      } finally {
        setSyncing(false);
      }
    },
    [webhookUrl]
  );

  const upsertSubsRow = useCallback(
    async (row: VesselOnSubsEntry) => {
      if (!webhookUrl) {
        setShowUrlPrompt(true);
        return;
      }
      setSyncing(true);
      setSyncError('');
      try {
        await postPlainNoCors(webhookUrl, { action: 'subsRowUpsert4', row });
        setLastSync(new Date().toLocaleTimeString());
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Subs row sync failed');
      } finally {
        setSyncing(false);
      }
    },
    [webhookUrl]
  );

  const deleteSubsRow = useCallback(
    async (id: string) => {
      if (!webhookUrl) {
        setShowUrlPrompt(true);
        return;
      }
      setSyncing(true);
      setSyncError('');
      try {
        await postPlainNoCors(webhookUrl, { action: 'subsRowDelete4', id });
        setLastSync(new Date().toLocaleTimeString());
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Subs delete failed');
      } finally {
        setSyncing(false);
      }
    },
    [webhookUrl]
  );

  const syncMeta = useCallback(
    async (data: MetaSyncPayload) => {
      if (!webhookUrl) {
        setShowUrlPrompt(true);
        return;
      }
      setSyncing(true);
      setSyncError('');
      try {
        await postPlainNoCors(webhookUrl, { action: 'metaSync4', data });
        setLastSync(new Date().toLocaleTimeString());
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Meta sync failed');
      } finally {
        setSyncing(false);
      }
    },
    [webhookUrl]
  );

  /** @deprecated Full-array fixture dump — prefer atomic rowUpsert4. Kept for emergency / legacy GAS. */
  const sync = useCallback(
    async (data: SyncData) => {
      if (!webhookUrl) {
        setShowUrlPrompt(true);
        return;
      }
      setSyncing(true);
      setSyncError('');
      try {
        await postPlainNoCors(webhookUrl, { action: 'sync4', data });
        setLastSync(new Date().toLocaleTimeString());
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Sync failed');
      } finally {
        setSyncing(false);
      }
    },
    [webhookUrl]
  );

  useEffect(() => {
    if (!webhookUrl) return;

    intervalRef.current = setInterval(() => {
      pull();
    }, 60000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [webhookUrl, pull]);

  function saveWebhookUrl(url: string) {
    setWebhookUrl(url);
    setShowUrlPrompt(false);
  }

  return {
    webhookUrl,
    showUrlPrompt,
    setShowUrlPrompt,
    saveWebhookUrl,
    sync,
    pull,
    upsertFixtureRow,
    deleteFixtureRow,
    applyFixtureOps,
    applySubsDeletes,
    upsertSubsRow,
    deleteSubsRow,
    syncMeta,
    syncing,
    lastSync,
    syncError,
    forceRefresh: pull,
  };
}
