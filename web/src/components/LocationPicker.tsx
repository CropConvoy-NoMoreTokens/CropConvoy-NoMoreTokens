import { lazy, Suspense, useState, useEffect, useRef, useId, type ChangeEvent, type KeyboardEvent } from 'react';
import { MapPin, MagnifyingGlass, X } from '@phosphor-icons/react';
import type { Point, LineString } from '../api/types';
import { Field, Skeleton } from './ui';
import {
  type LocationItem,
  findMatchingPresets,
  findNearestPreset,
  searchNominatim,
} from '../lib/locations';

const LeafletMap = lazy(() => import('./MapCanvas'));

export function LocationPicker({
  label,
  value,
  onChange,
  name,
  errors = {},
}: {
  label: string;
  value: Point;
  onChange(point: Point): void;
  name: string;
  errors?: Record<string, string>;
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<LocationItem[]>(() => findMatchingPresets(''));
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listboxId = useId();

  // Sync initial and external value changes with display name if matching a known preset
  useEffect(() => {
    if (Number.isFinite(value.lat) && Number.isFinite(value.lng)) {
      const match = findNearestPreset(value);
      if (match) {
        setQuery(match.name);
      }
    }
  }, [value.lat, value.lng]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(debounceTimerRef.current);
      abortControllerRef.current?.abort();
    };
  }, []);

  function handleSearchChange(e: ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setQuery(text);
    setIsOpen(true);
    setHighlightedIndex(-1);

    const presets = findMatchingPresets(text);
    setResults(presets);

    clearTimeout(debounceTimerRef.current);
    abortControllerRef.current?.abort();

    if (text.trim().length >= 3) {
      setIsLoading(true);
      debounceTimerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
          const live = await searchNominatim(text, controller.signal);
          if (!controller.signal.aborted) {
            const existingKeys = new Set(presets.map(p => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`));
            const uniqueLive = live.filter(item => !existingKeys.has(`${item.lat.toFixed(4)},${item.lng.toFixed(4)}`));
            setResults([...presets, ...uniqueLive]);
          }
        } finally {
          if (!controller.signal.aborted) {
            setIsLoading(false);
          }
        }
      }, 350);
    } else {
      setIsLoading(false);
    }
  }

  function handleSelect(location: LocationItem) {
    onChange({ lat: location.lat, lng: location.lng });
    setQuery(location.name);
    setIsOpen(false);
    setHighlightedIndex(-1);
  }

  function handleClear() {
    setQuery('');
    setResults(findMatchingPresets(''));
    setIsOpen(true);
    setHighlightedIndex(-1);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(0);
      } else {
        setHighlightedIndex(prev => (prev + 1 < results.length ? prev + 1 : 0));
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setHighlightedIndex(results.length - 1);
      } else {
        setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : results.length - 1));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && results[highlightedIndex]) {
        e.preventDefault();
        handleSelect(results[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function handleMapPick(point: Point) {
    onChange(point);
    const nearest = findNearestPreset(point);
    if (nearest) {
      setQuery(nearest.name);
    } else {
      setQuery(`Custom location (${point.lat.toFixed(4)}, ${point.lng.toFixed(4)})`);
    }
  }

  return (
    <fieldset className="location-picker">
      <legend>
        <MapPin />
        {label}
      </legend>
      <p className="field-hint">
        Search for a location by name, select a point on the map, or enter coordinates. Pins should be beside an accessible road.
      </p>

      <div className="location-search-wrap" ref={wrapRef}>
        <div className="location-search-input-box">
          <MagnifyingGlass className="search-icon" size={18} />
          <input
            id={`${name}-search`}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={highlightedIndex >= 0 ? `${name}-loc-${highlightedIndex}` : undefined}
            value={query}
            onChange={handleSearchChange}
            onFocus={() => {
              if (!query) setResults(findMatchingPresets(''));
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${label.toLowerCase()} location by name (e.g. Dambulla, Kandy)…`}
            className="location-search-input"
            autoComplete="off"
          />
          {isLoading && <span className="location-search-spinner" aria-hidden="true" />}
          {query && (
            <button
              type="button"
              className="location-search-clear"
              onClick={handleClear}
              aria-label={`Clear ${label.toLowerCase()} search`}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {isOpen && (
          <ul
            id={listboxId}
            role="listbox"
            className="location-search-dropdown"
            aria-label={`${label} location suggestions`}
          >
            {results.length > 0 ? (
              results.map((loc, idx) => (
                <li
                  key={loc.id}
                  id={`${name}-loc-${idx}`}
                  role="option"
                  aria-label={loc.name}
                  aria-selected={idx === highlightedIndex}
                  className={`location-search-option ${idx === highlightedIndex ? 'is-highlighted' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(loc);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                >
                  <div className="location-option-main">
                    <span className="location-option-name">{loc.name}</span>
                    {loc.secondary && <span className="location-option-secondary">{loc.secondary}</span>}
                  </div>
                  <span className={`location-option-badge badge-${loc.category}`}>
                    {loc.categoryLabel}
                  </span>
                </li>
              ))
            ) : (
              <li className="location-search-empty">
                No matching places found. You can pick a point on the map or enter coordinates below.
              </li>
            )}
          </ul>
        )}
      </div>

      <Suspense fallback={<Skeleton label="Loading map" />}>
        <LeafletMap points={[{ ...value, label }]} onPick={handleMapPick} />
      </Suspense>

      <div className="form-grid">
        <Field name={`${name}.lat`} label={`${label} latitude`} error={errors[`${name}.lat`]}>
          <input
            type="number"
            step="any"
            value={Number.isNaN(value.lat) ? '' : value.lat}
            onChange={(e) => {
              const newLat = e.target.value === '' ? NaN : Number(e.target.value);
              const newPoint = { ...value, lat: newLat };
              onChange(newPoint);
              const match = findNearestPreset(newPoint);
              if (match) setQuery(match.name);
            }}
          />
        </Field>
        <Field name={`${name}.lng`} label={`${label} longitude`} error={errors[`${name}.lng`]}>
          <input
            type="number"
            step="any"
            value={Number.isNaN(value.lng) ? '' : value.lng}
            onChange={(e) => {
              const newLng = e.target.value === '' ? NaN : Number(e.target.value);
              const newPoint = { ...value, lng: newLng };
              onChange(newPoint);
              const match = findNearestPreset(newPoint);
              if (match) setQuery(match.name);
            }}
          />
        </Field>
      </div>
    </fieldset>
  );
}

export function RouteMap({
  points,
  geometry,
}: {
  points: Array<Point & { label: string }>;
  geometry?: LineString | null;
}) {
  return (
    <Suspense fallback={<Skeleton label="Loading route map" />}>
      <LeafletMap points={points} geometry={geometry} />
    </Suspense>
  );
}
