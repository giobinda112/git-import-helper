import { ALL_AREAS } from '../utils/areaMapper';
import type { Area } from '../types';

interface SidebarProps {
  selectedArea: string | null;
  onSelectArea: (area: string | null) => void;
  fixtureCounts: Record<string, number>;
  totalFixtures: number;
}

export default function Sidebar({ selectedArea, onSelectArea, fixtureCounts, totalFixtures }: SidebarProps) {
  const isDark = document.documentElement.classList.contains('dark');
  const dynamicAreas = [...new Set([...ALL_AREAS, ...Object.keys(fixtureCounts)])];

  return (
    <div className={`w-48 ${isDark ? 'bg-gray-900 border-gray-700' : 'bg-white border-slate-200'} border-r flex flex-col shrink-0`}>
      <div className="flex-1 overflow-y-auto py-1">
        <button onClick={() => onSelectArea(null)} className={`w-full text-left px-4 py-2 text-xs transition-colors ${selectedArea === null ? (isDark ? 'bg-amber-600/20 text-amber-400 border-r-2 border-amber-500' : 'bg-amber-50 text-amber-600 border-r-2 border-amber-500') : (isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
          ALL AREAS <span className={`ml-2 ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>{totalFixtures}</span>
        </button>
        {dynamicAreas.map(area => (
          <button key={area} onClick={() => onSelectArea(area === selectedArea ? null : area)} className={`w-full text-left px-4 py-2 text-xs transition-colors ${selectedArea === area ? (isDark ? 'bg-amber-600/20 text-amber-400 border-r-2 border-amber-500' : 'bg-amber-50 text-amber-600 border-r-2 border-amber-500') : (isDark ? 'text-gray-400 hover:bg-gray-800 hover:text-gray-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')}`}>
            {area.toUpperCase()} <span className={`ml-2 ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>{fixtureCounts[area] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
