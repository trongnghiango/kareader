import React, { useState, useMemo, useRef, useEffect } from 'react';


interface FontPickerProps {
  isOpen: boolean;
  onClose: () => void;
  fonts: string[];
  currentFont: string;
  onSelectFont: (font: string) => void;
}

export const FontPicker: React.FC<FontPickerProps> = ({
  isOpen,
  onClose,
  fonts,
  currentFont,
  onSelectFont,
}) => {
  const [filter, setFilter] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const filteredFonts = useMemo(() => {
    if (!filter.trim()) return fonts;
    return fonts.filter((f) => f.toLowerCase().includes(filter.toLowerCase()));
  }, [fonts, filter]);

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-10 left-4 z-50 w-72 max-h-96 rounded-xl bg-[#182620] border border-[#509475]/50 shadow-2xl flex flex-col overflow-hidden text-[#C1C497] font-mono animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* Search Header */}
      <div className="p-2 border-b border-[#509475]/30 bg-[#111c18]">
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter fonts"
          className="w-full px-3 py-1.5 rounded-lg bg-[#0c1512] border border-[#509475]/30 text-xs text-[#F7E8B2] focus:outline-none focus:border-[#509475] placeholder:text-[#53685B]"
        />
      </div>

      {/* Font list */}
      <div className="overflow-y-auto max-h-72 p-1 space-y-0.5">
        {filteredFonts.length === 0 ? (
          <div className="p-3 text-xs text-center text-[#53685B]">Không tìm thấy font</div>
        ) : (
          filteredFonts.map((font) => {
            const isSelected = font === currentFont;
            return (
              <button
                key={font}
                onClick={() => {
                  onSelectFont(font);
                  onClose();
                }}
                style={{ fontFamily: font }}
                className={`w-full px-3 py-1.5 rounded-md text-xs text-left flex items-center justify-between transition-colors ${
                  isSelected
                    ? 'bg-[#509475]/25 text-[#F7E8B2] font-semibold'
                    : 'text-[#C1C497] hover:bg-[#509475]/15 hover:text-[#F7E8B2]'
                }`}
              >
                <span className="truncate">{font}</span>
                {isSelected && (
                  <span className="text-[10px] text-[#509475] ml-2 flex items-center gap-1 shrink-0 font-sans">
                    ✓ Default
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
