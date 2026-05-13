import { useState, useMemo } from 'react';
import type { Fixture, Anagrafiche, Area } from '../types';
import { ALL_AREAS } from '../utils/areaMapper';
import { formatDate, displayLaycan } from '../utils/laycanParser';
import { matchesSearch } from '../utils/helpers';
import { X, Search, RotateCcw, Trash2, CreditCard as Edit3, Filter, Skull } from 'lucide-react';

interface ArchiveModalProps {
  fixtures: Fixture[];
  anagrafiche: Anagrafiche;
  onDelete: (id: string) => void;
  onEdit: (fixture: Fixture) => void;
  onRollover: (ids: string[]) => void;
  onClose: () => void;
}

type SortField = 'dateAdded' | 'charterers' | 'vessel' | 'loadPort' | 'dischargePort' | 'laycan' | 'rate' | 'status' | 'grade' | 'area' | 'dem' | 'comments';
type SortDir = 'asc' | 'desc';

const STATUS_TEXT: Record<string, string> = {
  SUBS: 'text-yellow-600', FIXED: 'text-green-600', FAILED: 'text-red-600', REPLACED: 'text-blue-600',
};

export default function ArchiveModal({ fixtures, anagrafiche, onDelete, onEdit, onRollover, onClose }: ArchiveModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('dateAdded');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Advanced filters
  const [areaFilter, setAreaFilter] = useState<Set<Area>>(new Set());
  const [portFilter, setPortFilter] = useState('');
  const [qtyMin, setQtyMin] = useState('');
  const [qtyMax, setQtyMax] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [laycanFrom, setLaycanFrom] = useState('');
  const [laycanTo, setLaycanTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<string>>(new Set());

  let filtered = fixtures;

  // Text search
  if (searchQuery) {
    const q = searchQuery;
    filtered = filtered.filter(f => {
      const owner = anagrafiche.vesselOwners.find(vo => vo.vesselName === f.vessel)?.owner || '';
      return matchesSearch(f.dateAdded, q) || matchesSearch(f.laycan, q) || matchesSearch(f.charterers, q) ||
        matchesSearch(f.loadPort, q) || matchesSearch(f.dischargePort, q) || matchesSearch(f.vessel, q) ||
        matchesSearch(f.rate, q) || matchesSearch(f.grade, q) || matchesSearch(f.status, q) ||
        matchesSearch(f.area, q) || matchesSearch(owner, q) || matchesSearch(f.dem, q) || matchesSearch(f.comments, q);
    });
  }

  // Area filter - scans both load and discharge ports
  if (areaFilter.size > 0) {
    filtered = filtered.filter(f => areaFilter.has(f.area));
  }

  // Port filter - search in both load and discharge ports
  if (portFilter.trim()) {
    const pf = portFilter.trim().toUpperCase();
    filtered = filtered.filter(f =>
      f.loadPort.toUpperCase().includes(pf) || f.dischargePort.toUpperCase().includes(pf)
    );
  }

  // Qty range filter
  if (qtyMin.trim() || qtyMax.trim()) {
    const min = parseInt(qtyMin, 10);
    const max = parseInt(qtyMax, 10);
    filtered = filtered.filter(f => {
      const qty = parseInt(f.qty, 10);
      if (isNaN(qty)) return false;
      if (!isNaN(min) && qty < min) return false;
      if (!isNaN(max) && qty > max) return false;
      return true;
    });
  }

  // Entry date range
  if (dateFrom) {
    filtered = filtered.filter(f => f.dateAdded >= dateFrom);
  }
  if (dateTo) {
    filtered = filtered.filter(f => f.dateAdded <= dateTo);
  }

  // Laycan date range (compare stored format DD-DD/MM/YYYY)
  if (laycanFrom) {
    filtered = filtered.filter(f => f.laycan >= laycanFrom);
  }
  if (laycanTo) {
    filtered = filtered.filter(f => f.laycan <= laycanTo);
  }

  // Status filter
  if (statusFilter.size > 0) {
    filtered = filtered.filter(f => statusFilter.has(f.status));
  }

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function handleRollover() {
    if (selectedIds.size > 0) onRollover([...selectedIds]);
  }

  function toggleAreaFilter(area: Area) {
    setAreaFilter(prev => {
      const next = new Set(prev);
      if (next.has(area)) next.delete(area); else next.add(area);
      return next;
    });
  }

  function toggleStatusFilter(status: string) {
    setStatusFilter(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  }

  function clearFilters() {
    setAreaFilter(new Set());
    setPortFilter('');
    setQtyMin('');
    setQtyMax('');
    setDateFrom('');
    setDateTo('');
    setLaycanFrom('');
    setLaycanTo('');
    setStatusFilter(new Set());
  }

  const hasActiveFilters = areaFilter.size > 0 || portFilter.trim() || qtyMin.trim() || qtyMax.trim() || dateFrom || dateTo || laycanFrom || laycanTo || statusFilter.size > 0;

  const isDark = document.documentElement.classList.contains('dark');
  const cellBase = isDark ? 'text-gray-200' : 'text-slate-700';
  const cellMuted = isDark ? 'text-gray-400' : 'text-slate-500';
  const inputCls = `${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none rounded-sm w-full`;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border w-full max-w-7xl max-h-[85vh] flex flex-col rounded-lg`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-slate-200'}`}>
          <h2 className={`font-semibold text-sm ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>ARCHIVE / HISTORY</h2>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button onClick={handleRollover} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs font-semibold transition-colors rounded-sm">
                <RotateCcw size={12} /> CARRY FORWARD ({selectedIds.size})
              </button>
            )}
            <button onClick={onClose} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}><X size={16} /></button>
          </div>
        </div>

        {/* Search bar + filter toggle */}
        <div className={`px-4 py-2 border-b ${isDark ? 'border-gray-700' : 'border-slate-200'} flex items-center gap-3`}>
          <div className="relative flex-1">
            <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search all parameters..." className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-slate-50 border-slate-300 text-slate-800'} border pl-8 pr-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none rounded-sm`} />
          </div>
          <button onClick={() => setShowFilters(v => !v)} className={`flex items-center gap-1 ${showFilters ? 'bg-amber-600 text-white' : `${isDark ? 'bg-gray-800 text-gray-400' : 'bg-slate-100 text-slate-500'}`} px-3 py-1.5 text-xs font-semibold transition-colors rounded-sm`}>
            <Filter size={12} /> FILTERS {hasActiveFilters && `(${areaFilter.size + statusFilter.size + (portFilter ? 1 : 0) + (qtyMin || qtyMax ? 1 : 0) + (dateFrom || dateTo ? 1 : 0) + (laycanFrom || laycanTo ? 1 : 0)})`}
          </button>
          <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[10px]`}>{sorted.length} fixtures</span>
          <button onClick={() => setSelectedIds(new Set(sorted.map(f => f.id)))} className="text-amber-500 text-[10px] hover:text-amber-400">ALL</button>
          <button onClick={() => setSelectedIds(new Set())} className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[10px] hover:opacity-70`}>NONE</button>
        </div>

        {/* Advanced Filter Panel */}
        {showFilters && (
          <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700 bg-gray-800/50' : 'border-slate-200 bg-slate-50'}`}>
            <div className="grid grid-cols-4 gap-4">
              {/* Area Filter */}
              <div>
                <h4 className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium mb-1.5 tracking-wider`}>GEOGRAPHIC AREA</h4>
                <div className="flex flex-wrap gap-1">
                  {ALL_AREAS.map(area => (
                    <button key={area} onClick={() => toggleAreaFilter(area)} className={`px-2 py-1 text-[9px] rounded-sm transition-colors ${areaFilter.has(area) ? 'bg-amber-600 text-white' : `${isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-white text-slate-500 hover:bg-slate-200'} border ${isDark ? 'border-gray-600' : 'border-slate-200'}`}`}>
                      {area}
                    </button>
                  ))}
                </div>
              </div>

              {/* Port Search */}
              <div>
                <h4 className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium mb-1.5 tracking-wider`}>PORT SEARCH</h4>
                <input type="text" value={portFilter} onChange={e => setPortFilter(e.target.value)} placeholder="Search load/disch ports..." className={inputCls} />
              </div>

              {/* Qty Range */}
              <div>
                <h4 className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium mb-1.5 tracking-wider`}>QTY RANGE (000s)</h4>
                <div className="flex gap-2">
                  <input type="text" value={qtyMin} onChange={e => setQtyMin(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Min" className={inputCls} />
                  <span className={`${isDark ? 'text-gray-600' : 'text-slate-400'} text-xs self-center`}>-</span>
                  <input type="text" value={qtyMax} onChange={e => setQtyMax(e.target.value.replace(/[^0-9]/g, ''))} placeholder="Max" className={inputCls} />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <h4 className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium mb-1.5 tracking-wider`}>STATUS</h4>
                <div className="flex flex-wrap gap-1">
                  {['SUBS', 'FIXED', 'FAILED', 'REPLACED'].map(s => (
                    <button key={s} onClick={() => toggleStatusFilter(s)} className={`px-2 py-1 text-[9px] rounded-sm transition-colors ${statusFilter.has(s) ? 'bg-amber-600 text-white' : `${isDark ? 'bg-gray-700 text-gray-400 hover:bg-gray-600' : 'bg-white text-slate-500 hover:bg-slate-200'} border ${isDark ? 'border-gray-600' : 'border-slate-200'}`}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Entry Date Range */}
              <div>
                <h4 className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium mb-1.5 tracking-wider`}>ENTRY DATE RANGE</h4>
                <div className="flex gap-2">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className={inputCls} />
                  <span className={`${isDark ? 'text-gray-600' : 'text-slate-400'} text-xs self-center`}>-</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Laycan Date Range */}
              <div>
                <h4 className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium mb-1.5 tracking-wider`}>LAYCAN DATE RANGE</h4>
                <div className="flex gap-2">
                  <input type="date" value={laycanFrom} onChange={e => setLaycanFrom(e.target.value)} className={inputCls} />
                  <span className={`${isDark ? 'text-gray-600' : 'text-slate-400'} text-xs self-center`}>-</span>
                  <input type="date" value={laycanTo} onChange={e => setLaycanTo(e.target.value)} className={inputCls} />
                </div>
              </div>

              {/* Clear */}
              <div className="flex items-end">
                {hasActiveFilters && (
                  <button onClick={clearFilters} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'} text-[10px] transition-colors`}>CLEAR ALL FILTERS</button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className={`sticky top-0 z-10 ${isDark ? 'bg-gray-800' : 'bg-slate-100'}`}>
              <tr className={`${isDark ? 'text-gray-500 border-gray-700' : 'text-slate-400 border-slate-200'} border-b`}>
                <th className="text-left px-2 py-1 w-8"></th>
                <th className="text-left px-2 py-1 w-6"></th>
                <th className="text-left px-2 py-1 w-[72px] cursor-pointer select-none" onClick={() => handleSort('dateAdded')}>DATE</th>
                <th className="text-left px-2 py-1 w-[100px] cursor-pointer select-none" onClick={() => handleSort('charterers')}>CHARTERERS</th>
                <th className="text-left px-2 py-1 w-[44px]">QTY</th>
                <th className="text-left px-2 py-1 w-[72px]">GRADE</th>
                <th className="text-left px-2 py-1 w-[100px] cursor-pointer select-none" onClick={() => handleSort('loadPort')}>LOAD PORT</th>
                <th className="text-left px-2 py-1 w-[100px] cursor-pointer select-none" onClick={() => handleSort('dischargePort')}>DISCH PORT</th>
                <th className="text-left px-2 py-1 w-[88px] cursor-pointer select-none" onClick={() => handleSort('laycan')}>LAYCAN</th>
                <th className="text-left px-2 py-1 w-[100px] cursor-pointer select-none" onClick={() => handleSort('vessel')}>VESSEL</th>
                <th className="text-left px-2 py-1 w-[72px] cursor-pointer select-none" onClick={() => handleSort('rate')}>RATE</th>
                <th className="text-left px-2 py-1 w-[56px] cursor-pointer select-none" onClick={() => handleSort('status')}>STATUS</th>
                <th className="text-left px-2 py-1 w-[56px]">DEM</th>
                <th className="text-left px-2 py-1 w-[120px]">COMMENTS</th>
                <th className="text-left px-2 py-1 w-[56px] cursor-pointer select-none" onClick={() => handleSort('area')}>AREA</th>
                <th className="text-right px-2 py-1 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={16} className={`${isDark ? 'text-gray-600' : 'text-slate-400'} text-center py-12 text-sm`}>NO FIXTURES FOUND</td></tr>}
              {sorted.map(f => (
                <tr key={f.id} className={`border-b ${isDark ? 'border-gray-800' : 'border-slate-100'} ${selectedIds.has(f.id) ? (isDark ? 'bg-amber-900/20' : 'bg-amber-50') : ''} ${isDark ? 'hover:bg-gray-800/40' : 'hover:bg-slate-50'} transition-colors ${f.archived ? 'opacity-60' : ''}`}>
                  <td className="px-2 py-0.5"><input type="checkbox" checked={selectedIds.has(f.id)} onChange={() => toggleSelect(f.id)} className="accent-amber-500 cursor-pointer" /></td>
                  <td className="px-1 py-0.5">
                    {f.private && <span title="Private"><Skull size={11} className="text-red-500" /></span>}
                  </td>
                  <td className={`px-2 py-0.5 ${cellMuted}`}>{formatDate(f.dateAdded)}</td>
                  <td className={`px-2 py-0.5 ${cellBase}`}>{f.charterers}</td>
                  <td className={`px-2 py-0.5 ${cellMuted}`}>{f.qty}</td>
                  <td className={`px-2 py-0.5 ${cellMuted}`}>{f.grade}</td>
                  <td className={`px-2 py-0.5 ${cellBase}`}>{f.loadPort}</td>
                  <td className={`px-2 py-0.5 ${cellBase}`}>{f.dischargePort}</td>
                  <td className={`px-2 py-0.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{displayLaycan(f.laycan)}</td>
                  <td className={`px-2 py-0.5 ${cellBase}`}>{f.vessel}</td>
                  <td className={`px-2 py-0.5 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>{f.rate}</td>
                  <td className={`px-2 py-0.5 font-semibold ${STATUS_TEXT[f.status] || cellMuted}`}>{f.status || '--'}</td>
                  <td className={`px-2 py-0.5 ${cellMuted}`}>{f.dem}</td>
                  <td className={`px-2 py-0.5 ${cellMuted} truncate max-w-[120px]`} title={f.comments}>{f.comments}</td>
                  <td className={`px-2 py-0.5 ${cellMuted}`}>{f.area}</td>
                  <td className="px-2 py-0.5 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => onEdit(f)} className={`${isDark ? 'text-gray-600 hover:text-amber-500' : 'text-slate-400 hover:text-amber-600'} transition-colors`}><Edit3 size={11} /></button>
                      <button onClick={() => onDelete(f.id)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'} transition-colors`}><Trash2 size={11} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
