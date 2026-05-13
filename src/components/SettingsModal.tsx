import { useState, useEffect } from 'react';
import { Settings, X, Link, Save, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  webhookUrl: string;
  onSaveWebhookUrl: (url: string) => void;
}

export default function SettingsModal({ isOpen, onClose, webhookUrl, onSaveWebhookUrl }: SettingsModalProps) {
  const [url, setUrl] = useState(webhookUrl);
  const [saved, setSaved] = useState(false);
  const isDark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    setUrl(webhookUrl);
    setSaved(false);
  }, [webhookUrl, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveWebhookUrl(url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setUrl('');
    onSaveWebhookUrl('');
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]" onClick={onClose}>
      <div 
        className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border p-6 max-w-lg w-full rounded-lg shadow-xl`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Settings size={16} className={isDark ? 'text-amber-500' : 'text-amber-600'} />
            <h3 className={`font-semibold text-sm tracking-wider ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>SETTINGS</h3>
          </div>
          <button 
            onClick={onClose} 
            className={`${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`flex items-center gap-2 text-xs font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-slate-600'}`}>
              <Link size={12} />
              GOOGLE SHEET WEBHOOK URL
            </label>
            <p className={`${isDark ? 'text-gray-500' : 'text-slate-400'} text-[10px] mb-2`}>
              Your Google Apps Script Web App URL for syncing fixtures data.
            </p>
            <input 
              type="text" 
              value={url} 
              onChange={e => setUrl(e.target.value)} 
              placeholder="https://script.google.com/macros/s/..." 
              className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100 placeholder-gray-600' : 'bg-slate-50 border-slate-300 text-slate-800 placeholder-slate-400'} border px-3 py-2 text-xs focus:border-amber-500 focus:outline-none rounded-sm`}
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button 
              onClick={handleSave}
              className={`flex items-center gap-1.5 ${saved ? 'bg-green-600' : 'bg-amber-600 hover:bg-amber-500'} text-white px-4 py-2 text-xs font-semibold transition-colors rounded-sm`}
            >
              <Save size={12} />
              {saved ? 'SAVED!' : 'SAVE'}
            </button>
            {url && (
              <button 
                onClick={handleClear}
                className={`flex items-center gap-1.5 ${isDark ? 'text-red-400 hover:text-red-300 border-gray-600 hover:border-red-500' : 'text-red-500 hover:text-red-600 border-slate-200 hover:border-red-400'} px-3 py-2 text-xs border transition-colors rounded-sm`}
              >
                <Trash2 size={12} />
                CLEAR
              </button>
            )}
          </div>

          {webhookUrl && (
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-slate-50 border-slate-200'} border rounded-sm p-3 mt-4`}>
              <p className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                <span className="font-semibold">Status:</span> {webhookUrl ? 'Connected' : 'Not connected'}
              </p>
              {webhookUrl && (
                <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-slate-400'} mt-1 truncate`}>
                  <span className="font-semibold">URL:</span> {webhookUrl}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
