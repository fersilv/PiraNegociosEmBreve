import React, { useState, useEffect } from 'react';

interface CityStateSelectorProps {
  onLocationChange: (location: string) => void;
  initialValue?: string;
}

export function CityStateSelector({ onLocationChange, initialValue = '' }: CityStateSelectorProps) {
  const [states, setStates] = useState<{ sigla: string, nome: string }[]>([]);
  const [cities, setCities] = useState<{ id: number, nome: string }[]>([]);
  
  const initialParts = initialValue ? initialValue.split(', ') : [];
  const initialCity = initialParts[0] || '';
  const initialState = initialParts[1] || '';

  const [selectedState, setSelectedState] = useState(initialState);
  const [selectedCity, setSelectedCity] = useState(initialCity);

  useEffect(() => {
    if (initialValue) {
      const parts = initialValue.split(', ');
      if (parts.length === 2 && (parts[1] !== selectedState || parts[0] !== selectedCity)) {
        setSelectedState(parts[1]);
        setSelectedCity(parts[0]);
      }
    } else if (!initialValue) {
      setSelectedState('');
      setSelectedCity('');
    }
  }, [initialValue]);

  useEffect(() => {
    fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
      .then(res => res.json())
      .then(data => setStates(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedState) {
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState}/municipios?orderBy=nome`)
        .then(res => res.json())
        .then(data => setCities(data))
        .catch(console.error);
    } else {
      setCities([]);
    }
  }, [selectedState]);

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = e.target.value;
    setSelectedState(newState);
    setSelectedCity('');
    if (newState && selectedCity) {
        // Will be updated when city changes
    }
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value;
    setSelectedCity(newCity);
    if (selectedState && newCity) {
      onLocationChange(`${newCity}, ${selectedState}`);
    } else {
      onLocationChange('');
    }
  };

  return (
    <div className="flex gap-4">
      <div className="w-1/3">
        <select 
          required 
          value={selectedState} 
          onChange={handleStateChange} 
          className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white"
        >
          <option value="">Estado</option>
          {states.map(uf => (
            <option key={uf.sigla} value={uf.sigla}>{uf.sigla}</option>
          ))}
        </select>
      </div>
      <div className="w-2/3">
        <select 
          required 
          disabled={!selectedState}
          value={selectedCity} 
          onChange={handleCityChange} 
          className="w-full px-4 py-3 rounded-xl border border-stone-200 outline-none focus:border-terracotta-500 bg-white disabled:bg-stone-50 disabled:text-stone-400"
        >
          <option value="">Cidade</option>
          {cities.map(city => (
            <option key={city.id} value={city.nome}>{city.nome}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
