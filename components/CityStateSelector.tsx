import React, { useEffect, useMemo, useState } from "react";

interface CityStateSelectorProps {
  onLocationChange: (location: string) => void;
  initialValue?: string;
}

const STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

function parseInitialLocation(value: string) {
  const parts = value.split(",").map((item) => item.trim());
  return {
    city: parts.length >= 1 ? parts[0] : "",
    state: parts.length >= 2 ? parts[1].toUpperCase().slice(0, 2) : "",
  };
}

export function CityStateSelector({
  onLocationChange,
  initialValue = "",
}: CityStateSelectorProps) {
  const initial = useMemo(() => parseInitialLocation(initialValue), [initialValue]);
  const [cities, setCities] = useState<{ id: number; nome: string }[]>([]);
  const [selectedState, setSelectedState] = useState(initial.state);
  const [selectedCity, setSelectedCity] = useState(initial.city);
  const [manualCity, setManualCity] = useState(initial.city);
  const [loadingCities, setLoadingCities] = useState(false);
  const [citiesError, setCitiesError] = useState(false);

  useEffect(() => {
    if (
      initial.state !== selectedState ||
      initial.city !== selectedCity
    ) {
      setSelectedState(initial.state);
      setSelectedCity(initial.city);
      setManualCity(initial.city);
    }
  }, [initialValue]);

  useEffect(() => {
    if (!selectedState) {
      setCities([]);
      setCitiesError(false);
      setLoadingCities(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setLoadingCities(true);
    setCitiesError(false);

    fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${selectedState}/municipios?orderBy=nome`,
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setCities(Array.isArray(data) ? data : []);
        setCitiesError(false);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.error("Erro ao carregar municípios do IBGE:", error);
        }
        setCities([]);
        setCitiesError(true);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        setLoadingCities(false);
      });

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [selectedState]);

  const emitLocation = (city: string, state = selectedState) => {
    const cleanCity = city.trim();
    if (state && cleanCity) onLocationChange(`${cleanCity}, ${state}`);
    else onLocationChange("");
  };

  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = e.target.value;
    setSelectedState(newState);
    setSelectedCity("");
    setManualCity("");
    setCities([]);
    setCitiesError(false);
    onLocationChange("");
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCity = e.target.value;
    setSelectedCity(newCity);
    setManualCity(newCity);
    emitLocation(newCity);
  };

  const handleManualCityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCity = e.target.value;
    setManualCity(newCity);
    setSelectedCity(newCity);
    emitLocation(newCity);
  };

  const useManualMode = citiesError && Boolean(selectedState);

  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        <div className="w-1/3">
          <select
            required
            value={selectedState}
            onChange={handleStateChange}
            className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-terracotta-500"
          >
            <option value="">Estado</option>
            {selectedState && !STATES.includes(selectedState) && (
              <option value={selectedState}>{selectedState}</option>
            )}
            {STATES.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>

        <div className="w-2/3">
          {useManualMode ? (
            <input
              value={manualCity}
              onChange={handleManualCityChange}
              placeholder="Digite sua cidade"
              className="w-full rounded-xl border border-amber-300 bg-white px-4 py-3 outline-none focus:border-terracotta-500"
            />
          ) : (
            <select
              required
              disabled={!selectedState || loadingCities}
              value={selectedCity}
              onChange={handleCityChange}
              className="w-full rounded-xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-terracotta-500 disabled:bg-stone-50 disabled:text-stone-400"
            >
              <option value="">
                {!selectedState
                  ? "Cidade"
                  : loadingCities
                    ? "Carregando cidades..."
                    : "Cidade"}
              </option>
              {selectedCity && !cities.some((city) => city.nome === selectedCity) && (
                <option value={selectedCity}>{selectedCity}</option>
              )}
              {cities.map((city) => (
                <option key={city.id} value={city.nome}>{city.nome}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {useManualMode && (
        <p className="text-[11px] leading-5 text-amber-700">
          Não conseguimos carregar a lista de municípios agora. Você pode digitar a cidade manualmente e continuar normalmente.
        </p>
      )}
    </div>
  );
}
