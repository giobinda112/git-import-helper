import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocalStorage } from './useLocalStorage';
import type { SyncData } from '../types';

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

  const sync = useCallback(async (data: SyncData) => {
    if (!webhookUrl) {
      setShowUrlPrompt(true);
      return;
    }

    setSyncing(true);
    setSyncError('');

    try {
      /**
       * Google Apps Script Web Apps do not answer CORS preflight for POST + application/json,
       * so the browser blocks mode:cors from localhost/production. no-cors + text/plain avoids
       * preflight; the body still reaches doPost as postData.contents (JSON string).
       * We cannot read success/error from the response (opaque) — check Apps Script Executions if needed.
       */
      await fetch(webhookUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action: 'sync4', data }),
      });
      setLastSync(new Date().toLocaleTimeString());
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [webhookUrl, onDataReceived]);

  const pull = useCallback(async () => {
    if (!webhookUrl) return;

    setSyncing(true);
    setSyncError('');

    try {
      // GET requests - use cors mode to read response, GAS should return proper JSON
      const response = await fetch(`${webhookUrl}?action=pull4`, {
        method: 'GET',
        mode: 'cors',
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const text = await response.text();
      
      // Handle empty or invalid responses gracefully
      if (!text || text.trim() === '') {
        console.log('[v0] Empty response from server');
        setLastSync(new Date().toLocaleTimeString());
        return;
      }

      let result;
      try {
        result = JSON.parse(text);
      } catch (parseErr) {
        console.log('[v0] Failed to parse response:', text.substring(0, 100));
        throw new Error('Invalid JSON response');
      }

      // Handle result safely - could be { data: {...} } or just the data directly
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
      console.log('[v0] Pull error:', err);
      setSyncError(err instanceof Error ? err.message : 'Pull failed');
    } finally {
      setSyncing(false);
    }
  }, [webhookUrl, onDataReceived]);

  /** Pull from Sheet (sheet → app). Push is immediate/debounced from App. */
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
    syncing,
    lastSync,
    syncError,
    forceRefresh: pull,
  };
}
