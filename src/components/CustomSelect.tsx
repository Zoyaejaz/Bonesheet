"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";

interface Option {
  label: string;
  value: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minWidth?: string;
  placeholder?: string;
  align?: "left" | "right" | "center";
}

export function CustomSelect({ options, value, onChange, disabled, minWidth = "100px", placeholder = "Select...", align = "left" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative inline-block" ref={containerRef} style={{ minWidth }}>
      <button 
        className={`h-8 w-full border border-transparent hover:bg-gray-200 rounded px-2 text-sm text-gray-700 outline-none flex items-center justify-between transition-colors disabled:opacity-50`}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{ textAlign: align }}
      >
        <span className="truncate mr-2">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-500 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 shadow-lg rounded-md z-50 py-1 min-w-full max-h-[160px] overflow-y-auto custom-scrollbar">
          {options.map((option) => (
            <button
              key={option.value}
              className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between hover:bg-gray-100 transition-colors ${value === option.value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check className="w-4 h-4 text-indigo-600 ml-2 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
