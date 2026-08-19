import React, { useState, useEffect, useRef } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { useDebounce } from "../hooks/useDebounce"; // Assume we have a useDebounce hook or I will create one.

export interface SearchSelectOption {
  value: string; // The ID or the exact string
  label: string;
}

interface SearchSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  options: SearchSelectOption[];
  onSearch?: (term: string) => void; // If async search is needed
  allowCustom?: boolean; // Se true, permite selecionar o que digitou mesmo não estando na lista
  customLabel?: string;
  className?: string;
}

export function SearchSelect({
  value,
  onChange,
  placeholder = "Selecione...",
  options,
  onSearch,
  allowCustom = true,
  customLabel = "Usar",
  className = "",
}: SearchSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  useEffect(() => {
    if (onSearch && isOpen) {
      onSearch(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, onSearch, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value || o.label === value);
  const displayValue = selectedOption ? selectedOption.label : value;

  const handleSelect = (val: string) => {
    onChange(val);
    setSearchTerm("");
    setIsOpen(false);
  };

  const filteredOptions = onSearch
    ? options
    : options.filter((o) =>
        o.label.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const showCustomOption =
    allowCustom &&
    searchTerm.trim().length > 0 &&
    !options.some((o) => o.label.toLowerCase() === searchTerm.trim().toLowerCase());

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        className="flex items-center justify-between w-full p-3 border rounded-xl bg-white cursor-pointer hover:border-orange-500 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`truncate ${!displayValue ? "text-stone-400" : "text-stone-900"}`}>
          {displayValue || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border rounded-xl shadow-lg max-h-60 flex flex-col overflow-hidden">
          <div className="p-2 border-b flex items-center gap-2 text-stone-500 bg-stone-50">
            <Search className="w-4 h-4" />
            <input
              type="text"
              className="w-full bg-transparent outline-none text-sm"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          
          <div className="overflow-y-auto">
            {filteredOptions.length === 0 && !showCustomOption && (
              <div className="p-4 text-center text-sm text-stone-500">Nenhum resultado encontrado.</div>
            )}

            {filteredOptions.map((option) => (
              <div
                key={option.value}
                className="px-4 py-3 text-sm cursor-pointer hover:bg-orange-50 flex items-center justify-between transition-colors"
                onClick={() => handleSelect(option.value)}
              >
                <span>{option.label}</span>
                {(value === option.value || value === option.label) && <Check className="w-4 h-4 text-orange-500" />}
              </div>
            ))}

            {showCustomOption && (
              <div
                className="px-4 py-3 text-sm cursor-pointer bg-stone-50 hover:bg-orange-100 flex items-center gap-2 transition-colors border-t border-stone-100"
                onClick={() => handleSelect(searchTerm.trim())}
              >
                <span className="font-semibold text-orange-600">{customLabel}</span>
                <span className="text-stone-600 truncate">"{searchTerm.trim()}"</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
