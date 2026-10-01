'use client';

import React from 'react';
import { Palette, Check, X } from 'lucide-react';

export type AppTheme = 'paper' | 'eink' | 'obsidian' | 'midnight' | 'sage' | 'nordic';

interface ThemeOption {
  id: AppTheme;
  name: string;
  category: 'Light' | 'Dark';
  description: string;
  bgHex: string;
  cardHex: string;
  accentHex: string;
  textHex: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'paper',
    name: 'Warm Washi Paper',
    category: 'Light',
    description: 'Calm Japanese cream paper with soft charcoal ink',
    bgHex: '#FAF8F5',
    cardHex: '#FFFFFF',
    accentHex: '#2563EB',
    textHex: '#1C1917',
  },
  {
    id: 'eink',
    name: 'E-Ink Monochrome',
    category: 'Light',
    description: 'Authentic high-contrast digital paper feel (Kindle / reMarkable style)',
    bgHex: '#F4F4EE',
    cardHex: '#FFFFFF',
    accentHex: '#0A0A0A',
    textHex: '#0A0A0A',
  },
  {
    id: 'obsidian',
    name: 'Obsidian OLED Black',
    category: 'Dark',
    description: 'Pure 100% black pixels, maximum battery saver & zero glare',
    bgHex: '#080808',
    cardHex: '#141414',
    accentHex: '#3B82F6',
    textHex: '#F5F5F5',
  },
  {
    id: 'midnight',
    name: 'Midnight Slate',
    category: 'Dark',
    description: 'Restful charcoal blue-gray palette for low-light evening reading',
    bgHex: '#181B20',
    cardHex: '#20242B',
    accentHex: '#81A1C1',
    textHex: '#ECEFF4',
  },
  {
    id: 'sage',
    name: 'Forest Sage',
    category: 'Dark',
    description: 'Deep matte botanical green inspired by nature & matcha notebooks',
    bgHex: '#18201B',
    cardHex: '#1F2B24',
    accentHex: '#34D399',
    textHex: '#E8F0EA',
  },
  {
    id: 'nordic',
    name: 'Nordic Frost',
    category: 'Dark',
    description: 'Cool arctic deep navy with soft cyan accents',
    bgHex: '#141F36',
    cardHex: '#1E293B',
    accentHex: '#38BDF8',
    textHex: '#F8FAFC',
  },
];

interface ThemeSelectorModalProps {
  isOpen: boolean;
  currentTheme: AppTheme;
  onSelectTheme: (theme: AppTheme) => void;
  onClose: () => void;
}

export function ThemeSelectorModal({
  isOpen,
  currentTheme,
  onSelectTheme,
  onClose,
}: ThemeSelectorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-stone-50 border border-stone-300 w-full max-w-md rounded-2xl shadow-2xl p-6 text-stone-900 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center space-x-2">
            <Palette className="w-4 h-4 text-stone-700" />
            <h2 className="text-sm font-semibold tracking-wide text-stone-900">
              Select Interface Theme
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1 text-sm font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-stone-500 mt-3 mb-4 leading-relaxed font-sans">
          Choose a visual aesthetic for your distraction-free device. All themes are engineered for zero eye fatigue and maximum calm.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {THEME_OPTIONS.map((t) => {
            const isSelected = currentTheme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  onSelectTheme(t.id);
                  onClose();
                }}
                className={`p-3 rounded-xl border text-left transition-all duration-150 relative cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-stone-900 ring-2 ring-stone-900/20 shadow-xs'
                    : 'border-stone-200 hover:border-stone-400 bg-white'
                }`}
                style={{ backgroundColor: t.bgHex }}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className="text-xs font-semibold tracking-tight"
                      style={{ color: t.textHex }}
                    >
                      {t.name}
                    </span>
                    {isSelected && (
                      <span
                        className="w-4 h-4 rounded-full flex items-center justify-center text-white"
                        style={{ backgroundColor: t.accentHex }}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  <p
                    className="text-[10px] leading-snug line-clamp-2"
                    style={{ color: t.category === 'Dark' ? '#A0A0A0' : '#666666' }}
                  >
                    {t.description}
                  </p>
                </div>

                {/* Color swatches preview bar */}
                <div className="flex items-center space-x-1.5 mt-3 pt-2 border-t border-black/10">
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: t.cardHex }}
                    title="Card background"
                  />
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: t.accentHex }}
                    title="Status indicator"
                  />
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                    style={{ backgroundColor: t.textHex }}
                    title="Primary text"
                  />
                  <span
                    className="text-[9px] font-mono ml-auto uppercase opacity-60"
                    style={{ color: t.textHex }}
                  >
                    {t.category}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-5 py-2.5 bg-stone-900 text-stone-50 text-xs font-medium rounded-xl hover:bg-stone-800 transition cursor-pointer"
        >
          Confirm Theme
        </button>
      </div>
    </div>
  );
}
