import { useState } from 'react';
import { Link } from 'lucide-react';

interface WebhookPromptProps {
  onSave: (url: string) => void;
  onSkip: () => void;
}

export default function WebhookPrompt({ onSave, onSkip }: WebhookPromptProps) {
  const [url, setUrl] = useState('');
  const isDark = document.documentElement.classList.contains('dark');

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]">
      <div className={`${isDark ? 'bg-gray-900 border-gray-600' : 'bg-white border-slate-200'} border p-6 max-w-md w-full rounded-lg`}>
        <div className="flex items-center gap-2 mb-4">
          <Link size={16} className={isDark ? 'text-amber-500' : 'text-amber-600'} />
          <h3 className={`font-semibold text-sm ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>GOOGLE SHEETS SYNC</h3>
        </div>
        <p className={`${isDark ? 'text-gray-400' : 'text-slate-500'} text-xs mb-4`}>
          Paste your Google Apps Script Webhook URL to enable cloud sync.
          This allows multiple users to share the same fixture database.
        </p>
        <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/..." className={`w-full ${isDark ? 'bg-gray-800 border-gray-600 text-gray-100' : 'bg-slate-50 border-slate-300 text-slate-800'} border px-3 py-2 text-xs focus:border-amber-500 focus:outline-none mb-4 rounded-sm`} autoFocus />
        <div className="flex gap-2">
          <button onClick={() => url.trim() && onSave(url.trim())} disabled={!url.trim()} className="bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700 disabled:text-gray-500 text-white px-4 py-2 text-xs font-semibold transition-colors rounded-sm">SAVE & CONNECT</button>
          <button onClick={onSkip} className={`${isDark ? 'text-gray-500 hover:text-gray-300 border-gray-600' : 'text-slate-400 hover:text-slate-600 border-slate-200'} px-4 py-2 text-xs border transition-colors rounded-sm`}>SKIP (LOCAL ONLY)</button>
        </div>
      </div>
    </div>
  );
}
