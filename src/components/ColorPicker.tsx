"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Plus } from "lucide-react";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
}

const STANDARD_COLORS = [
  "#000000", "#434343", "#666666", "#999999", "#b7b7b7", "#cccccc", "#d9d9d9", "#efefef", "#f3f3f3", "#ffffff",
  "#980000", "#ff0000", "#ff9900", "#ffff00", "#00ff00", "#00ffff", "#4a86e8", "#0000ff", "#9900ff", "#ff00ff",
  "#e6b8af", "#f4cccc", "#fce5cd", "#fff2cc", "#d9ead3", "#d0e0e3", "#c9daf8", "#cfe2f3", "#d9d2e9", "#ead1dc",
  "#dd7e6b", "#ea9999", "#f9cb9c", "#ffe599", "#b6d7a8", "#a2c4c9", "#a4c2f4", "#9fc5e8", "#b4a7d6", "#d5a6bd",
  "#cc4125", "#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6d9eeb", "#6fa8dc", "#8e7cc3", "#c27ba0",
  "#a61c00", "#cc0000", "#e69138", "#f1c232", "#6aa84f", "#45818e", "#3c78d8", "#3d85c6", "#674ea7", "#a64d79",
  "#85200c", "#990000", "#b45f06", "#bf9000", "#38761d", "#134f5c", "#1155cc", "#0b5394", "#351c75", "#741b47",
  "#5b0f00", "#660000", "#783f04", "#7f6000", "#274e13", "#0c343d", "#1c4587", "#073763", "#20124d", "#4c1130"
];

export function ColorPicker({ color, onChange, icon, title, disabled }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleColorSelect = (c: string) => {
    onChange(c);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button 
        className={`p-1.5 rounded hover:bg-gray-200 text-gray-700 disabled:opacity-50 relative flex flex-col items-center justify-center`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        title={title}
      >
        {icon}
        <div className="w-4 h-1 absolute bottom-1 rounded-full border border-gray-300" style={{ backgroundColor: color }}></div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 shadow-xl rounded-md z-50 p-3 w-[220px]">
          <div className="text-xs font-semibold text-gray-500 mb-2">Standard</div>
          <div className="grid grid-cols-10 gap-1 mb-3">
            {STANDARD_COLORS.map(c => (
              <button
                key={c}
                className="w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center transition-transform hover:scale-110"
                style={{ backgroundColor: c }}
                onClick={() => handleColorSelect(c)}
                title={c}
              >
                {color.toLowerCase() === c.toLowerCase() && (
                  <Check className={`w-3 h-3 ${['#ffffff', '#f3f3f3', '#efefef'].includes(c.toLowerCase()) ? 'text-black' : 'text-white'}`} />
                )}
              </button>
            ))}
          </div>

          <div className="w-full h-px bg-gray-200 my-2"></div>
          
          <div className="text-xs font-semibold text-gray-500 mb-2">Custom</div>
          <div className="flex items-center space-x-2">
            <button 
              className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-100 transition-colors"
              onClick={() => nativeInputRef.current?.click()}
              title="Add Custom Color"
            >
              <Plus className="w-4 h-4 text-gray-600" />
            </button>
            
            {/* Native input hidden but clickable to act as custom picker */}
            <input 
              ref={nativeInputRef}
              type="color" 
              className="opacity-0 absolute w-0 h-0"
              value={color}
              onChange={(e) => onChange(e.target.value)}
            />
            
            {/* Displaying selected custom color if it's not in standard array */}
            {!STANDARD_COLORS.map(c => c.toLowerCase()).includes(color.toLowerCase()) && (
              <div className="relative">
                <div 
                  className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center"
                  style={{ backgroundColor: color }}
                >
                  <Check className={`w-4 h-4 ${['#ffffff'].includes(color.toLowerCase()) ? 'text-black' : 'text-white'}`} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
