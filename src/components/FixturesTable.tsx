import { useState, useMemo, useRef, useEffect } from 'react';
import type { Fixture, Anagrafiche, Area } from '../types';
import { getISOWeek, formatDate, displayLaycan } from '../utils/laycanParser';
import { ALL_AREAS, normalizePortKey } from '../utils/areaMapper';
import { matchesSearch } from '../utils/helpers';
import { Trash2, CreditCard as Edit3, ArrowUp, ArrowDown, Skull, CornerUpLeft, AlertTriangle } from 'lucide-react';

interface FixturesTableProps {
  fixtures: Fixture[];
  anagrafiche: Anagrafiche;
  selectedArea: string | null;
  searchQuery: string;
  onDelete: (id: string) => void;
  onEdit: (fixture: Fixture) => void;
  onInlineEdit: (fixtureId: string, field: string, newValue: string) => void;
  onTogglePrivate: (id: string) => void;
  onRollover: (id: string) => void;
  onUpsertVesselMetadata: (vesselName: string, owner: string, dwt: string, yob: string) => void;
  onUpsertPortArea: (portName: string, area: Area) => void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onDeselectAll: () => void;
  maxWeeks?: number;
}

type SortField = 'dateAdded' | 'charterers' | 'qty' | 'loadPort' | 'dischargePort' | 'laycan' | 'vessel' | 'rate' | 'status' | 'grade' | 'area' | 'dem' | 'comments';
type SortDir = 'asc' | 'desc';

const STATUS_BORDER: Record<string, string> = {
  SUBS: 'border-l-yellow-500', FIXED: 'border-l-green-500', FAILED: 'border-l-red-500', REPLACED: 'border-l-blue-500',
};
const STATUS_TEXT_DARK: Record<string, string> = {
  SUBS: 'text-yellow-400', FIXED: 'text-green-400', FAILED: 'text-red-400', REPLACED: 'text-blue-400',
};
const STATUS_TEXT_LIGHT: Record<string, string> = {
  SUBS: 'text-yellow-700', FIXED: 'text-green-700', FAILED: 'text-red-700', REPLACED: 'text-blue-700',
};

type DateCat = 'today' | 'today-rolled' | 'yesterday' | 'yesterday-modified' | null;

function getDateCategory(fixture: Fixture): DateCat {
  const da = fixture.dateAdded?.trim();
  if (!da || !/^\d{4}-\d{2}-\d{2}$/.test(da)) return null;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (da === today) {
    // Check if this was rolled over (has a dateAdded edit today)
    const rolledOver = fixture.editHistory.some(e => e.field === 'dateAdded' && e.editedAt === today);
    if (rolledOver) return 'today-rolled';
    return 'today';
  }
  if (da === yesterday) {
    const modifiedToday = fixture.editHistory.some(e => e.editedAt === today);
    if (modifiedToday) return 'yesterday-modified';
    return 'yesterday';
  }
  return null;
}

function getRowBg(cat: DateCat, isDark: boolean): string {
  if (isDark) {
    if (cat === 'today') return 'bg-blue-700/40';
    if (cat === 'today-rolled') return 'bg-green-600/40';
    if (cat === 'yesterday') return 'bg-yellow-600/30';
    if (cat === 'yesterday-modified') return 'bg-green-600/40';
  } else {
    if (cat === 'today') return 'bg-blue-200/60';
    if (cat === 'today-rolled') return 'bg-green-200/60';
    if (cat === 'yesterday') return 'bg-yellow-200/50';
    if (cat === 'yesterday-modified') return 'bg-green-200/60';
  }
  return '';
}

function getRowTextOverride(cat: DateCat, isDark: boolean): string {
  if (cat === 'today-rolled' || cat === 'yesterday-modified') return isDark ? 'text-green-300' : 'text-green-700';
  return '';
}

function isFieldModifiedToday(fixture: Fixture, field: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return fixture.editHistory.some(e => e.field === field && e.editedAt === today);
}

const INLINE_FIELDS = ['charterers', 'qty', 'grade', 'loadPort', 'dischargePort', 'laycan', 'vessel', 'rate', 'status', 'dem', 'comments'];

export default function FixturesTable({
  fixtures, anagrafiche, selectedArea, searchQuery, onDelete, onEdit, onInlineEdit, onTogglePrivate, onRollover,
  onUpsertVesselMetadata, onUpsertPortArea,
  selectedIds, onToggleSelect, onSelectAll, onDeselectAll, maxWeeks,
}: FixturesTableProps) {
  const [sortField, setSortField] = useState<SortField>('dateAdded');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [inlineEdit, setInlineEdit] = useState<{ fixtureId: string; field: string; value: string } | null>(null);
  const [vesselPopup, setVesselPopup] = useState<{ vessel: string; owner: string; dwt: string; yob: string } | null>(null);
  const [portPopup, setPortPopup] = useState<{ port: string; area: Area } | null>(null);
  const editRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => { if (inlineEdit && editRef.current) editRef.current.focus(); }, [inlineEdit]);

  let filtered = fixtures.filter(f => !f.archived);
  // Hide FAILED rows from main view; remain accessible via search and archive.
  if (!searchQuery) filtered = filtered.filter(f => f.status !== 'FAILED');
  if (selectedArea) filtered = filtered.filter(f => f.area === selectedArea);
  if (searchQuery) {
    const q = searchQuery;
    filtered = filtered.filter(f => {
      const owner = anagrafiche.vesselOwners.find(vo => vo.vesselName === f.vessel)?.owner || '';
      return matchesSearch(f.dateAdded, q) || matchesSearch(f.laycan, q) || matchesSearch(f.charterers, q) ||
        matchesSearch(f.loadPort, q) || matchesSearch(f.dischargePort, q) || matchesSearch(f.vessel, q) ||
        matchesSearch(f.rate, q) || matchesSearch(f.grade, q) || matchesSearch(f.status, q) ||
        matchesSearch(owner, q) || matchesSearch(f.dem, q) || matchesSearch(f.comments, q);
    });
  }
  if (maxWeeks) {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - maxWeeks * 7);
    filtered = filtered.filter(f => f.dateAdded >= cutoff.toISOString().split('T')[0]);
  }

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField] || ''; const bVal = b[sortField] || '';
      return sortDir === 'asc' ? aVal.localeCompare(bVal, undefined, { sensitivity: 'base' }) : bVal.localeCompare(aVal, undefined, { sensitivity: 'base' });
    });
  }, [filtered, sortField, sortDir]);

  const allFilteredIds = sorted.map(f => f.id);
  const allSelected = sorted.length > 0 && sorted.every(f => selectedIds.has(f.id));

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUp size={8} className="ml-0.5 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp size={8} className="ml-0.5 text-amber-500" /> : <ArrowDown size={8} className="ml-0.5 text-amber-500" />;
  }

  const showAreaCol = !selectedArea;
  const columns: { field: SortField; label: string; width: string }[] = [
    { field: 'dateAdded', label: 'DATE', width: 'w-[72px]' },
    { field: 'charterers', label: 'CHARTERERS', width: 'w-[100px]' },
    { field: 'qty', label: 'QTY', width: 'w-[44px]' },
    { field: 'grade', label: 'GRADE', width: 'w-[72px]' },
    { field: 'loadPort', label: 'LOAD PORT', width: 'w-[100px]' },
    { field: 'dischargePort', label: 'DISCH PORT', width: 'w-[100px]' },
    { field: 'laycan', label: 'LAYCAN', width: 'w-[88px]' },
    { field: 'vessel', label: 'VESSEL', width: 'w-[100px]' },
    { field: 'rate', label: 'RATE', width: 'w-[72px]' },
    { field: 'status', label: 'STATUS', width: 'w-[56px]' },
    { field: 'dem', label: 'DEM', width: 'w-[56px]' },
    { field: 'comments', label: 'COMMENTS', width: 'w-[120px]' },
    ...(showAreaCol ? [{ field: 'area' as SortField, label: 'AREA', width: 'w-[56px]' }] : []),
  ];

  const grouped = groupByWeek(sorted);

  function startInlineEdit(fixtureId: string, field: string, currentValue: string) {
    if (!INLINE_FIELDS.includes(field)) return;
    setInlineEdit({ fixtureId, field, value: currentValue === '--' ? '' : currentValue });
  }

  function confirmInlineEdit() {
    if (!inlineEdit) return;
    let val = inlineEdit.value.toUpperCase();
    if (inlineEdit.field === 'qty') val = inlineEdit.value.replace(/[^0-9]/g, '');
    if (inlineEdit.field === 'grade') val = inlineEdit.value.replace(/[^A-Z\s]/gi, '').toUpperCase();
    onInlineEdit(inlineEdit.fixtureId, inlineEdit.field, val);
    setInlineEdit(null);
  }

  function cancelInlineEdit() { setInlineEdit(null); }

  function handleTabNext(fixtureId: string, currentField: string) {
    if (!inlineEdit) return;
    let val = inlineEdit.value.toUpperCase();
    if (inlineEdit.field === 'qty') val = inlineEdit.value.replace(/[^0-9]/g, '');
    if (inlineEdit.field === 'grade') val = inlineEdit.value.replace(/[^A-Z\s]/gi, '').toUpperCase();
    onInlineEdit(inlineEdit.fixtureId, inlineEdit.field, val);
    const currentIdx = INLINE_FIELDS.indexOf(currentField);
    if (currentIdx < INLINE_FIELDS.length - 1) {
      const nextField = INLINE_FIELDS[currentIdx + 1];
      const fixture = fixtures.find(f => f.id === fixtureId);
      if (fixture) {
        const nextVal = (fixture as unknown as Record<string, string>)[nextField] || '';
        setInlineEdit({ fixtureId, field: nextField, value: nextVal });
      }
    } else { setInlineEdit(null); }
  }

  function cellCls(f: Fixture, field: string, base: string): string {
    const modified = isFieldModifiedToday(f, field);
    const underline = modified ? 'underline decoration-green-500 decoration-2 underline-offset-2' : '';
    return `${base} ${underline}`;
  }

  const hdrBg = isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-slate-100 border-slate-200';
  const hdrText = isDark ? 'text-amber-500' : 'text-amber-600';
  const hdrSub = isDark ? 'text-gray-500' : 'text-slate-400';
  const thCls = isDark ? 'text-gray-500 border-gray-800' : 'text-slate-400 border-slate-200';
  const selBg = isDark ? 'bg-amber-900/20' : 'bg-amber-50';
  const hoverBg = isDark ? 'hover:bg-gray-800/30' : 'hover:bg-slate-50';
  const barBg = isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-slate-50 border-slate-200';
  const barText = isDark ? 'text-gray-500' : 'text-slate-400';
  const inputCls = `${isDark ? 'bg-gray-800 border-amber-500 text-gray-100' : 'bg-white border-amber-500 text-slate-800'} border px-1 py-0 text-xs focus:outline-none rounded-sm w-full`;

  function renderCell(f: Fixture, field: string, displayVal: string, baseCls: string) {
    const isEditing = inlineEdit?.fixtureId === f.id && inlineEdit?.field === field;
    const canEdit = INLINE_FIELDS.includes(field);

    if (isEditing) {
      const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') confirmInlineEdit();
        if (e.key === 'Escape') cancelInlineEdit();
        if (e.key === 'Tab') { e.preventDefault(); handleTabNext(f.id, field); }
      };
      if (field === 'status') {
        return <select ref={editRef as React.RefObject<HTMLSelectElement>} value={inlineEdit!.value} onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })} onKeyDown={handleKeyDown} onBlur={confirmInlineEdit} className={inputCls}>
          {['', 'SUBS', 'FIXED', 'FAILED', 'REPLACED'].map(s => <option key={s || '_'} value={s}>{s || '--'}</option>)}
        </select>;
      }
      return <input ref={editRef as React.RefObject<HTMLInputElement>} type="text" value={inlineEdit!.value} onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })} onKeyDown={handleKeyDown} onBlur={confirmInlineEdit} className={inputCls} />;
    }

    return <span className={cellCls(f, field, baseCls)} onDoubleClick={() => canEdit && startInlineEdit(f.id, field, displayVal === '--' ? '' : displayVal)}>{displayVal}</span>;
  }

  function openPortPopup(port: string) {
    const existing = anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(port));
    setPortPopup({ port, area: (existing?.area || 'Other') as Area });
  }

  return (
    <>
    <div className="flex-1 overflow-y-auto">
      {sorted.length === 0 && <div className={`${isDark ? 'text-gray-600' : 'text-slate-400'} text-center py-20 text-sm`}>NO FIXTURES FOUND</div>}
      {sorted.length > 0 && (
        <div className={`${barBg} px-4 py-1 border-b flex items-center gap-3`}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={() => allSelected ? onDeselectAll() : onSelectAll(allFilteredIds)} className="accent-amber-500" />
            <span className={`${barText} text-[10px]`}>{selectedIds.size > 0 ? `${selectedIds.size} SELECTED` : 'SELECT ALL'}</span>
          </label>
        </div>
      )}
      {grouped.map(({ week, fixtures: weekFixtures }) => (
        <div key={week} className="mb-px">
          <div className={`${hdrBg} px-4 py-1.5 border-b sticky top-0 z-10`}>
            <span className={`font-semibold text-xs tracking-wide ${hdrText}`}>{week}</span>
            <span className={`${hdrSub} text-xs ml-3`}>{weekFixtures.length} fixture{weekFixtures.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className={`${thCls} border-b`}>
                <th className="text-left px-2 py-1 w-8"></th>
                <th className="text-left px-2 py-1 w-6"></th>
                {columns.map(col => (
                  <th key={col.field} className={`text-left px-2 py-1 ${col.width} cursor-pointer select-none hover:opacity-70 transition-opacity`} onClick={() => handleSort(col.field)}>
                    {col.label}<SortIcon field={col.field} />
                  </th>
                ))}
                <th className="text-right px-2 py-1 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {weekFixtures.map(f => {
                const cat = getDateCategory(f);
                const rowBg = getRowBg(cat, isDark);
                const rowTextOverride = getRowTextOverride(cat, isDark);
                const statusBorder = STATUS_BORDER[f.status] || '';
                const statusText = isDark ? STATUS_TEXT_DARK[f.status] || '' : STATUS_TEXT_LIGHT[f.status] || '';
                const baseText = rowTextOverride || (isDark ? 'text-gray-200' : 'text-slate-700');
                const mutedText = rowTextOverride || (isDark ? 'text-gray-400' : 'text-slate-500');
                const accentText = rowTextOverride || (isDark ? 'text-amber-400' : 'text-amber-600');
                const rateText = rowTextOverride || (isDark ? 'text-cyan-400' : 'text-cyan-700');

                return (
                  <tr key={f.id} className={`border-l-2 ${statusBorder} ${rowBg} ${selectedIds.has(f.id) ? selBg : ''} ${hoverBg} transition-colors`}>
                    <td className="px-2 py-0.5"><input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => onToggleSelect(f.id)} className="accent-amber-500 cursor-pointer" /></td>
                    <td className="px-1 py-0.5">
                      {f.private && <span title="Private"><Skull size={11} className="text-red-500" /></span>}
                    </td>
                    <td className={`px-2 py-0.5 ${mutedText}`}>{formatDate(f.dateAdded)}</td>
                    <td className="px-2 py-0.5">{renderCell(f, 'charterers', f.charterers || '--', baseText)}</td>
                    <td className="px-2 py-0.5">{renderCell(f, 'qty', f.qty || '--', mutedText)}</td>
                    <td className="px-2 py-0.5">{renderCell(f, 'grade', f.grade || '--', mutedText)}</td>
                    <td className="px-2 py-0.5">
                      <div className="inline-flex items-center gap-1">
                        {renderCell(f, 'loadPort', f.loadPort || '--', baseText)}
                        {f.loadPort.split('-').map(p => p.trim()).filter(Boolean).some(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) && (
                          <button onClick={() => openPortPopup(f.loadPort.split('-').map(p => p.trim()).find(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) || f.loadPort)} className="text-yellow-500 hover:text-yellow-400">
                            <AlertTriangle size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-0.5">
                      <div className="inline-flex items-center gap-1">
                        {renderCell(f, 'dischargePort', f.dischargePort || '--', baseText)}
                        {f.dischargePort.split('-').map(p => p.trim()).filter(Boolean).some(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) && (
                          <button onClick={() => openPortPopup(f.dischargePort.split('-').map(p => p.trim()).find(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) || f.dischargePort)} className="text-yellow-500 hover:text-yellow-400">
                            <AlertTriangle size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-0.5">{renderCell(f, 'laycan', displayLaycan(f.laycan) || '--', accentText)}</td>
                    <td className="px-2 py-0.5">
                      <div className="group relative inline-flex items-center gap-1">
                        {renderCell(f, 'vessel', f.vessel || '--', baseText)}
                        {(() => {
                          const vo = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel);
                          const missing = f.vessel && (!vo || !vo.owner || !vo.dwt || !vo.yob);
                          return missing ? <button onClick={() => setVesselPopup({ vessel: f.vessel, owner: vo?.owner || '', dwt: vo?.dwt || '', yob: vo?.yob || '' })} className="text-yellow-500 hover:text-yellow-400"><AlertTriangle size={11} /></button> : null;
                        })()}
                        {(() => {
                          const vo = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel);
                          if (!f.vessel || !vo) return null;
                          return (
                            <div className={`hidden group-hover:block absolute left-0 top-full mt-1 z-30 border rounded px-2 py-1 text-[10px] whitespace-nowrap ${isDark ? 'bg-gray-900 border-gray-600 text-gray-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                              OWNER: {vo.owner || '--'} | DWT: {vo.dwt || '--'} | YOB: {vo.yob || '--'}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="px-2 py-0.5">{renderCell(f, 'rate', f.rate || '--', rateText)}</td>
                    <td className="px-2 py-0.5">{renderCell(f, 'status', f.status || '--', statusText || mutedText)}</td>
                    <td className="px-2 py-0.5">{renderCell(f, 'dem', f.dem || '--', mutedText)}</td>
                    <td className="px-2 py-0.5">{renderCell(f, 'comments', f.comments || '--', mutedText)}</td>
                    {showAreaCol && <td className={`px-2 py-0.5 ${mutedText}`}>{f.area}</td>}
                    <td className="px-2 py-0.5 text-right">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => onRollover(f.id)} className={`${isDark ? 'text-gray-600 hover:text-green-500' : 'text-slate-400 hover:text-green-500'} transition-colors`} title="Rollover to this week"><CornerUpLeft size={11} /></button>
                        <button onClick={() => onTogglePrivate(f.id)} className={`${f.private ? 'text-red-500 hover:text-red-400' : `${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'}`} transition-colors`} title={f.private ? 'Make public' : 'Make private'}><Skull size={11} /></button>
                        <button onClick={() => onEdit(f)} className={`${isDark ? 'text-gray-600 hover:text-amber-500' : 'text-slate-400 hover:text-amber-600'} transition-colors`}><Edit3 size={11} /></button>
                        <button onClick={() => onDelete(f.id)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'} transition-colors`}><Trash2 size={11} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
    {vesselPopup && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
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
    {portPopup && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border p-6 max-w-md w-full rounded-lg`}>
          <h3 className={`font-semibold text-sm mb-2 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>ASSIGN PORT AREA</h3>
          <p className={`${isDark ? 'text-gray-400' : 'text-slate-500'} text-xs mb-3`}>{portPopup.port}</p>
          <select value={portPopup.area} onChange={e => setPortPopup(prev => prev ? { ...prev, area: e.target.value as Area } : prev)} onKeyDown={e => e.key === 'Enter' && (onUpsertPortArea(portPopup.port, portPopup.area), setPortPopup(null))} className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs w-full mb-4 rounded`} autoFocus>
            {ALL_AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={() => { onUpsertPortArea(portPopup.port, portPopup.area); setPortPopup(null); }} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs rounded-sm">SAVE</button>
            <button onClick={() => setPortPopup(null)} className={`${isDark ? 'text-gray-500 border-gray-600' : 'text-slate-500 border-slate-200'} px-4 py-2 text-xs border rounded-sm`}>CANCEL</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function groupByWeek(fixtures: Fixture[]): { week: string; fixtures: Fixture[] }[] {
  const map = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const week = getISOWeek(f.dateAdded);
    if (!map.has(week)) map.set(week, []);
    map.get(week)!.push(f);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([week, fixtures]) => ({ week, fixtures }));
}
