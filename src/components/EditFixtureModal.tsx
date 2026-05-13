import { useState } from 'react';
import type { Fixture, Status, Anagrafiche, FieldEdit } from '../types';
import { parseLaycan } from '../utils/laycanParser';
import { todayISO } from '../utils/helpers';
import AutocompleteInput from './AutocompleteInput';
import { X, Skull } from 'lucide-react';

interface EditFixtureModalProps {
  fixture: Fixture;
  anagrafiche: Anagrafiche;
  onSave: (fixture: Fixture) => void;
  onClose: () => void;
}

const STATUSES: Status[] = ['', 'SUBS', 'FIXED', 'FAILED', 'REPLACED'];

export default function EditFixtureModal({ fixture, anagrafiche, onSave, onClose }: EditFixtureModalProps) {
  const [form, setForm] = useState({ ...fixture });
  const isDark = document.documentElement.classList.contains('dark');
  const inputCls = `${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none w-full rounded-sm`;
  const borderCls = isDark ? 'border-gray-700' : 'border-slate-200';
  const textAccent = isDark ? 'text-amber-500' : 'text-amber-600';
  const textLabel = isDark ? 'text-gray-500' : 'text-slate-400';

  function handleQtyChange(val: string) {
    setForm(f => ({ ...f, qty: val.replace(/[^0-9]/g, '') }));
  }

  function handleGradeChange(val: string) {
    setForm(f => ({ ...f, grade: val.replace(/[^A-Za-z\s]/g, '') }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const today = todayISO();
    const trackedFields: (keyof Fixture)[] = ['charterers', 'qty', 'loadPort', 'dischargePort', 'laycan', 'vessel', 'rate', 'status', 'grade', 'area', 'dem', 'comments', 'position', 'openDate'];
    const newEdits: FieldEdit[] = [];

    for (const field of trackedFields) {
      const oldVal = (fixture[field] as string) || '';
      const newVal = field === 'laycan' ? parseLaycan(form[field]) : (form[field] as string).toUpperCase();
      if (oldVal !== newVal) {
        newEdits.push({ field, oldValue: oldVal, newValue: newVal, editedAt: today });
      }
    }

    onSave({
      ...form,
      laycan: parseLaycan(form.laycan),
      charterers: form.charterers.toUpperCase(),
      qty: form.qty,
      loadPort: form.loadPort.toUpperCase(),
      dischargePort: form.dischargePort.toUpperCase(),
      vessel: form.vessel.toUpperCase(),
      rate: form.rate.toUpperCase(),
      grade: form.grade.toUpperCase().replace(/[^A-Z\s]/g, ''),
      dem: form.dem.toUpperCase(),
      comments: form.comments.toUpperCase(),
      position: form.position.toUpperCase(),
      openDate: form.openDate.toUpperCase(),
      editHistory: [...fixture.editHistory, ...newEdits],
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border w-full max-w-2xl rounded-lg`}>
        <div className={`flex items-center justify-between px-4 py-3 border-b ${borderCls}`}>
          <h2 className={`font-semibold text-sm ${textAccent}`}>EDIT FIXTURE</h2>
          <button onClick={onClose} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'}`}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>DATE</span>
              <input type="date" value={form.dateAdded} onChange={e => setForm(f => ({ ...f, dateAdded: e.target.value }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>CHARTERER</span>
              <AutocompleteInput value={form.charterers} onChange={v => setForm(f => ({ ...f, charterers: v }))} suggestions={anagrafiche.charterers} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>QTY</span>
              <input type="text" value={form.qty} onChange={e => handleQtyChange(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>GRADE</span>
              <input type="text" value={form.grade} onChange={e => handleGradeChange(e.target.value)} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>LOAD PORT</span>
              <AutocompleteInput value={form.loadPort} onChange={v => setForm(f => ({ ...f, loadPort: v }))} suggestions={anagrafiche.loadPorts} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>DISCH PORT</span>
              <AutocompleteInput value={form.dischargePort} onChange={v => setForm(f => ({ ...f, dischargePort: v }))} suggestions={anagrafiche.dischargePorts} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>LAYCAN</span>
              <input type="text" value={form.laycan} onChange={e => setForm(f => ({ ...f, laycan: e.target.value.toUpperCase() }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>VESSEL</span>
              <AutocompleteInput value={form.vessel} onChange={v => setForm(f => ({ ...f, vessel: v }))} suggestions={anagrafiche.vessels} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>RATE</span>
              <input type="text" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value.toUpperCase() }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>STATUS</span>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))} className={inputCls}>
                {STATUSES.map(s => <option key={s || '_empty_'} value={s}>{s || '--'}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>DEM</span>
              <input type="text" value={form.dem} onChange={e => setForm(f => ({ ...f, dem: e.target.value.toUpperCase() }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>COMMENTS</span>
              <input type="text" value={form.comments} onChange={e => setForm(f => ({ ...f, comments: e.target.value.toUpperCase() }))} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>POSITION</span>
              <input type="text" value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value.toUpperCase() }))} placeholder="PORT/AREA" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>OPEN DATE</span>
              <input type="text" value={form.openDate} onChange={e => setForm(f => ({ ...f, openDate: e.target.value.toUpperCase() }))} placeholder="DD/MM" className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>AREA</span>
              <input type="text" value={form.area} readOnly className={`${inputCls} opacity-60`} />
            </div>
            <div className="flex flex-col gap-1">
              <span className={`${textLabel} text-[9px] font-medium`}>PRIVATE</span>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, private: !f.private }))}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-xs border rounded-sm transition-colors ${form.private ? 'border-red-500 bg-red-500/10 text-red-500' : `${isDark ? 'border-gray-600 text-gray-500 hover:border-gray-500' : 'border-slate-300 text-slate-400 hover:border-slate-400'}`}`}
              >
                <Skull size={12} /> {form.private ? 'PRIVATE' : 'PUBLIC'}
              </button>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'} px-4 py-1.5 text-xs`}>CANCEL</button>
            <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 text-xs font-semibold rounded-sm">SAVE</button>
          </div>
        </form>
      </div>
    </div>
  );
}
