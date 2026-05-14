import { useMemo, useState, useEffect } from 'react';
import type { Anagrafiche, DwtCategory, VesselOnSubsEntry } from '../types';
import { getDwtCategory } from '../types';
import { todayISO } from '../utils/helpers';
import { detectArea } from '../utils/areaMapper';
import { X, Download, Plus, Trash2, AlertTriangle } from 'lucide-react';

interface VesselOnSubsProps {
  anagrafiche: Anagrafiche;
  entries: VesselOnSubsEntry[];
  onChangeEntries: (entries: VesselOnSubsEntry[]) => void;
  onUpsertVesselMetadata: (vesselName: string, owner: string, dwt: string, yob: string) => void;
  onClose: () => void;
}

type GroupMode = 'dwt' | 'area' | 'date';

const DWT_ORDER: DwtCategory[] = ['AFRAMAX', 'SUEZMAX', 'VLCC'];

export default function VesselOnSubs({ anagrafiche, entries, onChangeEntries, onUpsertVesselMetadata, onClose }: VesselOnSubsProps) {
  const [groupMode, setGroupMode] = useState<GroupMode>('date');
  const [newVessel, setNewVessel] = useState('');
  const [newPort, setNewPort] = useState('');
  const [newOpenDate, setNewOpenDate] = useState('');
  const [editableText, setEditableText] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [vesselPopup, setVesselPopup] = useState<{ vessel: string; owner: string; dwt: string; yob: string } | null>(null);
  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    const cutoff = Date.now() - (72 * 60 * 60 * 1000);
    onChangeEntries(entries.filter(e => {
      const ts = new Date(e.dateAdded).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAddEntry() {
    const vessel = newVessel.trim().toUpperCase();
    const port = newPort.trim().toUpperCase();
    const openDate = newOpenDate.trim().toUpperCase();
    if (!vessel || !port || !openDate) return;

    void anagrafiche.vesselOwners.find(v => v.vesselName === vessel);
    void (detectArea(port.split('-')[0]?.trim() || port, anagrafiche.portMappings) || 'Other');
    const entry: VesselOnSubsEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      vessel,
      port,
      openDate,
      dateAdded: todayISO(),
    };
    onChangeEntries([entry, ...entries]);
    setNewVessel('');
    setNewPort('');
    setNewOpenDate('');
  }

  function handleRemoveEntry(id: string) {
    onChangeEntries(entries.filter(e => e.id !== id));
  }

  const groupedByDwt = useMemo(() => {
    const groups: Record<string, VesselOnSubsEntry[]> = { AFRAMAX: [], SUEZMAX: [], VLCC: [], OTHER: [] };
    for (const f of entries) {
      const dwt = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel)?.dwt || '';
      const cat = getDwtCategory(dwt) || 'OTHER';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    }
    return groups;
  }, [entries, anagrafiche.vesselOwners]);

  const groupedByArea = useMemo(() => {
    const groups: Record<string, VesselOnSubsEntry[]> = {};
    for (const f of entries) {
      const portStr = (f.port || '').toString();
      const area = detectArea(portStr.split('-')[0]?.trim() || portStr, anagrafiche.portMappings) || 'UNKNOWN';
      if (!groups[area]) groups[area] = [];
      groups[area].push(f);
    }
    return groups;
  }, [entries, anagrafiche.portMappings]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, VesselOnSubsEntry[]> = {};
    for (const f of entries) {
      const date = (f.dateAdded || '').split('T')[0] || 'N/A';
      if (!groups[date]) groups[date] = [];
      groups[date].push(f);
    }
    return groups;
  }, [entries]);

  function generateSubsExport(): string {
    // Always read directly from entries state to ensure latest data
    const currentEntries = entries;
    const lines: string[] = [];
    lines.push(`VESSEL ON SUBS - ${new Date().toISOString().split('T')[0]}`);
    lines.push('='.repeat(80));
    lines.push('');

    if (currentEntries.length === 0) {
      lines.push('NO ENTRIES');
      return lines.join('\n');
    }

    if (groupMode === 'dwt') {
      const groups: Record<string, VesselOnSubsEntry[]> = { AFRAMAX: [], SUEZMAX: [], VLCC: [], OTHER: [] };
      for (const f of currentEntries) {
        const dwt = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel)?.dwt || '';
        const cat = getDwtCategory(dwt) || 'OTHER';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(f);
      }
      for (const cat of [...DWT_ORDER, 'OTHER']) {
        const group = groups[cat];
        if (!group || group.length === 0) continue;
        lines.push(`--- ${cat} ---`);
        lines.push('');
        lines.push(formatSubsRow(group));
        lines.push('');
      }
    } else if (groupMode === 'area') {
      const groups: Record<string, VesselOnSubsEntry[]> = {};
      for (const f of currentEntries) {
        const portStr = (f.port || '').toString();
        const area = detectArea(portStr.split('-')[0]?.trim() || portStr, anagrafiche.portMappings) || 'UNKNOWN';
        if (!groups[area]) groups[area] = [];
        groups[area].push(f);
      }
      const areas = Object.keys(groups).sort();
      for (const area of areas) {
        const group = groups[area];
        if (!group || group.length === 0) continue;
        lines.push(`--- ${area.toUpperCase()} ---`);
        lines.push('');
        lines.push(formatSubsRow(group));
        lines.push('');
      }
    } else {
      const groups: Record<string, VesselOnSubsEntry[]> = {};
      for (const f of currentEntries) {
        const date = (f.dateAdded || '').split('T')[0] || 'N/A';
        if (!groups[date]) groups[date] = [];
        groups[date].push(f);
      }
      const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
      for (const date of dates) {
        const group = groups[date];
        if (!group || group.length === 0) continue;
        lines.push(`--- ${date} ---`);
        lines.push('');
        lines.push(formatSubsRow(group));
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  function formatSubsRow(group: VesselOnSubsEntry[]): string {
    const headers = ['VESSEL', 'DWT', 'OWNER', 'PORT', 'OPEN DATE'];
    const widths = [20, 8, 16, 16, 12];
    const header = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
    const sep = widths.map(w => '-'.repeat(w)).join('  ');
    const rows = group.map(f => {
      const vo = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel);
      const vals = [f.vessel, vo?.dwt || '--', vo?.owner || '--', f.port, f.openDate];
      return vals.map((v, i) => (v || '--').padEnd(widths[i])).join('  ');
    });
    return [header, sep, ...rows].join('\n');
  }

  function handleExport() {
    const content = editableText || generateSubsExport();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vessel_on_subs_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleGenerate() {
    setEditableText(generateSubsExport());
    setShowPreview(true);
  }

  const modalBg = isDark ? 'bg-gray-900' : 'bg-white';
  const borderCls = isDark ? 'border-gray-700' : 'border-slate-200';
  const textAccent = isDark ? 'text-amber-500' : 'text-amber-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-slate-500';
  const textPrimary = isDark ? 'text-gray-200' : 'text-slate-700';
  const rowBg = isDark ? 'bg-gray-800/50' : 'bg-slate-50';
  const hdrBg = isDark ? 'bg-gray-800' : 'bg-slate-100';
  const inputCls = `${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none rounded-sm`;

  function renderGroup(entries: VesselOnSubsEntry[]) {
    return (
      <table className="w-full text-xs">
        <thead className={`sticky top-0 ${hdrBg}`}>
          <tr className={`${textMuted} border-b ${borderCls}`}>
            <th className="text-left px-2 py-1">VESSEL</th>
            <th className="text-left px-2 py-1 w-12">DWT</th>
            <th className="text-left px-2 py-1">OWNER</th>
            <th className="text-left px-2 py-1">PORT</th>
            <th className="text-left px-2 py-1">OPEN DATE</th>
            <th className="text-right px-2 py-1 w-8"></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(f => (
            <tr key={f.id} className={`border-b ${isDark ? 'border-gray-800' : 'border-slate-100'} ${rowBg}`}>
              <td className={`px-2 py-0.5 font-medium ${textPrimary}`}>
                <div className="flex items-center gap-1">
                  {f.vessel}
                  {(() => {
                    const vo = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel);
                    const missing = !vo || !vo.owner || !vo.dwt || !vo.yob;
                    return missing ? <button onClick={() => setVesselPopup({ vessel: f.vessel, owner: vo?.owner || '', dwt: vo?.dwt || '', yob: vo?.yob || '' })} className="text-yellow-500 hover:text-yellow-400"><AlertTriangle size={11} /></button> : null;
                  })()}
                </div>
              </td>
              <td className={`px-2 py-0.5 ${textMuted}`}>{anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel)?.dwt || '--'}</td>
              <td className={`px-2 py-0.5 ${textMuted}`}>{anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel)?.owner || '--'}</td>
              <td className={`px-2 py-0.5 ${textPrimary}`}>{f.port}</td>
              <td className={`px-2 py-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{f.openDate}</td>
              <td className="px-2 py-0.5 text-right">
                <button onClick={() => handleRemoveEntry(f.id)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'} transition-colors`}><Trash2 size={11} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className={`${modalBg} border ${isDark ? 'border-gray-600' : 'border-slate-200'} w-full max-w-5xl max-h-[85vh] flex flex-col rounded-lg`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${borderCls}`}>
          <h2 className={`font-semibold text-sm ${textAccent}`}>VESSEL ON SUBS</h2>
          <div className="flex items-center gap-3">
            <div className="flex gap-1">
              <button onClick={() => setGroupMode('date')} className={`px-3 py-1 text-[10px] font-semibold rounded-sm transition-colors ${groupMode === 'date' ? 'bg-amber-600 text-white' : `${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}`}>BY DATE</button>
              <button onClick={() => setGroupMode('dwt')} className={`px-3 py-1 text-[10px] font-semibold rounded-sm transition-colors ${groupMode === 'dwt' ? 'bg-amber-600 text-white' : `${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}`}>BY DWT</button>
              <button onClick={() => setGroupMode('area')} className={`px-3 py-1 text-[10px] font-semibold rounded-sm transition-colors ${groupMode === 'area' ? 'bg-amber-600 text-white' : `${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}`}>BY AREA</button>
            </div>
            <button onClick={handleGenerate} disabled={entries.length === 0} className={`${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-200 hover:bg-slate-300'} disabled:opacity-50 text-white px-3 py-1.5 text-xs font-semibold transition-colors rounded-sm`}>
              GENERATE
            </button>
            <button onClick={handleExport} disabled={!editableText} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors rounded-sm">
              <Download size={12} /> EXPORT .TXT
            </button>
            <button onClick={onClose} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}><X size={16} /></button>
          </div>
        </div>

        {/* Dedicated 3-field input bar */}
        <div className={`px-4 py-2 border-b ${borderCls} flex items-center gap-2`}>
          <div className="flex flex-col gap-0.5 flex-1">
            <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>VESSEL NAME</span>
            <input
              type="text"
              value={newVessel}
              onChange={e => setNewVessel(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
              placeholder="Vessel name..."
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-0.5 flex-1">
            <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>PORT</span>
            <input
              type="text"
              value={newPort}
              onChange={e => setNewPort(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
              placeholder="Port..."
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-0.5 w-24">
            <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>OPEN DATE</span>
            <input
              type="text"
              value={newOpenDate}
              onChange={e => setNewOpenDate(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleAddEntry()}
              placeholder="e.g. 12th"
              className={inputCls}
            />
          </div>
          <div className="flex items-end">
            <button onClick={handleAddEntry} disabled={!newVessel.trim() || !newPort.trim() || !newOpenDate.trim()} className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors rounded-sm flex items-center gap-1">
              <Plus size={12} /> ADD
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {showPreview ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className={`px-4 py-2 border-b ${borderCls} flex items-center justify-between`}>
                <span className={`${textMuted} text-[10px]`}>{entries.length} entries</span>
                <button onClick={() => setShowPreview(false)} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'} text-[10px]`}>BACK TO TABLE</button>
              </div>
              <textarea
                value={editableText}
                onChange={e => setEditableText(e.target.value)}
                placeholder="Click GENERATE to create preview, or type/paste your own content here..."
                className={`flex-1 p-4 text-[10px] font-mono leading-relaxed resize-none ${isDark ? 'text-gray-400 bg-gray-950' : 'text-slate-500 bg-slate-50'} focus:outline-none`}
              />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              {entries.length === 0 && (
                <div className={`${textMuted} text-center py-12 text-sm`}>NO VESSELS ON SUBS - Use the input bar above to add entries</div>
              )}

              {groupMode === 'date' && Object.entries(groupedByDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, group]) => (
                <div key={date} className="mb-6">
                  <h3 className={`font-semibold text-xs mb-2 ${textAccent}`}>--- {date} --- <span className={`${textMuted} font-normal`}>({group.length})</span></h3>
                  {renderGroup(group)}
                </div>
              ))}

              {groupMode === 'dwt' && DWT_ORDER.map(cat => {
                const group = groupedByDwt[cat] || [];
                if (group.length === 0) return null;
                return (
                  <div key={cat} className="mb-6">
                    <h3 className={`font-semibold text-xs mb-2 ${textAccent}`}>--- {cat} --- <span className={`${textMuted} font-normal`}>({group.length})</span></h3>
                    {renderGroup(group)}
                  </div>
                );
              })}

              {groupMode === 'dwt' && (groupedByDwt['OTHER'] || []).length > 0 && (
                <div className="mb-6">
                  <h3 className={`font-semibold text-xs mb-2 ${textAccent}`}>--- OTHER --- <span className={`${textMuted} font-normal`}>({groupedByDwt['OTHER'].length})</span></h3>
                  {renderGroup(groupedByDwt['OTHER'])}
                </div>
              )}

              {groupMode === 'area' && Object.entries(groupedByArea).sort(([a], [b]) => a.localeCompare(b)).map(([area, group]) => (
                <div key={area} className="mb-6">
                  <h3 className={`font-semibold text-xs mb-2 ${textAccent}`}>--- {area.toUpperCase()} --- <span className={`${textMuted} font-normal`}>({group.length})</span></h3>
                  {renderGroup(group)}
                </div>
              ))}
            </div>
          )}
        </div>
        {vesselPopup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
            <div className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border p-6 max-w-md w-full rounded-lg`}>
              <h3 className={`font-semibold text-sm mb-2 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>VESSEL METADATA</h3>
              <input value={vesselPopup.owner} onChange={e => setVesselPopup(prev => prev ? { ...prev, owner: e.target.value.toUpperCase() } : prev)} onKeyDown={e => e.key === 'Enter' && (onUpsertVesselMetadata(vesselPopup.vessel, vesselPopup.owner, vesselPopup.dwt, vesselPopup.yob), setVesselPopup(null))} placeholder="Owner" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs w-full mb-2 rounded`} autoFocus={!vesselPopup.owner} />
              <input value={vesselPopup.dwt} onChange={e => setVesselPopup(prev => prev ? { ...prev, dwt: e.target.value.replace(/[^0-9]/g, '') } : prev)} onKeyDown={e => e.key === 'Enter' && (onUpsertVesselMetadata(vesselPopup.vessel, vesselPopup.owner, vesselPopup.dwt, vesselPopup.yob), setVesselPopup(null))} placeholder="DWT" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs w-full mb-2 rounded`} autoFocus={!!vesselPopup.owner && !vesselPopup.dwt} />
              <input value={vesselPopup.yob} onChange={e => setVesselPopup(prev => prev ? { ...prev, yob: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) } : prev)} onKeyDown={e => e.key === 'Enter' && (onUpsertVesselMetadata(vesselPopup.vessel, vesselPopup.owner, vesselPopup.dwt, vesselPopup.yob), setVesselPopup(null))} placeholder="YOB" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs w-full mb-4 rounded`} autoFocus={!!vesselPopup.owner && !!vesselPopup.dwt && !vesselPopup.yob} />
              <div className="flex gap-2">
                <button onClick={() => { onUpsertVesselMetadata(vesselPopup.vessel, vesselPopup.owner, vesselPopup.dwt, vesselPopup.yob); setVesselPopup(null); }} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs rounded-sm">SAVE</button>
                <button onClick={() => setVesselPopup(null)} className={`${isDark ? 'text-gray-500 border-gray-600' : 'text-slate-500 border-slate-200'} px-4 py-2 text-xs border rounded-sm`}>CANCEL</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
