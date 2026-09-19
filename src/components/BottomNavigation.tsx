import React from 'react';
import { Layers, Bookmark, BarChart3, Flame } from 'lucide-react';
import { TabType } from '../types';

interface BottomNavigationProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  savedCount: number;
  streak: number;
}

interface TabConfig {
  id: TabType;
  label: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number; fill?: string }>;
}

const TABS: TabConfig[] = [
  { id: 'feed', label: 'Feed', Icon: Layers },
  { id: 'saved', label: 'Saved', Icon: Bookmark },
  { id: 'stats', label: 'Progress', Icon: BarChart3 },
];

/**
 * Frosted-glass tab bar. The active tab gets the blue-pink gradient treatment
 * (pill behind the icon, gradient label, and a top indicator), while inactive
 * tabs stay neutral gray.
 */
export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onSelectTab,
  savedCount,
  streak,
}) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 frosted-nav border-t border-[#ECE9F6] safe-area-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around px-2 py-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;

          return (
            <button
              key={id}
              id={`nav-tab-${id}`}
              onClick={() => onSelectTab(id)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-2xl transition-all duration-200 active:scale-95"
            >
              {/* Active indicator bar */}
              {isActive && (
                <span className="absolute -top-0.5 h-[3px] w-8 rounded-full brand-gradient" />
              )}

              <span className="relative flex items-center justify-center">
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 ${
                    isActive
                      ? 'brand-gradient text-white shadow-lg shadow-[#EC4899]/30 scale-105'
                      : 'text-[#9CA3AF]'
                  }`}
                >
                  <Icon
                    className="w-5 h-5"
                    strokeWidth={1.75}
                    fill={isActive ? 'currentColor' : 'none'}
                  />
                </span>

                {/* Saved badge */}
                {id === 'saved' && savedCount > 0 && (
                  <span className="absolute -top-1 -right-1 brand-gradient text-white text-[10px] font-bold px-1.5 rounded-full min-w-[18px] text-center leading-[18px] h-[18px]">
                    {savedCount}
                  </span>
                )}

                {/* Streak badge */}
                {id === 'stats' && streak > 0 && (
                  <span className="absolute -top-1 -right-2 inline-flex items-center gap-0.5 text-[10px] font-black text-[#EC4899]">
                    <Flame className="w-3 h-3 text-[#EC4899]" strokeWidth={2} fill="currentColor" />
                    {streak}
                  </span>
                )}
              </span>

              <span
                className={`text-[11px] mt-0.5 font-semibold transition-colors ${
                  isActive ? 'brand-gradient-text' : 'text-[#9CA3AF]'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};