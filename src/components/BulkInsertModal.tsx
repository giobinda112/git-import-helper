import { useState } from 'react';
import type { Fixture, Status, Anagrafiche } from '../types';
import { parseLaycan } from '../utils/laycanParser';
import { detectArea } from '../utils/areaMapper';
import { generateId, todayISO } from '../utils/helpers';
import { X, Upload, Trash2 } from 'lucide-react';

interface BulkInsertModalProps {
  anagrafiche: Anagrafiche;
  onBulkAdd: (fixtures: Fixture[]) => void;
  onClose: () => void;
}

interface ParsedRow {
  raw: string;
  fixture: Fixture | null;
  error: string;
}

const STATUS_KEYWORDS: Record<string, Status> = {
  FLD: 'FAILED',
  FAILED: 'FAILED',
  SUBS: 'SUBS',
  SUB: 'SUBS',
  FIXED: 'FIXED',
  FXT: 'FIXED',
  REPLACED: 'REPLACED',
  RPL: 'REPLACED',
};

function parseRawText(text: string, anagrafiche: Anagrafiche): ParsedRow[] {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const raw = line.trim();
    if (!raw) return { raw, fixture: null, error: 'Empty line' };

    // Strict mapping: Charterer | Qty | Grade | LoadPort | DischPort | Laycan | Vessel | Rate | Status
    let parts = raw.includes('|')
      ? raw.split('|').map(p => p.trim())
      : raw.includes('\t')
        ? raw.split('\t').map(p => p.trim())
        : raw.split(/\s{2,}/).map(p => p.trim()).filter(Boolean);

    // If still not enough parts, try single-space split for short lines
    if (parts.length < 3) {
      parts = raw.split(/\s+/).map(p => p.trim()).filter(Boolean);
    }

    if (parts.length < 3) {
      return { raw, fixture: null, error: 'Not enough fields' };
    }

    if (parts.length >= 9) {
      const normalized = parts.slice(0, 9).map(p => (p === '-' || p === '--' ? '' : p.toUpperCase()));
      const [charterers, qty, grade, loadPort, dischargePort, laycanRaw, vessel, rate, statusRaw] = normalized;
      const status = (STATUS_KEYWORDS[statusRaw] || (statusRaw as Status) || '') as Status;
      const parsedLaycan = laycanRaw ? parseLaycan(laycanRaw) : '';
      const firstPort = loadPort.split('-')[0]?.trim() || '';
      const area = firstPort ? detectArea(firstPort, anagrafiche.portMappings) : null;
      const fixture: Fixture = {
        id: generateId(),
        dateAdded: todayISO(),
        charterers,
        qty: qty.replace(/[^0-9]/g, ''),
        loadPort,
        dischargePort,
        laycan: parsedLaycan,
        vessel,
        rate,
        status,
        grade: grade.replace(/[^A-Z\s]/g, ''),
        area: area || 'Other',
        dem: '',
        comments: '',
        position: '',
        openDate: '',
        editHistory: [],
        archived: false,
        private: false,
      };
      return { raw, fixture, error: '' };
    }

    // Extract status from any field
    let detectedStatus: Status = '';
    const cleanedParts = parts.map(part => {
      const upper = part.toUpperCase();
      for (const [keyword, status] of Object.entries(STATUS_KEYWORDS)) {
        if (upper === keyword || upper.includes(`-${keyword}`) || upper.includes(`${keyword}-`)) {
          if (!detectedStatus) detectedStatus = status;
          // Remove the status keyword from the field
          return upper.replace(keyword, '').replace(/^-|-$/g, '').trim();
        }
      }
      return part;
    }).filter(Boolean);

    // RNR stays in rate field - don't treat it as status

    // Try to map fields heuristically
    // Common patterns: Charterer Qty Grade LoadPort DischPort Laycan Vessel Rate [Status]
    // Or: Date Charterer Qty LoadPort DischPort Laycan Vessel Rate Status Grade
    let charterers = '';
    let qty = '';
    let grade = '';
    let loadPort = '';
    let dischargePort = '';
    let laycan = '';
    let vessel = '';
    let rate = '';
    let status = detectedStatus;

    // Simple heuristic: try to identify fields by content
    const datePattern = /^\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?$/;
    const laycanPattern = /^\d{1,2}[-–]\d{1,2}[\/]\d{1,2}$/i;
    const ratePattern = /^(WS|USD|RNR)\s*\d*/i;
    const qtyPattern = /^\d{1,3}K?$/i;

    const usedIndices = new Set<number>();

    // Find laycan
    for (let i = 0; i < cleanedParts.length; i++) {
      if (laycanPattern.test(cleanedParts[i]) || /^\d{1,2}[-–]\d{1,2}\/(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC|\d{2})$/i.test(cleanedParts[i])) {
        laycan = cleanedParts[i].toUpperCase();
        usedIndices.add(i);
        break;
      }
    }

    // Find rate
    for (let i = 0; i < cleanedParts.length; i++) {
      if (usedIndices.has(i)) continue;
      if (ratePattern.test(cleanedParts[i]) || cleanedParts[i].toUpperCase() === 'RNR') {
        rate = cleanedParts[i].toUpperCase();
        usedIndices.add(i);
        break;
      }
    }

    // Find qty
    for (let i = 0; i < cleanedParts.length; i++) {
      if (usedIndices.has(i)) continue;
      if (qtyPattern.test(cleanedParts[i])) {
        qty = cleanedParts[i].toUpperCase();
        usedIndices.add(i);
        break;
      }
    }

    // Find date (skip it - we auto-fill)
    for (let i = 0; i < cleanedParts.length; i++) {
      if (usedIndices.has(i)) continue;
      if (datePattern.test(cleanedParts[i])) {
        usedIndices.add(i);
        break;
      }
    }

    // Remaining fields: assign by position
    const remaining = cleanedParts.filter((_, i) => !usedIndices.has(i));

    if (remaining.length >= 1) charterers = remaining[0] || '';
    if (remaining.length >= 2) qty = qty || remaining[1];
    if (remaining.length >= 3) grade = remaining[2] || '';
    if (remaining.length >= 4) loadPort = remaining[3] || '';
    if (remaining.length >= 5) dischargePort = remaining[4] || '';
    if (remaining.length >= 6 && !laycan) laycan = remaining[5] || '';
    if (remaining.length >= 7) vessel = remaining[6] || '';
    if (remaining.length >= 8 && !rate) rate = remaining[7] || '';

    // If we have very few remaining parts, try a simpler mapping
    if (remaining.length <= 3 && !loadPort) {
      charterers = remaining[0] || '';
      if (remaining.length > 1) loadPort = remaining[1] || '';
      if (remaining.length > 2) dischargePort = remaining[2] || '';
    }

    const parsedLaycan = laycan ? parseLaycan(laycan) : '';
    const area = loadPort ? detectArea(loadPort, anagrafiche.portMappings) : null;

    const fixture: Fixture = {
      id: generateId(),
      dateAdded: todayISO(),
      charterers: charterers.toUpperCase(),
      qty: qty.toUpperCase(),
      loadPort: loadPort.toUpperCase(),
      dischargePort: dischargePort.toUpperCase(),
      laycan: parsedLaycan,
      vessel: vessel.toUpperCase(),
      rate: rate.toUpperCase(),
      status,
      grade: grade.toUpperCase(),
      area: area || 'Other',
      dem: '',
      comments: '',
      position: '',
      openDate: '',
      editHistory: [],
      archived: false,
      private: false,
    };

    return { raw, fixture, error: '' };
  });
}

export default function BulkInsertModal({ anagrafiche, onBulkAdd, onClose }: BulkInsertModalProps) {
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');

  function handleParse() {
    const result = parseRawText(rawText, anagrafiche);
    setParsed(result);
    setStep('preview');
  }

  function handleImport() {
    const validFixtures = parsed.filter(p => p.fixture).map(p => p.fixture!);
    if (validFixtures.length > 0) {
      onBulkAdd(validFixtures);
      onClose();
    }
  }

  function handleDeleteRow(index: number) {
    setParsed(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-600 w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h2 className="text-amber-500 font-bold text-sm font-mono tracking-wider">SMART BULK INSERT</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {step === 'input' && (
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-gray-400 text-xs font-mono mb-3">
              Paste raw fixture data below. One fixture per line. Fields can be separated by tabs or multiple spaces.
              Status keywords (FLD, SUBS, FIXED, REPLACED) will be auto-detected. RNR stays in Rate.
            </p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder={`Example:\nEXXON 80 FO RAS TANURA ROTTERDAM 12-14/05 MT EVEREST WS 100\nSHELL - FLD 50 GASOIL SIDI KERIR LAVRION 20-22/MAY ATLANTIC RNR\nBP 90 NAPHTHA FUJAIRAH MONGSTAD 01-03/06 PACIFIC VOYAGER USD 50K`}
              className="w-full h-64 bg-gray-800 border border-gray-600 text-gray-200 px-3 py-2 text-xs font-mono focus:border-amber-500 focus:outline-none resize-y"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handleParse}
                disabled={!rawText.trim()}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 text-xs font-mono font-bold transition-colors"
              >
                PARSE DATA
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <>
            <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
              <span className="text-gray-500 text-[10px] font-mono">
                {parsed.filter(p => p.fixture).length} valid / {parsed.filter(p => !p.fixture).length} errors
              </span>
              <div className="flex gap-2">
                <button onClick={() => setStep('input')} className="text-gray-500 hover:text-gray-300 px-3 py-1.5 text-xs font-mono border border-gray-600 transition-colors">
                  BACK
                </button>
                <button
                  onClick={handleImport}
                  disabled={parsed.filter(p => p.fixture).length === 0}
                  className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-1.5 text-xs font-mono font-bold flex items-center gap-2 transition-colors"
                >
                  <Upload size={12} />
                  IMPORT {parsed.filter(p => p.fixture).length} FIXTURES
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-[10px] font-mono">
                <thead className="sticky top-0 z-10 bg-gray-800">
                  <tr className="text-gray-500 border-b border-gray-700">
                    <th className="px-2 py-1.5 w-8"></th>
                    <th className="text-left px-2 py-1.5">CHARTERER</th>
                    <th className="text-left px-2 py-1.5">QTY</th>
                    <th className="text-left px-2 py-1.5">GRADE</th>
                    <th className="text-left px-2 py-1.5">LOAD PORT</th>
                    <th className="text-left px-2 py-1.5">DISCH PORT</th>
                    <th className="text-left px-2 py-1.5">LAYCAN</th>
                    <th className="text-left px-2 py-1.5">VESSEL</th>
                    <th className="text-left px-2 py-1.5">RATE</th>
                    <th className="text-left px-2 py-1.5">STATUS</th>
                    <th className="text-left px-2 py-1.5">AREA</th>
                    <th className="px-2 py-1.5 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.map((p, i) => (
                    <tr key={i} className={`border-b border-gray-800 ${p.fixture ? '' : 'bg-red-900/20'}`}>
                      <td className="px-2 py-1 text-center">
                        {p.fixture ? <span className="text-green-500">OK</span> : <span className="text-red-500">!</span>}
                      </td>
                      {p.fixture ? (
                        <>
                          <td className="px-2 py-1 text-gray-200">{p.fixture.charterers}</td>
                          <td className="px-2 py-1 text-gray-300">{p.fixture.qty}</td>
                          <td className="px-2 py-1 text-gray-300">{p.fixture.grade}</td>
                          <td className="px-2 py-1 text-gray-200">{p.fixture.loadPort}</td>
                          <td className="px-2 py-1 text-gray-200">{p.fixture.dischargePort}</td>
                          <td className="px-2 py-1 text-amber-400">{p.fixture.laycan}</td>
                          <td className="px-2 py-1 text-gray-200">{p.fixture.vessel}</td>
                          <td className="px-2 py-1 text-cyan-400">{p.fixture.rate}</td>
                          <td className="px-2 py-1 font-bold text-yellow-400">{p.fixture.status || '--'}</td>
                          <td className="px-2 py-1 text-gray-500">{p.fixture.area}</td>
                          <td className="px-2 py-1 text-right">
                            <button onClick={() => handleDeleteRow(i)} className="text-gray-500 hover:text-red-500">
                              <Trash2 size={11} />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td colSpan={11} className="px-2 py-1 text-red-400">{p.error}: <span className="text-gray-500">{p.raw}</span></td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
