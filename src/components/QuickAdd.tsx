import { useState, useEffect, useRef } from 'react';
import type { Fixture, Status, Area, Anagrafiche } from '../types';
import { parseLaycan } from '../utils/laycanParser';
import { detectArea } from '../utils/areaMapper';
import { generateId, todayISO } from '../utils/helpers';
import AutocompleteInput from './AutocompleteInput';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface QuickAddProps {
  anagrafiche: Anagrafiche;
  fixtures: Fixture[];
  onAdd: (fixture: Fixture) => void;
  onReplaceFixture: (oldId: string, newFixture: Fixture) => void;
  onAddVesselOwner: (vesselName: string, owner: string, dwt: string, yob?: string) => void;
  onAddCharterer: (name: string) => void;
  onAddGrade: (name: string) => void;
  onAddPortMapping: (portName: string, area: Area) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const STATUSES: Status[] = ['', 'OPEN', 'SUBS', 'FIXED', 'FAILED', 'REPLACED'];

const initialForm = {
  charterers: '', qty: '', grade: '', loadPort: '', dischargePort: '',
  laycan: '', vessel: '', rate: '', status: '' as Status, dem: '', comments: '',
};

type PopupState =
  | { type: 'area'; portName: string; pendingPorts: string[] }
  | { type: 'owner'; vessel: string }
  | { type: 'vesselMeta'; vessel: string; owner: string; dwt: string; yob: string }
  | { type: 'duplicate'; vessel: string; existingFixture: Fixture; newFixture: Fixture }
  | { type: 'validation'; missingFields: string[] }
  | null;

export default function QuickAdd({ anagrafiche, fixtures, onAdd, onReplaceFixture, onAddVesselOwner, onAddCharterer, onAddGrade, onAddPortMapping, searchQuery, onSearchChange }: QuickAddProps) {
  const [form, setForm] = useState(initialForm);
  const [popup, setPopup] = useState<PopupState>(null);
  const [ownerInput, setOwnerInput] = useState('');
  const [dwtInput, setDwtInput] = useState('');
  const [yobInput, setYobInput] = useState('');
  const [vesselFirstMode, setVesselFirstMode] = useState(false);

  /** Keep table search in sync with charterer + vessel fields — must not run inside setForm updaters (that updates App during QuickAdd state commit). */
  const skipLiveSearchSync = useRef(true);
  useEffect(() => {
    if (skipLiveSearchSync.current) {
      skipLiveSearchSync.current = false;
      return;
    }
    const live = `${form.charterers} ${form.vessel}`.trim();
    onSearchChange(live);
  }, [form.charterers, form.vessel, onSearchChange]);

  function handleQtyChange(val: string) { setForm(f => ({ ...f, qty: val.replace(/[^0-9]/g, '') })); }
  function handleGradeChange(val: string) { setForm(f => ({ ...f, grade: val.replace(/[^A-Za-z\s]/g, '') })); }

  function handleVesselChange(v: string) {
    setForm(f => ({ ...f, vessel: v }));
    const existing = anagrafiche.vesselOwners.find(vo => vo.vesselName === v.trim().toUpperCase());
    if (existing && (!existing.owner || !existing.dwt || !existing.yob)) {
      setOwnerInput(existing.owner || '');
      setDwtInput(existing.dwt || '');
      setYobInput(existing.yob || '');
    }
  }

  function handleLoadPortChange(v: string) {
    setForm(f => ({ ...f, loadPort: v }));
    // Auto-resolve area in background when possible.
    const first = v.split('-')[0]?.trim().toUpperCase() || '';
    if (first) detectArea(first, anagrafiche.portMappings);
  }

  // Blur/Tab: ONLY sync to Master Data and trigger metadata popups. Does NOT save the fixture.
  function handleChartererBlur() {
    const val = form.charterers.trim().toUpperCase();
    if (val && !anagrafiche.charterers.includes(val)) onAddCharterer(val);
  }
  function handleGradeBlur() {
    const val = form.grade.trim().toUpperCase().replace(/[^A-Z\s]/g, '');
    if (val && !anagrafiche.grades.includes(val)) onAddGrade(val);
  }
  function handleVesselBlur() {
    const val = form.vessel.trim().toUpperCase();
    if (!val) return;
    const existing = anagrafiche.vesselOwners.find(vo => vo.vesselName === val);
    if (!existing) {
      // Trigger owner popup - just to collect metadata, not to save
      setPopup({ type: 'owner', vessel: val });
    } else if (!existing.dwt || !existing.yob || !existing.owner) {
      setOwnerInput(existing.owner || '');
      setDwtInput(existing.dwt || '');
      setYobInput(existing.yob || '');
      setPopup({ type: 'vesselMeta', vessel: val, owner: existing.owner || '', dwt: existing.dwt || '', yob: existing.yob || '' });
    }
  }
  function handleLoadPortBlur() {
    const val = form.loadPort.trim().toUpperCase();
    if (!val) return;
    const ports = val.split('-').map(p => p.trim()).filter(Boolean);
    const missingPorts = ports.filter(p => !anagrafiche.portMappings.find(pm => pm.portName === p));
    if (missingPorts.length > 0) {
      setPopup({ type: 'area', portName: missingPorts[0], pendingPorts: missingPorts });
    }
  }
  function handleDischPortBlur() {
    const val = form.dischargePort.trim().toUpperCase();
    if (!val) return;
    const ports = val.split('-').map(p => p.trim()).filter(Boolean);
    const missingPorts = ports.filter(p => !anagrafiche.portMappings.find(pm => pm.portName === p));
    if (missingPorts.length > 0) {
      setPopup({ type: 'area', portName: missingPorts[0], pendingPorts: missingPorts });
    }
  }

  // ENTER or ADD button: validate and save
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validation: block if required fields are missing (ONLY on ENTER/Save)
    const missing: string[] = [];
    if (!form.charterers.trim()) missing.push('Charterer');
    if (!form.qty.trim()) missing.push('Qty');
    if (!form.grade.trim()) missing.push('Grade');
    if (!form.loadPort.trim()) missing.push('Load Port');
    if (!form.dischargePort.trim()) missing.push('Disch Port');
    if (missing.length > 0) {
      setPopup({ type: 'validation', missingFields: missing });
      return;
    }

    const laycan = parseLaycan(form.laycan);
    const firstPort = form.loadPort.split('-')[0].trim().toUpperCase();
    const area = detectArea(firstPort, anagrafiche.portMappings);

    const fixture: Fixture = {
      id: generateId(), dateAdded: todayISO(),
      charterers: form.charterers.toUpperCase(),
      qty: form.qty,
      loadPort: form.loadPort.toUpperCase(),
      dischargePort: form.dischargePort.toUpperCase(),
      laycan, vessel: form.vessel.toUpperCase(),
      rate: form.rate.trim().toUpperCase(),
      status: form.status,
      grade: form.grade.toUpperCase().replace(/[^A-Z\s]/g, ''),
      area: area || 'Other',
      dem: form.dem.toUpperCase(),
      comments: form.comments.toUpperCase(),
      position: '', openDate: '',
      editHistory: [], archived: false, private: false,
    };

    // Duplicate check: ONLY if vessel is filled
    if (fixture.vessel) {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const cutoff = fourteenDaysAgo.toISOString().split('T')[0];
      const duplicate = fixtures.find(f => f.vessel === fixture.vessel && f.dateAdded >= cutoff && !f.archived);
      if (duplicate) {
        setPopup({ type: 'duplicate', vessel: fixture.vessel, existingFixture: duplicate, newFixture: fixture });
        return;
      }
    }

    onAdd(fixture);
    setForm({ ...initialForm });
    onSearchChange('');
    setPopup(null);
  }

  function handleAreaSelect(area: Area) {
    if (popup?.type === 'area') {
      onAddPortMapping(popup.portName, area);
      const remaining = popup.pendingPorts.filter(p => p !== popup.portName);
      const nextMissing = remaining.filter(p => !anagrafiche.portMappings.find(pm => pm.portName === p));
      if (nextMissing.length > 0) {
        setPopup({ type: 'area', portName: nextMissing[0], pendingPorts: nextMissing });
        return;
      }
      setPopup(null);
    }
  }

  function handleOwnerSubmit() {
    if (popup?.type === 'owner') {
      const owner = ownerInput.trim().toUpperCase();
      setPopup({ type: 'vesselMeta', vessel: popup.vessel, owner, dwt: '', yob: '' });
    }
  }
  function handleOwnerSkip() {
    if (popup?.type === 'owner') {
      setPopup({ type: 'vesselMeta', vessel: popup.vessel, owner: '', dwt: '', yob: '' });
    }
  }
  function handleVesselMetaSubmit() {
    if (popup?.type === 'vesselMeta') {
      onAddVesselOwner(popup.vessel, ownerInput.trim().toUpperCase(), dwtInput.trim(), yobInput.trim());
      setPopup(null);
      setOwnerInput('');
      setDwtInput('');
      setYobInput('');
    }
  }
  function handleVesselMetaSkip() {
    if (popup?.type === 'vesselMeta') {
      setPopup(null);
      setOwnerInput('');
      setDwtInput('');
      setYobInput('');
    }
  }
  function handleDuplicateReplace() {
    if (popup?.type === 'duplicate') { onReplaceFixture(popup.existingFixture.id, popup.newFixture); setForm({ ...initialForm }); onSearchChange(''); setPopup(null); }
  }
  function handleDuplicateKeepBoth() { if (popup?.type === 'duplicate') { onAdd(popup.newFixture); setForm({ ...initialForm }); onSearchChange(''); setPopup(null); } }
  function handleDuplicateIgnore() { setPopup(null); }

  const isDark = document.documentElement.classList.contains('dark');
  const inputCls = `${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-2 py-1 text-xs focus:border-amber-500 focus:outline-none w-full rounded-sm`;
  const modalBg = isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200';
  const textMuted = isDark ? 'text-gray-400' : 'text-slate-500';

  return (
    <>
      <div className={`${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'} border-b p-2.5`}>
        {/* Data Entry Form */}
        <form onSubmit={handleSubmit}>
          <div className="flex items-end gap-1.5 text-xs flex-wrap">
            {vesselFirstMode && (
              <div className="flex flex-col gap-0.5 w-[100px]">
                <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>VESSEL</span>
                <div className="flex items-center gap-1">
                  <div className="flex-1">
                    <AutocompleteInput value={form.vessel} onChange={handleVesselChange} onBlur={handleVesselBlur} suggestions={anagrafiche.vessels} placeholder="VESSEL" className={inputCls} />
                  </div>
                  {form.vessel.trim() && (() => { const vo = anagrafiche.vesselOwners.find(v => v.vesselName === form.vessel.trim().toUpperCase()); return !vo || !vo.owner || !vo.dwt || !vo.yob; })() && <AlertTriangle size={12} className="text-yellow-500" />}
                </div>
              </div>
            )}
            {!vesselFirstMode && <div className="flex flex-col gap-0.5 w-[100px]">
              <div className="flex items-center justify-between">
                <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>CHARTERER*</span>
                <button type="button" tabIndex={-1} onClick={() => setVesselFirstMode(v => !v)} className={`${isDark ? 'text-gray-500 hover:text-amber-400' : 'text-slate-400 hover:text-amber-600'} text-[10px]`} title="Toggle input order">⇅</button>
              </div>
              <AutocompleteInput value={form.charterers} onChange={v => setForm(f => ({ ...f, charterers: v }))} onBlur={handleChartererBlur} suggestions={anagrafiche.charterers} placeholder="CHARTERER" className={inputCls} />
            </div>}
            {vesselFirstMode && <div className="flex flex-col gap-0.5 w-[24px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>&nbsp;</span>
              <button type="button" tabIndex={-1} onClick={() => setVesselFirstMode(v => !v)} className={`${isDark ? 'text-gray-500 hover:text-amber-400' : 'text-slate-400 hover:text-amber-600'} text-[12px] border ${isDark ? 'border-gray-700' : 'border-slate-200'} h-[26px] rounded-sm`} title="Toggle input order">⇅</button>
            </div>}
            <div className="flex flex-col gap-0.5 w-[48px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>QTY*</span>
              <input type="text" value={form.qty} onChange={e => handleQtyChange(e.target.value)} placeholder="QTY" className={inputCls} />
            </div>
            <div className="flex flex-col gap-0.5 w-[72px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>GRADE*</span>
              <input type="text" value={form.grade} onChange={e => handleGradeChange(e.target.value)} onBlur={handleGradeBlur} placeholder="GRADE" className={inputCls} />
            </div>
            {vesselFirstMode && (
              <div className="flex flex-col gap-0.5 w-[88px]">
                <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>LAYCAN</span>
                <input type="text" value={form.laycan} onChange={e => setForm(f => ({ ...f, laycan: e.target.value.toUpperCase() }))} placeholder="12-14/05" className={inputCls} />
              </div>
            )}
            <div className="flex flex-col gap-0.5 w-[100px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>LOAD PORT*</span>
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <AutocompleteInput value={form.loadPort} onChange={handleLoadPortChange} onBlur={handleLoadPortBlur} suggestions={anagrafiche.loadPorts} placeholder="LOAD PORT" className={inputCls} />
                </div>
                {form.loadPort.trim() && form.loadPort.split('-').map(p => p.trim()).filter(Boolean).some(p => !anagrafiche.portMappings.find(pm => pm.portName === p)) && <AlertTriangle size={12} className="text-yellow-500" />}
              </div>
            </div>
            <div className="flex flex-col gap-0.5 w-[100px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>DISCH PORT*</span>
              <div className="flex items-center gap-1">
                <div className="flex-1">
                  <AutocompleteInput value={form.dischargePort} onChange={v => setForm(f => ({ ...f, dischargePort: v }))} onBlur={handleDischPortBlur} suggestions={anagrafiche.dischargePorts} placeholder="DISCH PORT" className={inputCls} />
                </div>
                {form.dischargePort.trim() && form.dischargePort.split('-').map(p => p.trim()).filter(Boolean).some(p => !anagrafiche.portMappings.find(pm => pm.portName === p)) && <AlertTriangle size={12} className="text-yellow-500" />}
              </div>
            </div>
            {!vesselFirstMode && <div className="flex flex-col gap-0.5 w-[88px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>LAYCAN</span>
              <input type="text" value={form.laycan} onChange={e => setForm(f => ({ ...f, laycan: e.target.value.toUpperCase() }))} placeholder="12-14/05" className={inputCls} />
            </div>}
            {!vesselFirstMode && (
              <div className="flex flex-col gap-0.5 w-[100px]">
                <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>VESSEL</span>
                <div className="flex items-center gap-1">
                  <div className="flex-1">
                    <AutocompleteInput value={form.vessel} onChange={handleVesselChange} onBlur={handleVesselBlur} suggestions={anagrafiche.vessels} placeholder="VESSEL" className={inputCls} />
                  </div>
                  {form.vessel.trim() && (() => { const vo = anagrafiche.vesselOwners.find(v => v.vesselName === form.vessel.trim().toUpperCase()); return !vo || !vo.owner || !vo.dwt || !vo.yob; })() && <AlertTriangle size={12} className="text-yellow-500" />}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-0.5 w-[72px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>RATE</span>
              <input type="text" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value.toUpperCase() }))} placeholder="WS 100" className={inputCls} />
            </div>
            {vesselFirstMode && (
              <div className="flex flex-col gap-0.5 w-[100px]">
                <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>CHARTERER*</span>
                <AutocompleteInput value={form.charterers} onChange={v => setForm(f => ({ ...f, charterers: v }))} onBlur={handleChartererBlur} suggestions={anagrafiche.charterers} placeholder="CHARTERER" className={inputCls} />
              </div>
            )}
            <div className="flex flex-col gap-0.5 w-[56px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>STATUS</span>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))} className={inputCls}>
                {STATUSES.map(s => <option key={s || '_empty_'} value={s}>{s || '--'}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-0.5 w-[56px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>DEM</span>
              <input type="text" value={form.dem} onChange={e => setForm(f => ({ ...f, dem: e.target.value.toUpperCase() }))} placeholder="DEM" className={inputCls} />
            </div>
            <div className="flex flex-col gap-0.5 w-[120px]">
              <span className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[9px] font-medium`}>COMMENTS</span>
              <input type="text" value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value.toUpperCase() }))} placeholder="COMMENTS" className={inputCls} />
            </div>
            <div className="flex items-end">
              <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1 text-xs font-semibold tracking-wider transition-colors rounded-sm">ADD</button>
            </div>
          </div>
        </form>

        {searchQuery && <div className={`mt-1 text-[9px] ${textMuted}`}>Filtering by Quick Add input</div>}
      </div>

      {/* Validation Alert - only on ENTER */}
      {popup?.type === 'validation' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-gray-900 border-red-800' : 'bg-white border-red-300'} border p-6 max-w-md w-full rounded-lg`}>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={18} className="text-red-500" />
              <h3 className="text-red-500 font-semibold text-sm">REQUIRED FIELDS MISSING</h3>
            </div>
            <p className={`${textMuted} text-xs mb-3`}>The following fields must be filled before saving:</p>
            <ul className="list-disc list-inside mb-4">
              {popup.missingFields.map(f => (
                <li key={f} className="text-red-400 text-xs font-medium">{f}</li>
              ))}
            </ul>
            <button onClick={() => setPopup(null)} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-semibold transition-colors rounded-sm">OK</button>
          </div>
        </div>
      )}

      {/* Area Prompt - metadata only, does not save fixture */}
      {popup?.type === 'area' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className={`${modalBg} border p-6 max-w-md w-full rounded-lg`}>
            <h3 className={`font-semibold text-sm mb-2 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>AREA NOT RECOGNIZED</h3>
            <p className={`${textMuted} text-xs mb-4`}>Select area for port: <span className="font-medium">{popup.portName}</span></p>
            {popup.pendingPorts.length > 1 && <p className={`${isDark ? 'text-gray-600' : 'text-slate-400'} text-[10px] mb-3`}>Remaining ports to assign: {popup.pendingPorts.filter(p => p !== popup.portName).join(', ')}</p>}
            <div className="grid grid-cols-3 gap-2">
              {(['MEG', 'Red Sea', 'Indonesia', 'Med', 'Continent', 'WAfrica', 'Caribs', 'WAmerica', 'Other'] as Area[]).map(a => (
                <button key={a} onClick={() => handleAreaSelect(a)} className={`${isDark ? 'bg-gray-800 hover:bg-amber-600 text-gray-300 border-gray-600' : 'bg-slate-50 hover:bg-amber-500 text-slate-600 border-slate-200'} hover:text-white px-3 py-2 text-xs border hover:border-amber-500 transition-colors rounded`}>{a}</button>
              ))}
            </div>
            <button onClick={() => setPopup(null)} className={`mt-4 ${textMuted} text-xs`}>Cancel</button>
          </div>
        </div>
      )}

      {/* Owner Prompt - metadata only */}
      {popup?.type === 'owner' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className={`${modalBg} border p-6 max-w-md w-full rounded-lg`}>
            <h3 className={`font-semibold text-sm mb-2 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>OWNER NOT FOUND</h3>
            <p className={`${textMuted} text-xs mb-4`}>No Owner found for <span className="font-medium">{popup.vessel}</span>. Enter Owner name:</p>
            <input type="text" value={ownerInput} onChange={e => setOwnerInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleOwnerSubmit()} placeholder="Owner name..." className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs focus:border-amber-500 focus:outline-none w-full mb-4 rounded`} autoFocus />
            <div className="flex gap-2">
              <button onClick={handleOwnerSubmit} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-semibold transition-colors rounded-sm">SAVE OWNER</button>
              <button onClick={handleOwnerSkip} className={`${isDark ? 'text-gray-500 hover:text-gray-300 border-gray-600' : 'text-slate-400 hover:text-slate-600 border-slate-200'} px-4 py-2 text-xs border transition-colors rounded-sm`}>SKIP</button>
            </div>
          </div>
        </div>
      )}

      {/* DWT Prompt - metadata only */}
      {popup?.type === 'vesselMeta' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className={`${modalBg} border p-6 max-w-md w-full rounded-lg`}>
            <h3 className={`font-semibold text-sm mb-2 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>VESSEL METADATA REQUIRED</h3>
            <p className={`${textMuted} text-xs mb-4`}>Owner, DWT and YOB are mandatory for <span className="font-medium">{popup.vessel}</span>.</p>
            <input type="text" value={ownerInput} onChange={e => setOwnerInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && handleVesselMetaSubmit()} placeholder="Owner" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs focus:border-amber-500 focus:outline-none w-full mb-2 rounded`} autoFocus={!ownerInput} />
            <input type="text" value={dwtInput} onChange={e => setDwtInput(e.target.value.replace(/[^0-9]/g, ''))} onKeyDown={e => e.key === 'Enter' && handleVesselMetaSubmit()} placeholder="DWT (000s)" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs focus:border-amber-500 focus:outline-none w-full mb-2 rounded`} autoFocus={!!ownerInput && !dwtInput} />
            <input type="text" value={yobInput} onChange={e => setYobInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} onKeyDown={e => e.key === 'Enter' && handleVesselMetaSubmit()} placeholder="YOB (YYYY)" className={`${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs focus:border-amber-500 focus:outline-none w-full mb-4 rounded`} />
            <div className="flex gap-2">
              <button onClick={handleVesselMetaSubmit} className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 text-xs font-semibold transition-colors rounded-sm">SAVE</button>
              <button onClick={handleVesselMetaSkip} className={`${isDark ? 'text-gray-500 hover:text-gray-300 border-gray-600' : 'text-slate-400 hover:text-slate-600 border-slate-200'} px-4 py-2 text-xs border transition-colors rounded-sm`}>SKIP</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Prompt */}
      {popup?.type === 'duplicate' && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className={`${isDark ? 'bg-gray-900 border-red-800' : 'bg-white border-red-300'} border p-6 max-w-md w-full rounded-lg`}>
            <h3 className="text-red-500 font-semibold text-sm mb-2">VESSEL GIA A SOGGETTI</h3>
            <p className={`${textMuted} text-xs mb-2`}><span className="font-medium">{popup.vessel}</span> was already entered within the last 14 days.</p>
            <p className={`${isDark ? 'text-gray-600' : 'text-slate-400'} text-[10px] mb-4`}>Previous: {popup.existingFixture.charterers} / {popup.existingFixture.loadPort} / {popup.existingFixture.laycan}</p>
            <div className="flex gap-2">
              <button onClick={handleDuplicateReplace} className="bg-red-700 hover:bg-red-600 text-white px-3 py-2 text-xs font-semibold transition-colors rounded-sm">REPLACE</button>
              <button onClick={handleDuplicateKeepBoth} className={`${isDark ? 'bg-gray-700 hover:bg-gray-600' : 'bg-slate-200 hover:bg-slate-300'} text-white px-3 py-2 text-xs font-semibold transition-colors rounded-sm`}>KEEP BOTH</button>
              <button onClick={handleDuplicateIgnore} className={`${isDark ? 'bg-gray-800 hover:bg-gray-700 border-gray-600' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'} text-gray-400 px-3 py-2 text-xs font-semibold border transition-colors rounded-sm`}>IGNORE</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
