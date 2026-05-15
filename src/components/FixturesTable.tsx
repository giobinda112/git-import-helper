import { useState, useMemo, useRef, useEffect } from 'react';
import type { Fixture, Anagrafiche, Area, FieldEdit } from '../types';
import { getISOWeek, formatDate, displayLaycan } from '../utils/laycanParser';
import { ALL_AREAS, normalizePortKey } from '../utils/areaMapper';
import { matchesSearch } from '../utils/helpers';
import { Trash2, CreditCard as Edit3, ArrowUp, ArrowDown, Skull, CornerUpLeft, AlertTriangle } from 'lucide-react';

interface FixturesTableProps {
  fixtures: Fixture[];
  anagrafiche: Anagrafiche;
  selectedArea: string | null;
  searchQuery: string;
  viewVariant?: 'standard' | 'vessel';
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

type Group = { key: string; label: string; fixtures: Fixture[] };

type DateCat = 'today' | 'today-rolled' | 'yesterday' | 'yesterday-modified' | null;

function groupByWeek(fixtures: Fixture[]): Group[] {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const week = getISOWeek(fixture.dateAdded || '');
    groups.set(week, [...(groups.get(week) || []), fixture]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a, undefined, { sensitivity: 'base' }))
    .map(([week, weekFixtures]) => ({ key: week, label: week, fixtures: weekFixtures }));
}

function groupByArea(fixtures: Fixture[], selectedArea: string | null): Group[] {
  const groups = new Map<string, Fixture[]>();
  for (const fixture of fixtures) {
    const area = fixture.area || 'Other';
    groups.set(area, [...(groups.get(area) || []), fixture]);
  }
  const orderedAreas = Array.from(groups.keys()).sort((a, b) => {
    if (selectedArea && a === selectedArea) return -1;
    if (selectedArea && b === selectedArea) return 1;
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });
  return orderedAreas.map(area => ({
    key: area,
    label: selectedArea && area === selectedArea ? `${area} (selected area)` : area,
    fixtures: groups.get(area) || [],
  }));
}

/** Match calendar day for ISO timestamps or legacy yyyy-mm-dd `editedAt` values. */
function sameCalendarDay(isoOrDate: string, yyyyMmDd: string): boolean {
  if (!isoOrDate) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate.trim())) return isoOrDate.trim() === yyyyMmDd;
  return isoOrDate.slice(0, 10) === yyyyMmDd;
}

function getDateCategory(fixture: Fixture): DateCat {
  const da = fixture.dateAdded?.trim();
  if (!da || !/^\d{4}-\d{2}-\d{2}$/.test(da)) return null;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  if (da === today) {
    const rolledOver = fixture.editHistory.some(e => e.field === 'dateAdded' && sameCalendarDay(e.editedAt, today));
    if (rolledOver) return 'today-rolled';
    return 'today';
  }
  if (da === yesterday) {
    const modifiedToday = fixture.editHistory.some(e => sameCalendarDay(e.editedAt, today));
    if (modifiedToday) return 'yesterday-modified';
    return 'yesterday';
  }
  return null;
}

type RowTone = { row: string; text: string; muted: string; accent: string; rate: string; underline: string };

function getRowTone(cat: DateCat, isDark: boolean): RowTone {
  if (cat === 'today') {
    return {
      row: 'bg-[#1e3a8a]',
      text: 'text-white font-bold',
      muted: 'text-white font-bold',
      accent: 'text-white font-bold',
      rate: 'text-white font-bold',
      underline: 'underline decoration-white decoration-2 underline-offset-2',
    };
  }
  if (cat === 'yesterday') {
    return {
      row: 'bg-[#facc15]',
      text: 'text-black font-bold',
      muted: 'text-black font-bold',
      accent: 'text-black font-bold',
      rate: 'text-black font-bold',
      underline: 'underline decoration-black decoration-2 underline-offset-2',
    };
  }
  if (cat === 'today-rolled' || cat === 'yesterday-modified') {
    return {
      row: 'bg-[#059669]',
      text: 'text-white font-bold',
      muted: 'text-white font-bold',
      accent: 'text-white font-bold',
      rate: 'text-white font-bold',
      underline: 'underline decoration-white decoration-2 underline-offset-2',
    };
  }
  const u = isDark ? 'decoration-green-400' : 'decoration-green-700';
  return {
    row: '',
    text: isDark ? 'text-gray-200' : 'text-slate-700',
    muted: isDark ? 'text-gray-400' : 'text-slate-500',
    accent: isDark ? 'text-amber-400' : 'text-amber-600',
    rate: isDark ? 'text-cyan-400' : 'text-cyan-700',
    underline: `underline ${u} decoration-2 underline-offset-2`,
  };
}

function isFieldModifiedToday(fixture: Fixture, field: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return fixture.editHistory.some(e => e.field === field && sameCalendarDay(e.editedAt, today));
}

const INLINE_FIELDS = ['charterers', 'qty', 'grade', 'loadPort', 'dischargePort', 'laycan', 'vessel', 'rate', 'status', 'dem', 'comments'];

export default function FixturesTable({
  fixtures, anagrafiche, selectedArea, searchQuery, viewVariant = 'standard', onDelete, onEdit, onInlineEdit, onTogglePrivate, onRollover,
  onUpsertVesselMetadata, onUpsertPortArea,
  selectedIds, onToggleSelect, onSelectAll, onDeselectAll, maxWeeks,
}: FixturesTableProps) {
  const [sortField, setSortField] = useState<SortField>('dateAdded');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [inlineEdit, setInlineEdit] = useState<{ fixtureId: string; field: string; value: string } | null>(null);
  const [vesselPopup, setVesselPopup] = useState<{ vessel: string; owner: string; dwt: string; yob: string } | null>(null);
  const [portPopup, setPortPopup] = useState<{ port: string; area: Area } | null>(null);
  const [historyFixture, setHistoryFixture] = useState<Fixture | null>(null);
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
  const columns: { field: SortField; label: string; width: string }[] = viewVariant === 'vessel' ? [
    { field: 'dateAdded', label: 'DATE', width: 'w-[72px]' },
    { field: 'vessel', label: 'VESSEL', width: 'w-[100px]' },
    { field: 'qty', label: 'QTY', width: 'w-[44px]' },
    { field: 'grade', label: 'GRADE', width: 'w-[72px]' },
    { field: 'laycan', label: 'LAYCAN', width: 'w-[88px]' },
    { field: 'loadPort', label: 'LOAD PORT', width: 'w-[100px]' },
    { field: 'dischargePort', label: 'DISCH PORT', width: 'w-[100px]' },
    { field: 'rate', label: 'RATE', width: 'w-[72px]' },
    { field: 'charterers', label: 'CHARTERERS', width: 'w-[100px]' },
    { field: 'status', label: 'STATUS', width: 'w-[56px]' },
    { field: 'dem', label: 'DEM', width: 'w-[56px]' },
    { field: 'comments', label: 'COMMENTS', width: 'w-[120px]' },
    ...(showAreaCol ? [{ field: 'area' as SortField, label: 'AREA', width: 'w-[56px]' }] : []),
  ] : [
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

  const grouped = searchQuery ? groupByArea(sorted, selectedArea) : groupByWeek(sorted);

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

  function cellCls(f: Fixture, field: string, base: string, tone: RowTone): string {
    const modified = isFieldModifiedToday(f, field);
    const underline = modified ? tone.underline : '';
    return `${base} ${underline}`;
  }

  const hdrBg = isDark ? 'bg-neutral-900 text-amber-400' : 'bg-neutral-200 text-amber-800';
  const hdrSub = isDark ? 'text-gray-400' : 'text-slate-600';
  const thCls = 'border border-neutral-900 text-left px-2 py-1 font-semibold text-[10px] align-middle';
  const hoverBg = isDark ? 'hover:brightness-110' : 'hover:brightness-95';
  const barBg = isDark ? 'bg-gray-900/50 border-neutral-900' : 'bg-slate-50 border-neutral-900';
  const barText = isDark ? 'text-gray-500' : 'text-slate-400';
  const inputCls = `${isDark ? 'bg-gray-800 border-amber-500 text-gray-100' : 'bg-white border-amber-500 text-slate-800'} border px-1 py-0 text-xs focus:outline-none rounded-sm w-full`;

  function renderCell(f: Fixture, field: string, displayVal: string, baseCls: string, tone: RowTone) {
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
          {['', 'OPEN', 'SUBS', 'FIXED', 'FAILED', 'REPLACED'].map(s => <option key={s || '_'} value={s}>{s || '--'}</option>)}
        </select>;
      }
      return <input ref={editRef as React.RefObject<HTMLInputElement>} type="text" value={inlineEdit!.value} onChange={e => setInlineEdit({ ...inlineEdit!, value: e.target.value })} onKeyDown={handleKeyDown} onBlur={confirmInlineEdit} className={inputCls} />;
    }

    return <span className={cellCls(f, field, baseCls, tone)} onDoubleClick={() => canEdit && startInlineEdit(f.id, field, displayVal === '--' ? '' : displayVal)}>{displayVal}</span>;
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
          <div className={`${hdrBg} px-4 py-1.5 border border-neutral-900 sticky top-0 z-10`}>
            <span className="font-semibold text-xs tracking-wide">{week}</span>
            <span className={`${hdrSub} text-xs ml-3`}>{weekFixtures.length} fixture{weekFixtures.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="w-full text-xs border-collapse border border-neutral-900">
            <thead>
              <tr className="bg-neutral-950/5">
                <th className={`${thCls} w-8`}></th>
                <th className={`${thCls} w-6`}></th>
                {columns.map(col => (
                  <th key={col.field} className={`${thCls} ${col.width} cursor-pointer select-none hover:opacity-80 transition-opacity`} onClick={() => handleSort(col.field)}>
                    {col.label}<SortIcon field={col.field} />
                  </th>
                ))}
                <th className={`${thCls} w-10 text-center`} title="Edit history">🕒</th>
                <th className={`${thCls} w-12 text-right`}></th>
              </tr>
            </thead>
            <tbody>
              {weekFixtures.map(f => {
                const cat = getDateCategory(f);
                const tone = getRowTone(cat, isDark);
                const statusBorder = STATUS_BORDER[f.status] || 'border-l-transparent';
                const statusBadge = f.status === 'SUBS'
                  ? 'bg-amber-400 text-slate-900 font-semibold'
                  : f.status === 'FIXED'
                    ? 'bg-emerald-600 text-white font-semibold'
                    : f.status === 'FAILED'
                      ? 'bg-red-600 text-white font-semibold'
                      : f.status === 'REPLACED'
                        ? 'bg-blue-600 text-white font-semibold'
                        : `${isDark ? 'text-gray-200' : 'text-slate-700'}`;
                const chartererCellBase = cat === 'today'
                  ? 'bg-[#1e3a8a] text-white font-semibold'
                  : cat === 'yesterday'
                    ? 'bg-[#facc15] text-slate-900 font-semibold'
                    : (cat === 'today-rolled' || cat === 'yesterday-modified')
                      ? 'bg-[#059669] text-white font-semibold'
                      : tone.text;
                const baseText = tone.text;
                const mutedText = tone.muted;
                const accentText = tone.accent;
                const rateText = tone.rate;

                return (
                  <tr key={f.id} className={`border border-neutral-900 border-l-[3px] ${statusBorder} ${selectedIds.has(f.id) ? 'ring-2 ring-inset ring-amber-400' : ''} ${hoverBg} transition-[filter]`}>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle"><input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => onToggleSelect(f.id)} className="accent-amber-500 cursor-pointer" /></td>
                    <td className="border border-neutral-900 px-1 py-0.5 align-middle">
                      {f.private && <span title="Private"><Skull size={11} className="text-red-500" /></span>}
                    </td>
                    <td className={`border border-neutral-900 px-2 py-0.5 align-middle ${mutedText}`}>{formatDate(f.dateAdded)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'charterers', f.charterers || '--', chartererCellBase, tone)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'qty', f.qty || '--', mutedText, tone)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'grade', f.grade || '--', mutedText, tone)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">
                      <div className="inline-flex items-center gap-1">
                        {renderCell(f, 'loadPort', f.loadPort || '--', baseText, tone)}
                        {f.loadPort.split('-').map(p => p.trim()).filter(Boolean).some(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) && (
                          <button type="button" onClick={() => openPortPopup(f.loadPort.split('-').map(p => p.trim()).find(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) || f.loadPort)} className="text-yellow-500 hover:text-yellow-400">
                            <AlertTriangle size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">
                      <div className="inline-flex items-center gap-1">
                        {renderCell(f, 'dischargePort', f.dischargePort || '--', baseText, tone)}
                        {f.dischargePort.split('-').map(p => p.trim()).filter(Boolean).some(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) && (
                          <button type="button" onClick={() => openPortPopup(f.dischargePort.split('-').map(p => p.trim()).find(p => !anagrafiche.portMappings.find(pm => normalizePortKey(pm.portName) === normalizePortKey(p))) || f.dischargePort)} className="text-yellow-500 hover:text-yellow-400">
                            <AlertTriangle size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'laycan', displayLaycan(f.laycan) || '--', accentText, tone)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">
                      <div className="group relative inline-flex items-center gap-1">
                        {renderCell(f, 'vessel', f.vessel || '--', baseText, tone)}
                        {(() => {
                          const vo = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel);
                          const missing = f.vessel && (!vo || !vo.owner || !vo.dwt || !vo.yob);
                          return missing ? <button type="button" onClick={() => setVesselPopup({ vessel: f.vessel, owner: vo?.owner || '', dwt: vo?.dwt || '', yob: vo?.yob || '' })} className="text-yellow-500 hover:text-yellow-400"><AlertTriangle size={11} /></button> : null;
                        })()}
                        {(() => {
                          const vo = anagrafiche.vesselOwners.find(v => v.vesselName === f.vessel);
                          if (!f.vessel || !vo) return null;
                          return (
                            <div className={`hidden group-hover:block absolute left-0 top-full mt-1 z-50 border border-neutral-800 rounded px-2 py-1 text-[10px] whitespace-nowrap opacity-100 shadow-2xl ${isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-950 text-gray-100'}`}>
                              OWNER: {vo.owner || '--'} | DWT: {vo.dwt || '--'} | BUILT: {vo.yob || '--'}
                            </div>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'rate', f.rate || '--', rateText, tone)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'status', f.status || '--', statusBadge, tone)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'dem', f.dem || '--', mutedText, tone)}</td>
                    <td className="border border-neutral-900 px-2 py-0.5 align-middle">{renderCell(f, 'comments', f.comments || '--', mutedText, tone)}</td>
                    {showAreaCol && <td className={`border border-neutral-900 px-2 py-0.5 align-middle ${mutedText}`}>{f.area}</td>}
                    <td className="border border-neutral-900 px-1 py-0.5 text-center align-middle">
                      <button type="button" onClick={() => setHistoryFixture(f)} className={`text-[12px] leading-none ${isDark ? 'opacity-90 hover:opacity-100' : 'opacity-80 hover:opacity-100'}`} title="Edit history">🕒</button>
                    </td>
                    <td className="border border-neutral-900 px-2 py-0.5 text-right align-middle">
                      <div className="flex gap-1 justify-end">
                        <button type="button" onClick={() => onRollover(f.id)} className={`${isDark ? 'text-gray-200 hover:text-green-300' : 'text-slate-700 hover:text-green-700'} transition-colors`} title="Rollover to this week"><CornerUpLeft size={11} /></button>
                        <button type="button" onClick={() => onTogglePrivate(f.id)} className={`${f.private ? 'text-red-500 hover:text-red-400' : isDark ? 'text-gray-200 hover:text-red-400' : 'text-slate-700 hover:text-red-600'} transition-colors`} title={f.private ? 'Make public' : 'Make private'}><Skull size={11} /></button>
                        <button type="button" onClick={() => onEdit(f)} className={`${isDark ? 'text-gray-200 hover:text-amber-400' : 'text-slate-700 hover:text-amber-700'} transition-colors`}><Edit3 size={11} /></button>
                        <button type="button" onClick={() => onDelete(f.id)} className={`${isDark ? 'text-gray-200 hover:text-red-400' : 'text-slate-700 hover:text-red-600'} transition-colors`}><Trash2 size={11} /></button>
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
    {historyFixture && (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" onClick={() => setHistoryFixture(null)}>
        <div className={`max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg border-2 border-neutral-900 shadow-xl ${isDark ? 'bg-gray-900 text-gray-100' : 'bg-white text-slate-800'}`} onClick={e => e.stopPropagation()}>
          <div className={`flex items-center justify-between border-b border-neutral-900 px-4 py-2 ${isDark ? 'bg-neutral-950' : 'bg-neutral-100'}`}>
            <h3 className="text-xs font-bold tracking-wide">EDIT HISTORY</h3>
            <button type="button" onClick={() => setHistoryFixture(null)} className="text-[10px] opacity-70 hover:opacity-100">CLOSE</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
            {(historyFixture.editHistory || []).length === 0 && (
              <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-slate-500'}`}>No recorded edits yet.</p>
            )}
            {[...(historyFixture.editHistory || [])].reverse().map((e: FieldEdit, idx) => (
              <div key={idx} className={`border-l-2 border-amber-500 pl-3 text-[11px] ${isDark ? 'text-gray-200' : 'text-slate-700'}`}>
                <div className="font-semibold text-amber-600 dark:text-amber-400">
                  {(() => { try { return new Date(e.editedAt).toLocaleString(); } catch { return e.editedAt; } })()}
                </div>
                <div className="mt-1"><span className="opacity-70">Field:</span> <span className="font-mono">{e.field}</span></div>
                <div className="mt-0.5"><span className="opacity-70">Old → New:</span> <span className="font-mono break-all">{e.oldValue || '—'} → {e.newValue || '—'}</span></div>
                <div className="mt-0.5"><span className="opacity-70">Computer:</span> {e.deviceOwner || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )}
    {vesselPopup && (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border p-6 max-w-md w-full rounded-lg`}>
          <h3 className={`font-semibold text-sm mb-2 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>VESSEL METADATA</h3>
          <input value={vesselPopup.owner} onChange={e => setVesselPopup(prev => prev ? { ...prev, owner: e.target.value.toUpperCase() } : prev)} onKeyDown={e => e.key === 'Enter' && (onUpsertVesselMetadata(vesselPopup.vessel, vesselPopup.owner, vesselPopup.dwt, vesselPopup.yob), setVesselPopup(null))} placeholder="Owner" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs w-full mb-2 rounded`} autoFocus={!vesselPopup.owner} />
          <input value={vesselPopup.dwt} onChange={e => setVesselPopup(prev => prev ? { ...prev, dwt: e.target.value.replace(/[^0-9]/g, '') } : prev)} onKeyDown={e => e.key === 'Enter' && (onUpsertVesselMetadata(vesselPopup.vessel, vesselPopup.owner, vesselPopup.dwt, vesselPopup.yob), setVesselPopup(null))} placeholder="DWT" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs w-full mb-2 rounded`} autoFocus={!!vesselPopup.owner && !vesselPopup.dwt} />
          <input value={vesselPopup.yob} onChange={e => setVesselPopup(prev => prev ? { ...prev, yob: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) } : prev)} onKeyDown={e => e.key === 'Enter' && (onUpsertVesselMetadata(vesselPopup.vessel, vesselPopup.owner, vesselPopup.dwt, vesselPopup.yob), setVesselPopup(null))} placeholder="BUILT" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs w-full mb-4 rounded`} autoFocus={!!vesselPopup.owner && !!vesselPopup.dwt && !vesselPopup.yob} />
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

