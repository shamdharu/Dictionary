import React from 'react';
import { Layers, Bookmark, BarChart3, Flame } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  savedCount: number;
  streak: number;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  savedCount,
  streak,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-stone-950/90 backdrop-blur-xl border-t border-stone-800/80 safe-area-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
        {/* Feed Tab */}
        <button
          id="nav-tab-feed"
          onClick={() => onSelectTab('feed')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-150 ${
            activeTab === 'feed'
              ? 'text-amber-400 font-bold scale-105'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className="relative">
            <Layers className="w-5 h-5" />
            {activeTab === 'feed' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-400" />
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Feed</span>
        </button>

        {/* Saved Words Tab */}
        <button
          id="nav-tab-saved"
          onClick={() => onSelectTab('saved')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-150 ${
            activeTab === 'saved'
              ? 'text-rose-400 font-bold scale-105'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className="relative">
            <Bookmark className={`w-5 h-5 ${activeTab === 'saved' ? 'fill-current' : ''}`} />
            {savedCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-4 text-center">
                {savedCount}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Saved</span>
        </button>

        {/* Progress / Stats Tab */}
        <button
          id="nav-tab-stats"
          onClick={() => onSelectTab('stats')}
          className={`flex flex-col items-center justify-center flex-1 py-1 px-2 rounded-xl transition-all duration-150 ${
            activeTab === 'stats'
              ? 'text-emerald-400 font-bold scale-105'
              : 'text-stone-400 hover:text-stone-200'
          }`}
        >
          <div className="relative flex items-center">
            <BarChart3 className="w-5 h-5" />
            {streak > 0 && (
              <span className="absolute -top-1.5 -right-3 flex items-center text-[10px] text-orange-400 font-black">
                <Flame className="w-3 h-3 fill-orange-500" />
                {streak}
              </span>
            )}
          </div>
          <span className="text-[11px] mt-1 tracking-tight">Progress</span>
        </button>
      </div>
    </nav>
  );
};
