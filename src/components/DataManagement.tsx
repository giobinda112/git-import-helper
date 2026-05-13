import { useState, useMemo } from 'react';
import type { Anagrafiche, Area } from '../types';
import { ALL_AREAS } from '../utils/areaMapper';
import { X, Plus, Trash2, Check, Search, Pencil } from 'lucide-react';

interface DataManagementProps {
  anagrafiche: Anagrafiche;
  onUpdate: (anagrafiche: Anagrafiche) => void;
  onClose: () => void;
}

type Tab = 'charterers' | 'grades' | 'vessels' | 'ports';

export default function DataManagement({ anagrafiche, onUpdate, onClose }: DataManagementProps) {
  const [tab, setTab] = useState<Tab>('vessels');
  const [newItem, setNewItem] = useState('');
  const [newVesselName, setNewVesselName] = useState('');
  const [newVesselOwner, setNewVesselOwner] = useState('');
  const [newVesselDwt, setNewVesselDwt] = useState('');
  const [newVesselYob, setNewVesselYob] = useState('');
  const [newPortName, setNewPortName] = useState('');
  const [newPortArea, setNewPortArea] = useState<Area>('MEG');
  const [newGrade, setNewGrade] = useState('');
  const [editingIndex, setEditingIndex] = useState<{ field: string; index: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [vesselGroupBy, setVesselGroupBy] = useState<'owner' | 'dwt' | 'alpha'>('alpha');

  const isDark = document.documentElement.classList.contains('dark');

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'vessels', label: 'VESSELS & OWNERS', count: anagrafiche.vesselOwners.length },
    { key: 'ports', label: 'PORT MANAGEMENT', count: anagrafiche.portMappings.length },
    { key: 'charterers', label: 'CHARTERERS', count: anagrafiche.charterers.length },
    { key: 'grades', label: 'GRADES', count: anagrafiche.grades.length },
  ];

  const searchResults = useMemo(() => {
    if (!globalSearch.trim()) return null;
    const q = globalSearch.toUpperCase();
    const match = (s: string) => s.toUpperCase().includes(q);
    type SearchResult = { label: string; section: string; onDelete: () => void; onEdit: () => void };
    const results: { section: string; items: SearchResult[] }[] = [];

    const c = anagrafiche.charterers.filter(match);
    if (c.length) results.push({
      section: 'CHARTERERS',
      items: c.map((item) => {
        const realIdx = anagrafiche.charterers.indexOf(item);
        return { label: item, section: 'CHARTERERS', onDelete: () => removeSimpleItem('charterers', realIdx), onEdit: () => startEdit('charterers', realIdx, item) };
      })
    });

    const g = anagrafiche.grades.filter(match);
    if (g.length) results.push({
      section: 'GRADES',
      items: g.map((item) => {
        const realIdx = anagrafiche.grades.indexOf(item);
        return { label: item, section: 'GRADES', onDelete: () => removeSimpleItem('grades', realIdx), onEdit: () => startEdit('grades', realIdx, item) };
      })
    });

    const vo = anagrafiche.vesselOwners.filter(vo => match(vo.vesselName) || match(vo.owner));
    if (vo.length) results.push({
      section: 'VESSELS & OWNERS',
      items: vo.map((item) => {
        const realIdx = anagrafiche.vesselOwners.indexOf(item);
        return { label: `${item.vesselName} -> ${item.owner} (DWT: ${item.dwt || '--'} | YOB: ${item.yob || '--'})`, section: 'VESSELS & OWNERS', onDelete: () => removeVesselOwner(realIdx), onEdit: () => {} };
      })
    });

    const pm = anagrafiche.portMappings.filter(pm => match(pm.portName) || match(pm.area));
    if (pm.length) results.push({
      section: 'PORTS',
      items: pm.map((item) => {
        const realIdx = anagrafiche.portMappings.indexOf(item);
        return { label: `${item.portName} -> ${item.area}`, section: 'PORTS', onDelete: () => removePortMapping(realIdx), onEdit: () => startEdit('portMappingName', realIdx, item.portName) };
      })
    });

    return results;
  }, [globalSearch, anagrafiche]);

  function addSimpleItem(field: 'charterers' | 'grades') {
    const val = newItem.trim().toUpperCase(); if (!val) return;
    const list = anagrafiche[field] as string[]; if (list.includes(val)) return;
    onUpdate({ ...anagrafiche, [field]: [...list, val].sort() }); setNewItem('');
  }

  function addVesselOwner() {
    const name = newVesselName.trim().toUpperCase(); if (!name) return;
    if (anagrafiche.vesselOwners.some(vo => vo.vesselName === name)) return;
    const dwt = newVesselDwt.replace(/[^0-9]/g, '');
    onUpdate({ ...anagrafiche, vesselOwners: [...anagrafiche.vesselOwners, { vesselName: name, owner: newVesselOwner.trim().toUpperCase() || '', dwt, yob: newVesselYob.replace(/[^0-9]/g, '').slice(0, 4) }].sort((a, b) => a.vesselName.localeCompare(b.vesselName)) });
    setNewVesselName(''); setNewVesselOwner(''); setNewVesselDwt(''); setNewVesselYob('');
  }

  function addPortMapping() {
    const name = newPortName.trim().toUpperCase(); if (!name) return;
    if (anagrafiche.portMappings.some(pm => pm.portName === name)) return;
    onUpdate({ ...anagrafiche, portMappings: [...anagrafiche.portMappings, { portName: name, area: newPortArea }].sort((a, b) => a.portName.localeCompare(b.portName)) }); setNewPortName('');
  }

  function removeSimpleItem(field: 'charterers' | 'grades', index: number) {
    const list = [...anagrafiche[field]]; list.splice(index, 1); onUpdate({ ...anagrafiche, [field]: list });
  }
  function removePortMapping(index: number) { const list = [...anagrafiche.portMappings]; list.splice(index, 1); onUpdate({ ...anagrafiche, portMappings: list }); }
  function removeVesselOwner(index: number) { const list = [...anagrafiche.vesselOwners]; list.splice(index, 1); onUpdate({ ...anagrafiche, vesselOwners: list }); }

  function updateVesselOwner(index: number, field: 'owner' | 'dwt' | 'vesselName' | 'yob', value: string) {
    const list = [...anagrafiche.vesselOwners];
    if (field === 'dwt') {
      list[index] = { ...list[index], dwt: value.replace(/[^0-9]/g, '') };
    } else if (field === 'yob') {
      list[index] = { ...list[index], yob: value.replace(/[^0-9]/g, '').slice(0, 4) };
    } else if (field === 'vesselName') {
      list[index] = { ...list[index], vesselName: value.toUpperCase() };
    } else {
      list[index] = { ...list[index], owner: value.toUpperCase() };
    }
    onUpdate({ ...anagrafiche, vesselOwners: list.sort((a, b) => a.vesselName.localeCompare(b.vesselName)) });
  }

  function startEdit(field: string, index: number, currentValue: string) { setEditingIndex({ field, index }); setEditValue(currentValue); }

  function confirmEdit() {
    if (!editingIndex) return;
    const { field, index } = editingIndex;
    const val = editValue.trim().toUpperCase(); if (!val) { setEditingIndex(null); return; }
    if (field === 'portMappingName') { const list = [...anagrafiche.portMappings]; list[index] = { ...list[index], portName: val }; onUpdate({ ...anagrafiche, portMappings: list }); }
    else if (field === 'portMappingArea') { const list = [...anagrafiche.portMappings]; list[index] = { ...list[index], area: val as Area }; onUpdate({ ...anagrafiche, portMappings: list }); }
    else { const list = [...(anagrafiche[field as keyof Anagrafiche] as string[])]; list[index] = val; onUpdate({ ...anagrafiche, [field]: list }); }
    setEditingIndex(null);
  }

  const inputCls = `${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none rounded-sm`;
  const editCls = `${isDark ? 'bg-gray-800 border-amber-500 text-gray-100' : 'bg-slate-50 border-amber-500 text-slate-800'} border px-2 py-1 text-xs focus:outline-none w-full rounded-sm`;

  const modalBg = isDark ? 'bg-gray-900' : 'bg-white';
  const borderCls = isDark ? 'border-gray-700' : 'border-slate-200';
  const textPrimary = isDark ? 'text-gray-200' : 'text-slate-700';
  const textMuted = isDark ? 'text-gray-400' : 'text-slate-500';
  const textAccent = isDark ? 'text-amber-400' : 'text-amber-600';
  const rowBg = isDark ? 'bg-gray-800/50' : 'bg-slate-50';
  const tabActive = isDark ? 'text-amber-400 border-amber-500 bg-amber-600/10' : 'text-amber-600 border-amber-500 bg-amber-50';
  const tabInactive = isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600';
  const searchBg = isDark ? 'bg-gray-800 border-gray-600 text-gray-200' : 'bg-slate-50 border-slate-300 text-slate-800';

  // Grouped vessel owners
  const groupedVessels = useMemo(() => {
    if (vesselGroupBy === 'alpha') return null;
    const groups: Record<string, typeof anagrafiche.vesselOwners> = {};
    for (const vo of anagrafiche.vesselOwners) {
      let key = '';
      if (vesselGroupBy === 'owner') key = vo.owner || 'NO OWNER';
      else if (vesselGroupBy === 'dwt') {
        const dwt = parseInt(vo.dwt, 10);
        if (isNaN(dwt) || dwt <= 0) key = 'NO DWT';
        else if (dwt >= 80 && dwt < 125) key = 'AFRAMAX (80-125)';
        else if (dwt >= 125 && dwt < 190) key = 'SUEZMAX (125-190)';
        else if (dwt >= 190) key = 'VLCC (190+)';
        else key = 'SMALL (<80)';
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(vo);
    }
    return groups;
  }, [anagrafiche.vesselOwners, vesselGroupBy]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className={`${modalBg} border ${isDark ? 'border-gray-600' : 'border-slate-200'} w-full max-w-3xl max-h-[80vh] flex flex-col rounded-lg`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${borderCls}`}>
          <h2 className={`font-semibold text-sm ${textAccent}`}>DATA MANAGEMENT</h2>
          <button onClick={onClose} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}><X size={16} /></button>
        </div>

        <div className={`px-4 py-2 border-b ${borderCls}`}>
          <div className="relative">
            <Search size={14} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
            <input type="text" value={globalSearch} onChange={e => setGlobalSearch(e.target.value.toUpperCase())} placeholder="Search across all data..." className={`w-full ${searchBg} border pl-8 pr-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none rounded-sm`} />
          </div>
        </div>

        {searchResults ? (
          <div className="flex-1 overflow-y-auto p-4">
            {searchResults.length === 0 && <p className={`${textMuted} text-xs text-center py-8`}>No results found</p>}
            {searchResults.map(sr => (
              <div key={sr.section} className="mb-4">
                <h3 className={`${textAccent} text-[10px] mb-1 tracking-wider`}>{sr.section}</h3>
                {sr.items.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between ${textPrimary} text-xs py-0.5 px-2 ${rowBg}`}>
                    <span className="flex-1 truncate">{item.label}</span>
                    <div className="flex gap-1 ml-2">
                      <button onClick={item.onEdit} className={`${isDark ? 'text-gray-600 hover:text-amber-500' : 'text-slate-400 hover:text-amber-600'} transition-colors`}><Pencil size={11} /></button>
                      <button onClick={item.onDelete} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'} transition-colors`}><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className={`flex border-b ${borderCls} overflow-x-auto`}>
              {tabs.map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setEditingIndex(null); }} className={`px-4 py-2 text-[10px] whitespace-nowrap transition-colors border-b-2 ${tab === t.key ? tabActive : `border-transparent ${tabInactive}`}`}>
                  {t.label} <span className={isDark ? 'text-gray-600' : 'text-slate-400'}>({t.count})</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {/* VESSELS & OWNERS - merged */}
              {tab === 'vessels' && (
                <>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newVesselName} onChange={e => setNewVesselName(e.target.value.toUpperCase())} placeholder="Vessel name..." className={`${inputCls} flex-1`} />
                    <input type="text" value={newVesselOwner} onChange={e => setNewVesselOwner(e.target.value.toUpperCase())} placeholder="Owner..." className={`${inputCls} flex-1`} />
                    <input type="text" value={newVesselDwt} onChange={e => setNewVesselDwt(e.target.value.replace(/[^0-9]/g, ''))} placeholder="DWT (000s)" className={`${inputCls} w-20`} />
                    <input type="text" value={newVesselYob} onChange={e => setNewVesselYob(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="YOB" className={`${inputCls} w-16`} />
                    <button onClick={addVesselOwner} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs rounded-sm"><Plus size={14} /></button>
                  </div>
                  <div className="flex gap-1 mb-3">
                    <button onClick={() => setVesselGroupBy('alpha')} className={`px-2 py-1 text-[9px] rounded-sm ${vesselGroupBy === 'alpha' ? 'bg-amber-600 text-white' : `${isDark ? 'text-gray-500' : 'text-slate-400'}`}`}>A-Z</button>
                    <button onClick={() => setVesselGroupBy('owner')} className={`px-2 py-1 text-[9px] rounded-sm ${vesselGroupBy === 'owner' ? 'bg-amber-600 text-white' : `${isDark ? 'text-gray-500' : 'text-slate-400'}`}`}>BY OWNER</button>
                    <button onClick={() => setVesselGroupBy('dwt')} className={`px-2 py-1 text-[9px] rounded-sm ${vesselGroupBy === 'dwt' ? 'bg-amber-600 text-white' : `${isDark ? 'text-gray-500' : 'text-slate-400'}`}`}>BY DWT</button>
                  </div>

                  {vesselGroupBy === 'alpha' ? (
                    <div className="space-y-1">
                      {anagrafiche.vesselOwners.map((vo, i) => (
                        <div key={i} className={`flex items-center gap-2 ${rowBg} px-3 py-1.5`}>
                          <input type="text" value={vo.vesselName} onChange={e => updateVesselOwner(i, 'vesselName', e.target.value)} className={`${inputCls} w-36`} />
                          <input type="text" value={vo.owner} onChange={e => updateVesselOwner(i, 'owner', e.target.value)} className={`${inputCls} flex-1`} placeholder="Owner..." />
                          <input type="text" value={vo.dwt} onChange={e => updateVesselOwner(i, 'dwt', e.target.value)} className={`${inputCls} w-16`} placeholder="DWT" />
                          <input type="text" value={vo.yob || ''} onChange={e => updateVesselOwner(i, 'yob', e.target.value)} className={`${inputCls} w-16`} placeholder="YOB" />
                          <button onClick={() => removeVesselOwner(i)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'}`}><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  ) : groupedVessels && Object.entries(groupedVessels).sort(([a], [b]) => a.localeCompare(b)).map(([group, items]) => (
                    <div key={group} className="mb-4">
                      <h4 className={`${textAccent} text-[10px] mb-1 tracking-wider`}>{group} ({items.length})</h4>
                      <div className="space-y-1 ml-2">
                        {items.map(vo => {
                          const i = anagrafiche.vesselOwners.indexOf(vo);
                          return (
                            <div key={i} className={`flex items-center gap-2 ${rowBg} px-3 py-1.5`}>
                              <input type="text" value={vo.vesselName} onChange={e => updateVesselOwner(i, 'vesselName', e.target.value)} className={`${inputCls} w-36`} />
                              <input type="text" value={vo.owner} onChange={e => updateVesselOwner(i, 'owner', e.target.value)} className={`${inputCls} flex-1`} placeholder="Owner..." />
                              <input type="text" value={vo.dwt} onChange={e => updateVesselOwner(i, 'dwt', e.target.value)} className={`${inputCls} w-16`} placeholder="DWT" />
                              <input type="text" value={vo.yob || ''} onChange={e => updateVesselOwner(i, 'yob', e.target.value)} className={`${inputCls} w-16`} placeholder="YOB" />
                              <button onClick={() => removeVesselOwner(i)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'}`}><Trash2 size={12} /></button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* PORT MANAGEMENT - merged */}
              {tab === 'ports' && (
                <>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newPortName} onChange={e => setNewPortName(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && addPortMapping()} placeholder="Port name..." className={`${inputCls} flex-1`} />
                    <select value={newPortArea} onChange={e => setNewPortArea(e.target.value as Area)} className={inputCls}>{ALL_AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select>
                    <button onClick={addPortMapping} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs rounded-sm"><Plus size={14} /></button>
                  </div>
                  <div className="space-y-1">
                    {anagrafiche.portMappings.map((pm, i) => (
                      <div key={i} className={`flex items-center gap-3 ${rowBg} px-3 py-1.5`}>
                        {editingIndex?.field === 'portMappingName' && editingIndex.index === i ? (
                          <div className="flex items-center gap-1 flex-1"><input type="text" value={editValue} onChange={e => setEditValue(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && confirmEdit()} className={editCls} autoFocus /><button onClick={confirmEdit} className="text-green-500 hover:text-green-400"><Check size={14} /></button></div>
                        ) : (
                          <span className={`${textPrimary} text-xs cursor-pointer hover:text-amber-500 transition-colors`} onDoubleClick={() => startEdit('portMappingName', i, pm.portName)} title="Double-click to edit">{pm.portName}</span>
                        )}
                        {editingIndex?.field === 'portMappingArea' && editingIndex.index === i ? (
                          <div className="flex items-center gap-1"><select value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && confirmEdit()} className={editCls} autoFocus>{ALL_AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select><button onClick={confirmEdit} className="text-green-500 hover:text-green-400"><Check size={14} /></button></div>
                        ) : (
                          <span className={`${textAccent} text-xs cursor-pointer hover:opacity-80 transition-opacity`} onDoubleClick={() => startEdit('portMappingArea', i, pm.area)} title="Double-click to edit area">{pm.area}</span>
                        )}
                        <button onClick={() => removePortMapping(i)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'} ml-auto`}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* CHARTERERS */}
              {tab === 'charterers' && (
                <>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newItem} onChange={e => setNewItem(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && addSimpleItem('charterers')} placeholder="Add new charterer..." className={`${inputCls} flex-1`} />
                    <button onClick={() => addSimpleItem('charterers')} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs rounded-sm"><Plus size={14} /></button>
                  </div>
                  <div className="space-y-1">
                    {anagrafiche.charterers.map((item, i) => (
                      <div key={i} className={`flex items-center justify-between ${rowBg} px-3 py-1.5 group`}>
                        {editingIndex?.field === 'charterers' && editingIndex.index === i ? (
                          <div className="flex items-center gap-1 flex-1"><input type="text" value={editValue} onChange={e => setEditValue(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && confirmEdit()} className={editCls} autoFocus /><button onClick={confirmEdit} className="text-green-500 hover:text-green-400"><Check size={14} /></button></div>
                        ) : (
                          <span className={`${textPrimary} text-xs cursor-pointer hover:text-amber-500 transition-colors flex-1`} onDoubleClick={() => startEdit('charterers', i, item)} title="Double-click to edit">{item}</span>
                        )}
                        <button onClick={() => removeSimpleItem('charterers', i)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'} ml-2`}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* GRADES */}
              {tab === 'grades' && (
                <>
                  <div className="flex gap-2 mb-4">
                    <input type="text" value={newGrade} onChange={e => setNewGrade(e.target.value.toUpperCase().replace(/[^A-Z\s]/g, ''))} onKeyDown={e => e.key === 'Enter' && (() => { const val = newGrade.trim(); if (!val) return; if (anagrafiche.grades.includes(val)) return; onUpdate({ ...anagrafiche, grades: [...anagrafiche.grades, val].sort() }); setNewGrade(''); })()} placeholder="Add new grade (letters only)..." className={`${inputCls} flex-1`} />
                    <button onClick={() => { const val = newGrade.trim(); if (!val) return; if (anagrafiche.grades.includes(val)) return; onUpdate({ ...anagrafiche, grades: [...anagrafiche.grades, val].sort() }); setNewGrade(''); }} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs rounded-sm"><Plus size={14} /></button>
                  </div>
                  <div className="space-y-1">
                    {anagrafiche.grades.map((item, i) => (
                      <div key={i} className={`flex items-center justify-between ${rowBg} px-3 py-1.5 group`}>
                        {editingIndex?.field === 'grades' && editingIndex.index === i ? (
                          <div className="flex items-center gap-1 flex-1"><input type="text" value={editValue} onChange={e => setEditValue(e.target.value.toUpperCase().replace(/[^A-Z\s]/g, ''))} onKeyDown={e => e.key === 'Enter' && confirmEdit()} className={editCls} autoFocus /><button onClick={confirmEdit} className="text-green-500 hover:text-green-400"><Check size={14} /></button></div>
                        ) : (
                          <span className={`${textPrimary} text-xs cursor-pointer hover:text-amber-500 transition-colors flex-1`} onDoubleClick={() => startEdit('grades', i, item)} title="Double-click to edit">{item}</span>
                        )}
                        <button onClick={() => removeSimpleItem('grades', i)} className={`${isDark ? 'text-gray-600 hover:text-red-500' : 'text-slate-400 hover:text-red-500'} ml-2`}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
