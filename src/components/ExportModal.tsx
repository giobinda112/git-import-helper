import { useState, useMemo } from 'react';
import type { Fixture, Anagrafiche, Area } from '../types';
import { ALL_AREAS } from '../utils/areaMapper';
import { formatDate, displayLaycan } from '../utils/laycanParser';
import { X, Download, Skull } from 'lucide-react';

interface ExportModalProps {
  fixtures: Fixture[];
  anagrafiche: Anagrafiche;
  selectedIds: Set<string>;
  activeArea: Area | null;
  onClose: () => void;
}

const ALL_COLUMNS = [
  { key: 'dateAdded', label: 'DATE' },
  { key: 'charterers', label: 'CHARTERERS' },
  { key: 'qty', label: 'QTY' },
  { key: 'grade', label: 'GRADE' },
  { key: 'loadPort', label: 'LOAD PORT' },
  { key: 'dischargePort', label: 'DISCH PORT' },
  { key: 'laycan', label: 'LAYCAN' },
  { key: 'vessel', label: 'VESSEL' },
  { key: 'rate', label: 'RATE' },
  { key: 'status', label: 'STATUS' },
  { key: 'dem', label: 'DEM' },
  { key: 'comments', label: 'COMMENTS' },
  { key: 'area', label: 'AREA' },
  { key: 'owner', label: 'OWNER' },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]['key'];

export default function ExportModal({ fixtures, anagrafiche, selectedIds, activeArea, onClose }: ExportModalProps) {
  const [selectedCols, setSelectedCols] = useState<Set<ColKey>>(
    new Set(['dateAdded', 'charterers', 'qty', 'grade', 'loadPort', 'dischargePort', 'laycan', 'vessel', 'rate', 'status', 'dem', 'comments'])
  );
  const [areaFilters, setAreaFilters] = useState<Set<Area>>(() => activeArea ? new Set([activeArea]) : new Set(ALL_AREAS));
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [editableText, setEditableText] = useState('');
  const [includePrivate, setIncludePrivate] = useState(false);
  const [privateIds, setPrivateIds] = useState<Set<string>>(new Set());

  const filteredFixtures = useMemo(() => {
    return fixtures.filter(f => {
      if (f.archived) return false;
      if (f.private && !includePrivate && !privateIds.has(f.id)) return false;
      if (selectedIds.size > 0 && !selectedIds.has(f.id)) return false;
      if (!areaFilters.has(f.area)) return false;
      if (dateFrom && f.dateAdded < dateFrom) return false;
      if (dateTo && f.dateAdded > dateTo) return false;
      return true;
    });
  }, [fixtures, selectedIds, areaFilters, dateFrom, dateTo, includePrivate, privateIds]);

  const privateFixtures = useMemo(() => {
    return fixtures.filter(f => f.private && !f.archived);
  }, [fixtures]);

  function togglePrivateId(id: string) {
    setPrivateIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleCol(key: ColKey) {
    const next = new Set(selectedCols);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedCols(next);
  }

  function toggleArea(area: Area) {
    const next = new Set(areaFilters);
    if (next.has(area)) next.delete(area); else next.add(area);
    setAreaFilters(next);
  }

  const activeCols = ALL_COLUMNS.filter(c => selectedCols.has(c.key));

  function getCellValue(f: Fixture, key: ColKey): string {
    if (key === 'dateAdded') return formatDate(f.dateAdded);
    if (key === 'laycan') return displayLaycan(f.laycan);
    if (key === 'owner') return anagrafiche.vesselOwners.find(vo => vo.vesselName === f.vessel)?.owner || '';
    if (key === 'comments' && f.private) {
      const val = f.comments || '';
      return val ? `PRIVATE ${val}` : 'PRIVATE';
    }
    const val = f[key as keyof Fixture];
    return typeof val === 'string' ? val : '';
  }

  function generatePreview(): string {
    const colWidths = activeCols.map(col => {
      const headerLen = col.label.length;
      const maxDataLen = Math.max(...filteredFixtures.map(f => getCellValue(f, col.key).length), 0);
      return Math.max(headerLen, maxDataLen) + 3;
    });

    const header = activeCols.map((col, i) => col.label.padEnd(colWidths[i])).join(' ');
    const separator = colWidths.map(w => '-'.repeat(w)).join(' ');
    const rows = filteredFixtures.map(f =>
      activeCols.map((col, i) => getCellValue(f, col.key).padEnd(colWidths[i])).join(' ')
    );

    return [header, separator, ...rows].join('\n');
  }

  function handleGenerate() {
    const text = generatePreview();
    setEditableText(text);
  }

  function handleExport() {
    const content = editableText || generatePreview();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixtures_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isDark = document.documentElement.classList.contains('dark');
  const inputCls = `${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none rounded-sm`;
  const modalBg = isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200';
  const borderCls = isDark ? 'border-gray-700' : 'border-slate-200';
  const textPrimary = isDark ? 'text-gray-200' : 'text-slate-700';
  const textMuted = isDark ? 'text-gray-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className={`${modalBg} border w-full max-w-7xl max-h-[90vh] flex flex-col rounded-lg`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${borderCls}`}>
          <h2 className={`font-semibold text-sm ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>EXPORT FIXTURES</h2>
          <button onClick={onClose} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}><X size={16} /></button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className={`w-64 border-r ${borderCls} overflow-y-auto p-4 space-y-4`}>
            <div>
              <h3 className={`${textMuted} text-[10px] font-medium mb-2 tracking-wider`}>COLUMNS</h3>
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={selectedCols.has(col.key)} onChange={() => toggleCol(col.key)} className="accent-amber-500" />
                  <span className={`${textPrimary} text-xs`}>{col.label}</span>
                </label>
              ))}
            </div>
            <div>
              <h3 className={`${textMuted} text-[10px] font-medium mb-2 tracking-wider`}>AREAS</h3>
              {ALL_AREAS.map(area => (
                <label key={area} className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={areaFilters.has(area)} onChange={() => toggleArea(area)} className="accent-amber-500" />
                  <span className={`${textPrimary} text-xs`}>{area.toUpperCase()}</span>
                </label>
              ))}
            </div>
            <div>
              <h3 className={`${textMuted} text-[10px] font-medium mb-2 tracking-wider`}>DATE OF ENTRY</h3>
              <div className="space-y-2">
                <div>
                  <label className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px]`}>FROM</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={`${inputCls} w-full`} />
                </div>
                <div>
                  <label className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px]`}>TO</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={`${inputCls} w-full`} />
                </div>
                <button onClick={() => { setDateFrom(''); setDateTo(''); }} className={`${textMuted} text-[10px] hover:opacity-70`}>Clear dates</button>
              </div>
            </div>
            {privateFixtures.length > 0 && (
              <div>
                <h3 className={`${textMuted} text-[10px] font-medium mb-2 tracking-wider flex items-center gap-1`}>
                  <Skull size={10} className="text-red-500" /> PRIVATE FIXTURES
                </h3>
                <label className="flex items-center gap-2 py-0.5 cursor-pointer">
                  <input type="checkbox" checked={includePrivate} onChange={() => setIncludePrivate(v => !v)} className="accent-amber-500" />
                  <span className={`${textPrimary} text-xs`}>Include all private</span>
                </label>
                {!includePrivate && privateFixtures.map(f => (
                  <label key={f.id} className="flex items-center gap-2 py-0.5 cursor-pointer">
                    <input type="checkbox" checked={privateIds.has(f.id)} onChange={() => togglePrivateId(f.id)} className="accent-amber-500" />
                    <span className={`${textPrimary} text-xs truncate`} title={`${f.vessel} - ${f.charterers}`}>{f.vessel || f.charterers}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className={`px-4 py-2 border-b ${borderCls} flex items-center justify-between`}>
              <span className={`${textMuted} text-[10px]`}>{filteredFixtures.length} rows</span>
              <div className="flex gap-2">
                <button onClick={handleGenerate} disabled={filteredFixtures.length === 0 || activeCols.length === 0} className={`${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-200 hover:bg-slate-300'} disabled:opacity-50 text-white px-3 py-1.5 text-xs font-semibold transition-colors rounded-sm`}>
                  GENERATE
                </button>
                <button onClick={handleExport} disabled={!editableText} className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 text-xs font-semibold flex items-center gap-2 transition-colors rounded-sm">
                  <Download size={12} /> EXPORT .TXT
                </button>
              </div>
            </div>
            <textarea
              value={editableText}
              onChange={e => setEditableText(e.target.value)}
              placeholder="Click GENERATE to create preview, or type/paste your own content here..."
              className={`flex-1 p-4 text-[10px] font-mono leading-relaxed resize-none ${isDark ? 'text-gray-400 bg-gray-950' : 'text-slate-500 bg-slate-50'} focus:outline-none`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
