import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Fixture, Anagrafiche, Area, SyncData, FieldEdit, VesselOnSubsEntry, PortMapping } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useTheme } from './hooks/useTheme';
import { useSync } from './hooks/useSync';
import { getDefaultPortMappings, detectArea, normalizePortKey, canonicalArea } from './utils/areaMapper';
import { normalizeMasterPortsList, normalizeMasterVesselsList, pickSafeAnagraficheFromServer } from './utils/sheetsSyncNormalize';
import { fixturesForGoogleSheetSync, normalizeFixtureAfterPull } from './utils/fixtureSheetNormalize';
import { uniqueSorted, generateId, todayISO } from './utils/helpers';
import QuickAdd from './components/QuickAdd';
import FixturesTable from './components/FixturesTable';
import Sidebar from './components/Sidebar';
import DataManagement from './components/DataManagement';
import ExportModal from './components/ExportModal';
import EditFixtureModal from './components/EditFixtureModal';
import ArchiveModal from './components/ArchiveModal';
import BulkInsertModal from './components/BulkInsertModal';
import WebhookPrompt from './components/WebhookPrompt';
import VesselOnSubs from './components/VesselOnSubs';
import SettingsModal from './components/SettingsModal';
import { Database, Download, Anchor, Archive, Sun, Moon, Upload, RefreshCw, Info, Ship, Settings } from 'lucide-react';

const EMPTY_ANAGRAFICHE: Anagrafiche = {
  charterers: [],
  vessels: [],
  loadPorts: [],
  dischargePorts: [],
  grades: [],
  portMappings: getDefaultPortMappings(),
  vesselOwners: [],
};

/** Ensures every list field is an array after merging Sheets payloads (partial objects may overwrite with undefined). */
function normalizeAnagraficheShape(prev: Anagrafiche, incoming?: Partial<Anagrafiche>): Anagrafiche {
  const merged = { ...prev, ...incoming };
  const list = (v: unknown, fallback: unknown[]) => (Array.isArray(v) ? v : fallback);
  return {
    ...merged,
    charterers: list(merged.charterers, prev.charterers || []),
    vessels: list(merged.vessels, prev.vessels || []),
    loadPorts: list(merged.loadPorts, prev.loadPorts || []),
    dischargePorts: list(merged.dischargePorts, prev.dischargePorts || []),
    grades: list(merged.grades, prev.grades || []),
    portMappings: list(merged.portMappings, prev.portMappings?.length ? prev.portMappings : getDefaultPortMappings()),
    vesselOwners: list(merged.vesselOwners, prev.vesselOwners || []),
  };
}

function LegendPopup({ onClose, isDark }: { onClose: () => void; isDark: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-end p-4 z-[70]" onClick={onClose}>
      <div className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border rounded-lg p-4 w-64 shadow-xl`} onClick={e => e.stopPropagation()}>
        <h3 className={`font-semibold text-xs mb-3 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>COLOR LEGEND</h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded shrink-0 ${isDark ? 'bg-blue-600/60 border-blue-400' : 'bg-blue-200 border-blue-400'} border-2`} />
            <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>Blue = Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded shrink-0 ${isDark ? 'bg-yellow-500/50 border-yellow-400' : 'bg-yellow-200 border-yellow-400'} border-2`} />
            <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>Yellow = Yesterday</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-5 h-5 rounded shrink-0 ${isDark ? 'bg-green-600/50 border-green-400' : 'bg-green-200 border-green-400'} border-2`} />
            <span className={isDark ? 'text-gray-300' : 'text-slate-600'}>Green = Updated</span>
          </div>
          <p className={`text-[10px] mt-2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>Modified cells are underlined in green.</p>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [fixtures, setFixtures] = useLocalStorage<Fixture[]>('ship-fixtures', []);
  const [anagrafiche, setAnagrafiche] = useLocalStorage<Anagrafiche>('ship-anagrafiche', EMPTY_ANAGRAFICHE);
  const [vesselsOnSubs, setVesselsOnSubs] = useLocalStorage<VesselOnSubsEntry[]>('ship-vessels-on-subs', []);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDataMgmt, setShowDataMgmt] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showBulkInsert, setShowBulkInsert] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showVesselOnSubs, setShowVesselOnSubs] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFixture, setEditingFixture] = useState<Fixture | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { theme, toggleTheme } = useTheme();

  const handleSyncData = useCallback((data: SyncData) => {
    try {
      if (data.fixtures !== undefined && data.fixtures !== null) {
        const rows = Array.isArray(data.fixtures) ? data.fixtures : [];
        const normalized = rows.map(f => normalizeFixtureAfterPull(f as unknown as Record<string, unknown>));
        setFixtures(prev => {
          const local = prev || [];
          // Protection: never wipe local with empty payload (likely fetch/parse failure or sheet still recalculating)
          if (normalized.length === 0 && local.length > 0) {
            console.log('[sync] Empty fixtures from server — keeping local data');
            return local;
          }
          // Merge: keep any local row not present on server (newly POSTed rows the sheet has not yet echoed back)
          const serverIds = new Set(normalized.map(f => f.id));
          const localOnly = local.filter(f => !serverIds.has(f.id));
          return [...localOnly, ...normalized];
        });
      }
      if (data.masterVessels != null || data.masterPorts != null || data.anagrafiche) {
        setAnagrafiche(prev => {
          const merged = normalizeAnagraficheShape(prev, pickSafeAnagraficheFromServer(data.anagrafiche));
          let vesselOwnersNorm =
            data.masterVessels != null ? normalizeMasterVesselsList(data.masterVessels) : merged.vesselOwners;
          /** Empty master list from Sheet often means read/map failed — do not wipe local (next push would erase Sheet). */
          if (data.masterVessels != null && vesselOwnersNorm.length === 0 && merged.vesselOwners.length > 0) {
            vesselOwnersNorm = merged.vesselOwners;
          }
          let portMappingsNorm =
            data.masterPorts != null ? normalizeMasterPortsList(data.masterPorts) : merged.portMappings;
          if (data.masterPorts != null && portMappingsNorm.length === 0 && merged.portMappings.length > 0) {
            portMappingsNorm = merged.portMappings;
          }
          return {
            ...merged,
            vesselOwners: vesselOwnersNorm,
            portMappings: portMappingsNorm,
          };
        });
      }
      if (data.vesselsOnSubs !== undefined && data.vesselsOnSubs !== null) {
        const rawList = Array.isArray(data.vesselsOnSubs) ? data.vesselsOnSubs : [];
        // Strict mapping to schema: id|dateAdded|vessel|owner|dwt|yob|position|openDate|comments|archived
        const next: VesselOnSubsEntry[] = rawList
          .map((r: unknown) => {
            const o = (r ?? {}) as Record<string, unknown>;
            const archived = o.archived === true || String(o.archived ?? '').toLowerCase() === 'true';
            if (archived) return null;
            const vessel = String(o.vessel ?? '').trim().toUpperCase();
            if (!vessel) return null;
            const position = String(o.position ?? (o as Record<string, unknown>).port ?? '').trim().toUpperCase();
            return {
              id: String(o.id ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
              vessel,
              port: position,
              openDate: String(o.openDate ?? '').trim(),
              dateAdded: String(o.dateAdded ?? '').trim(),
            } as VesselOnSubsEntry;
          })
          .filter((x): x is VesselOnSubsEntry => x !== null);
        setVesselsOnSubs(prev => (next.length === 0 && (prev || []).length > 0 ? prev : next));
      }
    } catch (e) {
      console.error('[App] handleSyncData failed:', e);
    }
  }, [setFixtures, setAnagrafiche, setVesselsOnSubs]);

  const { webhookUrl, showUrlPrompt, setShowUrlPrompt, saveWebhookUrl, sync, pull, forceRefresh, syncing, lastSync, syncError } = useSync(handleSyncData);

  /** After first pull, allow auto-push so we do not overwrite Sheet with stale local data before load. */
  const [sheetReady, setSheetReady] = useState(false);

  useEffect(() => {
    if (!webhookUrl) {
      setSheetReady(false);
      return;
    }
    setSheetReady(false);
    let cancelled = false;
    void pull().finally(() => {
      if (!cancelled) setSheetReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [webhookUrl, pull]);

  const updateAnagrafiche = useCallback((newAnagrafiche: Anagrafiche) => {
    setAnagrafiche(newAnagrafiche);
  }, [setAnagrafiche]);

  const fixturesWithDynamicArea = useMemo(() => {
    return (fixtures || []).map(f => {
      const firstLoadPort = f.loadPort?.split('-')[0]?.trim() || '';
      const dynamicArea = detectArea(firstLoadPort, anagrafiche?.portMappings || []);
      const resolved = dynamicArea || f.area || 'Other';
      return { ...f, area: canonicalArea(resolved) };
    });
  }, [fixtures, anagrafiche?.portMappings]);

  const handleSyncPush = useCallback(() => {
    const portsOut = (anagrafiche.portMappings || []).map(pm => ({
      portName: String(pm.portName || '').trim(),
      area: String(pm.area || 'Other').trim(),
      'Port name': String(pm.portName || '').trim(),
      Area: String(pm.area || 'Other').trim(),
    }));
    sync({
      fixtures: fixturesForGoogleSheetSync(fixturesWithDynamicArea, anagrafiche.vesselOwners || []),
      anagrafiche,
      vesselsOnSubs: vesselsOnSubs || [],
      masterVessels: anagrafiche.vesselOwners || [],
      masterPorts: portsOut as unknown as PortMapping[],
    });
  }, [sync, fixturesWithDynamicArea, anagrafiche, vesselsOnSubs]);

  /** App → Sheet: push soon after any local change (~instant; debounced to batch rapid edits). */
  useEffect(() => {
    if (!webhookUrl || !sheetReady) return;
    const id = window.setTimeout(() => handleSyncPush(), 350);
    return () => window.clearTimeout(id);
  }, [webhookUrl, sheetReady, fixturesWithDynamicArea, anagrafiche, vesselsOnSubs, handleSyncPush]);

  function updateAnagraficheFromFixture(fixture: Fixture) {
    setAnagrafiche(prev => {
      const next = { ...prev };
      if (fixture.charterers && !prev.charterers.includes(fixture.charterers)) next.charterers = uniqueSorted([...prev.charterers, fixture.charterers]);
      if (fixture.vessel && !prev.vessels.includes(fixture.vessel)) next.vessels = uniqueSorted([...prev.vessels, fixture.vessel]);
      if (fixture.grade && !prev.grades.includes(fixture.grade)) next.grades = uniqueSorted([...prev.grades, fixture.grade]);
      if (fixture.loadPort) {
        const ports = fixture.loadPort.split('-').map(p => p.trim().toUpperCase()).filter(Boolean);
        for (const port of ports) {
          if (port && !next.loadPorts.includes(port)) next.loadPorts = uniqueSorted([...next.loadPorts, port]);
        }
      }
      if (fixture.dischargePort) {
        const ports = fixture.dischargePort.split('-').map(p => p.trim().toUpperCase()).filter(Boolean);
        for (const port of ports) {
          if (port && !next.dischargePorts.includes(port)) next.dischargePorts = uniqueSorted([...next.dischargePorts, port]);
        }
      }
      if (fixture.area !== 'Other' && fixture.loadPort) {
        const ports = fixture.loadPort.split('-').map(p => p.trim().toUpperCase()).filter(Boolean);
        for (const port of ports) {
          const existingMapping = next.portMappings.find(pm => pm.portName === port);
          if (!existingMapping) next.portMappings = [...next.portMappings, { portName: port, area: fixture.area }];
        }
      }
      return next;
    });
  }

  function addFixture(fixture: Fixture) {
    setFixtures(prev => [fixture, ...(prev || [])]);
    updateAnagraficheFromFixture(fixture);
  }

  function replaceFixture(oldId: string, newFixture: Fixture) {
    setFixtures(prev => [newFixture, ...(prev || []).filter(f => f.id !== oldId)]);
    updateAnagraficheFromFixture(newFixture);
  }

  function addVesselOwner(vesselName: string, owner: string, dwt: string, yob = '') {
    setAnagrafiche(prev => {
      const existing = prev.vesselOwners.find(vo => vo.vesselName === vesselName);
      if (existing) {
        if ((dwt && !existing.dwt) || (yob && !existing.yob) || (owner && !existing.owner)) {
          return {
            ...prev,
            vesselOwners: prev.vesselOwners.map(vo => vo.vesselName === vesselName ? {
              ...vo,
              owner: owner || vo.owner,
              dwt: dwt || vo.dwt,
              yob: yob || vo.yob || '',
            } : vo),
          };
        }
        return prev;
      }
      return { ...prev, vesselOwners: [...prev.vesselOwners, { vesselName, owner, dwt, yob }].sort((a, b) => a.vesselName.localeCompare(b.vesselName)) };
    });
  }

  function addCharterer(name: string) {
    setAnagrafiche(prev => {
      if (prev.charterers.includes(name)) return prev;
      return { ...prev, charterers: uniqueSorted([...prev.charterers, name]) };
    });
  }

  function addGrade(name: string) {
    setAnagrafiche(prev => {
      if (prev.grades.includes(name)) return prev;
      return { ...prev, grades: uniqueSorted([...prev.grades, name]) };
    });
  }

  function addPortMapping(portName: string, area: Area) {
    setAnagrafiche(prev => {
      const normalized = normalizePortKey(portName);
      const existingIdx = prev.portMappings.findIndex(pm => normalizePortKey(pm.portName) === normalized);
      if (existingIdx >= 0) {
        const updated = [...prev.portMappings];
        updated[existingIdx] = { ...updated[existingIdx], area };
        return { ...prev, portMappings: updated };
      }
      const next = !prev.loadPorts.includes(portName) ? { ...prev, loadPorts: uniqueSorted([...prev.loadPorts, portName]) } : prev;
      return { ...next, portMappings: [...next.portMappings, { portName, area }] };
    });
  }

  function upsertVesselMetadata(vesselName: string, owner: string, dwt: string, yob: string) {
    addVesselOwner(vesselName, owner, dwt, yob);
  }

  function upsertPortArea(portName: string, area: Area) {
    addPortMapping(portName, area);
  }

  function bulkAddFixtures(newFixtures: Fixture[]) {
    setFixtures(prev => [...newFixtures, ...(prev || [])]);
    for (const f of newFixtures) updateAnagraficheFromFixture(f);
  }

  function deleteFixture(id: string) {
    setFixtures(prev => (prev || []).filter(f => f.id !== id));
    setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  function togglePrivate(id: string) {
    setFixtures(prev => (prev || []).map(f => f.id === id ? { ...f, private: !f.private } : f));
  }

  function rolloverFixture(id: string) {
    const today = todayISO();
    setFixtures(prev => {
      const list = prev || [];
      const original = list.find(f => f.id === id);
      if (!original) return list;
      // Archive the original
      const archived = { ...original, archived: true };
      // Create a copy with today's date and an edit history entry so it shows green
      const edit: FieldEdit = { field: 'dateAdded', oldValue: original.dateAdded, newValue: today, editedAt: today };
      const rolled: Fixture = {
        ...original,
        id: generateId(),
        dateAdded: today,
        editHistory: [...original.editHistory, edit],
        archived: false,
      };
      return [rolled, ...list.map(f => f.id === id ? archived : f)];
    });
  }

  function saveEditedFixture(updated: Fixture) {
    const original = (fixtures || []).find(f => f.id === updated.id);
    if (original && original.status !== 'FAILED' && updated.status === 'FAILED') {
      const archived = { ...updated, archived: true };
      const copy: Fixture = {
        id: generateId(), dateAdded: todayISO(),
        charterers: updated.charterers, qty: updated.qty,
        loadPort: updated.loadPort, dischargePort: updated.dischargePort,
        laycan: updated.laycan, vessel: '', rate: '', status: '', grade: '',
        area: updated.area, dem: updated.dem,
        comments: `FAILED ${original.vessel}`,
        position: '', openDate: '', editHistory: [], archived: false, private: false,
      };
      setFixtures(prev => [copy, ...(prev || []).map(f => f.id === updated.id ? archived : f)]);
      updateAnagraficheFromFixture(copy);
    } else {
      setFixtures(prev => (prev || []).map(f => f.id === updated.id ? updated : f));
      updateAnagraficheFromFixture(updated);
    }
    setEditingFixture(null);
  }

  function inlineEditFixture(fixtureId: string, field: string, newValue: string) {
    // FAILED status via inline edit: lock current row + duplicate as fresh open cargo
    if (field === 'status' && newValue === 'FAILED') {
      const original = (fixtures || []).find(f => f.id === fixtureId);
      if (original && original.status !== 'FAILED') {
        const edit: FieldEdit = { field: 'status', oldValue: original.status, newValue: 'FAILED', editedAt: todayISO() };
        const failedRow: Fixture = { ...original, status: 'FAILED', editHistory: [...original.editHistory, edit] };
        const prevVessel = original.vessel || '';
        const appendedComment = original.comments
          ? `${original.comments} | FAILED ${prevVessel}`
          : `FAILED ${prevVessel}`;
        const copy: Fixture = {
          id: generateId(), dateAdded: todayISO(),
          charterers: original.charterers, qty: original.qty,
          loadPort: original.loadPort, dischargePort: original.dischargePort,
          laycan: original.laycan, vessel: '', rate: '', status: '', grade: original.grade,
          area: original.area, dem: original.dem,
          comments: appendedComment,
          position: '', openDate: '', editHistory: [], archived: false, private: false,
        };
        setFixtures(prev => [copy, ...(prev || []).map(f => f.id === fixtureId ? failedRow : f)]);
        return;
      }
    }
    setFixtures(prev => (prev || []).map(f => {
      if (f.id !== fixtureId) return f;
      const oldValue = (f as unknown as Record<string, unknown>)[field] as string;
      if (oldValue === newValue) return f;
      const edit: FieldEdit = { field, oldValue, newValue, editedAt: todayISO() };
      const updated = { ...f, [field]: newValue, editHistory: [...f.editHistory, edit] };
      // Sync to Master Data
      if (field === 'charterers' && newValue) addCharterer(newValue);
      if (field === 'grade' && newValue) addGrade(newValue);
      if (field === 'vessel' && newValue) {
        if (!anagrafiche.vessels.includes(newValue)) {
          setAnagrafiche(prev => ({ ...prev, vessels: uniqueSorted([...prev.vessels, newValue]) }));
        }
      }
      if (field === 'loadPort' && newValue) {
        const ports = newValue.split('-').map(p => p.trim()).filter(Boolean);
        for (const port of ports) {
          if (!anagrafiche.loadPorts.includes(port)) {
            setAnagrafiche(prev => ({ ...prev, loadPorts: uniqueSorted([...prev.loadPorts, port]) }));
          }
        }
        // Re-detect area from first port
        const firstPort = ports[0];
        const newArea = detectArea(firstPort, anagrafiche.portMappings);
        if (newArea && newArea !== updated.area) {
          updated.area = newArea;
        }
      }
      if (field === 'dischargePort' && newValue) {
        const ports = newValue.split('-').map(p => p.trim()).filter(Boolean);
        for (const port of ports) {
          if (!anagrafiche.dischargePorts.includes(port)) {
            setAnagrafiche(prev => ({ ...prev, dischargePorts: uniqueSorted([...prev.dischargePorts, port]) }));
          }
        }
      }
      return updated;
    }));
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function selectAll(ids: string[]) { setSelectedIds(new Set(ids)); }
  function deselectAll() { setSelectedIds(new Set()); }

  function handleRollover(ids: string[]) {
    const today = todayISO();
    setFixtures(prev => {
      const list = prev || [];
      const rolled = ids.map(id => {
        const original = list.find(f => f.id === id);
        if (!original) return null;
        return { ...original, id: generateId(), dateAdded: today, editHistory: [], archived: false, private: false } as Fixture;
      }).filter(Boolean) as Fixture[];
      return [...rolled, ...list];
    });
    setShowArchive(false);
  }

  const fixtureCounts: Record<string, number> = {};
  for (const f of (fixturesWithDynamicArea || [])) {
    if (!f.archived && f.status !== 'FAILED') fixtureCounts[f.area] = (fixtureCounts[f.area] || 0) + 1;
  }

  const isDark = theme === 'dark';
  const btnCls = isDark
    ? 'text-gray-400 hover:text-amber-500 border-gray-700 hover:border-amber-600'
    : 'text-slate-500 hover:text-amber-600 border-slate-200 hover:border-amber-500';

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-white text-slate-800'}`}>
      <header className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'} border-b px-4 py-2 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-3">
          <Anchor size={18} className="text-amber-500" />
          <h1 className={`font-bold text-sm tracking-widest ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>SHIP FIXTURES</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {webhookUrl && (
            <button onClick={handleSyncPush} disabled={syncing} className={`flex items-center gap-1 ${btnCls} px-2 py-1.5 text-xs border transition-colors`} title={syncError ? `Error: ${syncError}` : lastSync ? `Last sync: ${lastSync}` : 'Sync'}>
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {lastSync && <span className="text-[9px]">{lastSync}</span>}
            </button>
          )}
          <button onClick={forceRefresh} disabled={syncing || !webhookUrl} className={`flex items-center gap-1 ${btnCls} px-2 py-1.5 text-xs border transition-colors`} title="Refresh all sheets">
            <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          </button>
          <button onClick={toggleTheme} className={`${btnCls} px-2 py-1.5 text-xs border transition-colors`} title={isDark ? 'Light Mode' : 'Dark Mode'}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <button onClick={() => setShowSettings(true)} className={`${btnCls} px-2 py-1.5 text-xs border transition-colors`} title="Settings">
            <Settings size={14} />
          </button>
          <button onClick={() => setShowVesselOnSubs(true)} className={`flex items-center gap-1 ${btnCls} px-3 py-1.5 text-xs border transition-colors`}>
            <Ship size={12} /> VESSEL ON SUBS
          </button>
          <button onClick={() => setShowBulkInsert(true)} className={`flex items-center gap-1 ${btnCls} px-3 py-1.5 text-xs border transition-colors`}>
            <Upload size={12} /> BULK
          </button>
          <button onClick={() => setShowArchive(true)} className={`flex items-center gap-1 ${btnCls} px-3 py-1.5 text-xs border transition-colors`}>
            <Archive size={12} /> ARCHIVE
          </button>
          <button onClick={() => setShowDataMgmt(true)} className={`flex items-center gap-1 ${btnCls} px-3 py-1.5 text-xs border transition-colors`}>
            <Database size={12} /> DATA
          </button>
          <button onClick={() => setShowExport(true)} className={`flex items-center gap-1 ${btnCls} px-3 py-1.5 text-xs border transition-colors`}>
            <Download size={12} /> EXPORT
          </button>
        </div>
      </header>

      <QuickAdd
        anagrafiche={anagrafiche} fixtures={fixtures || []}
        onAdd={addFixture} onReplaceFixture={replaceFixture} onAddVesselOwner={addVesselOwner}
        onAddCharterer={addCharterer} onAddGrade={addGrade} onAddPortMapping={addPortMapping}
        searchQuery={searchQuery} onSearchChange={setSearchQuery}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar selectedArea={selectedArea} onSelectArea={setSelectedArea} fixtureCounts={fixtureCounts} totalFixtures={(fixturesWithDynamicArea || []).filter(f => !f.archived && f.status !== 'FAILED').length} />
        <FixturesTable
          fixtures={fixturesWithDynamicArea} anagrafiche={anagrafiche} selectedArea={selectedArea} searchQuery={searchQuery}
          onDelete={deleteFixture} onEdit={setEditingFixture} onInlineEdit={inlineEditFixture}
          onTogglePrivate={togglePrivate} onRollover={rolloverFixture}
          onUpsertVesselMetadata={upsertVesselMetadata}
          onUpsertPortArea={upsertPortArea}
          selectedIds={selectedIds} onToggleSelect={toggleSelect} onSelectAll={selectAll} onDeselectAll={deselectAll} maxWeeks={5}
        />
      </div>

      <footer className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'} border-t px-4 py-1 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-4 text-[10px]">
          <span className={isDark ? 'text-gray-600' : 'text-slate-400'}>TOTAL: <span className={isDark ? 'text-gray-400' : 'text-slate-600'}>{(fixtures || []).filter(f => !f.archived).length}</span></span>
          <span className="text-yellow-600">SUBS: <span className={isDark ? 'text-yellow-400' : 'text-yellow-600'}>{(fixturesWithDynamicArea || []).filter(f => f.status === 'SUBS' && !f.archived).length}</span></span>
          <span className="text-green-600">FIXED: <span className={isDark ? 'text-green-400' : 'text-green-600'}>{(fixturesWithDynamicArea || []).filter(f => f.status === 'FIXED' && !f.archived).length}</span></span>
          <span className="text-red-600">FAILED: <span className={isDark ? 'text-red-400' : 'text-red-600'}>{(fixturesWithDynamicArea || []).filter(f => f.status === 'FAILED').length}</span></span>
          <span className="text-blue-600">REPLACED: <span className={isDark ? 'text-blue-400' : 'text-blue-600'}>{(fixturesWithDynamicArea || []).filter(f => f.status === 'REPLACED' && !f.archived).length}</span></span>
          {selectedIds.size > 0 && <span className="text-amber-600">SELECTED: <span className={isDark ? 'text-amber-400' : 'text-amber-600'}>{selectedIds.size}</span></span>}
        </div>
        <div className="flex items-center gap-3">
          <span className={`${isDark ? 'text-gray-700' : 'text-slate-300'} text-[9px]`}>LAST 5 WEEKS</span>
          {webhookUrl && <span className={`${isDark ? 'text-green-800' : 'text-green-500'} text-[9px]`}>SYNC ON</span>}
          <button onClick={() => setShowLegend(true)} className={`${isDark ? 'text-gray-600 hover:text-gray-400' : 'text-slate-400 hover:text-slate-600'} transition-colors`} title="Color Legend">
            <Info size={14} />
          </button>
        </div>
      </footer>

      {showLegend && <LegendPopup onClose={() => setShowLegend(false)} isDark={isDark} />}
      {showUrlPrompt && <WebhookPrompt onSave={saveWebhookUrl} onSkip={() => setShowUrlPrompt(false)} />}
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} webhookUrl={webhookUrl} onSaveWebhookUrl={saveWebhookUrl} />
      {showDataMgmt && <DataManagement anagrafiche={anagrafiche} onUpdate={updateAnagrafiche} onClose={() => setShowDataMgmt(false)} />}
      {showExport && <ExportModal fixtures={fixturesWithDynamicArea} anagrafiche={anagrafiche} selectedIds={selectedIds} activeArea={selectedArea as Area | null} onClose={() => setShowExport(false)} />}
      {showArchive && <ArchiveModal fixtures={fixturesWithDynamicArea} anagrafiche={anagrafiche} onDelete={deleteFixture} onEdit={setEditingFixture} onRollover={handleRollover} onClose={() => setShowArchive(false)} />}
      {showBulkInsert && <BulkInsertModal anagrafiche={anagrafiche} onBulkAdd={bulkAddFixtures} onClose={() => setShowBulkInsert(false)} />}
      {editingFixture && <EditFixtureModal fixture={editingFixture} anagrafiche={anagrafiche} onSave={saveEditedFixture} onClose={() => setEditingFixture(null)} />}
      {showVesselOnSubs && <VesselOnSubs anagrafiche={anagrafiche} entries={vesselsOnSubs || []} onChangeEntries={setVesselsOnSubs} onUpsertVesselMetadata={upsertVesselMetadata} onClose={() => setShowVesselOnSubs(false)} />}
    </div>
  );
}

export default App;
