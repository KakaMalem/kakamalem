"use client";

import { useState, useCallback } from "react";
import { useMap } from "react-leaflet";
import { Search, Globe, X, Layers, MapPin, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  REGION_PRESETS,
  type RegionPresetKey,
  getCountryName,
} from "@/lib/delivery/geojson-config";
import type { FeatureCollection } from "geojson";
import {
  getCountryCode,
  getCountryNameFromFeature,
} from "../hooks/use-geojson";

interface MapControlsProps {
  onSearch: (query: string) => void;
  onBulkSelect: (countries: string[]) => void;
  onClearSelection: () => void;
  selectedCountries: string[];
  layers: {
    countries: boolean;
    localZones: boolean;
  };
  onToggleLayer: (layer: "countries" | "localZones") => void;
  countriesData?: FeatureCollection | null;
  compact?: boolean;
}

/**
 * Map controls panel with search, bulk selection, and layer toggles
 */
export function MapControls({
  onSearch,
  onBulkSelect,
  onClearSelection,
  selectedCountries,
  layers,
  onToggleLayer,
  countriesData,
  compact = false,
}: MapControlsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [showSearch, setShowSearch] = useState(false);
  const map = useMap();

  // Search countries by name
  const handleSearch = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (!query.trim() || !countriesData) {
        setSearchResults([]);
        return;
      }

      const normalizedQuery = query.toLowerCase().trim();
      const results: Array<{ code: string; name: string }> = [];

      for (const feature of countriesData.features) {
        if (results.length >= 10) break;

        const props = feature.properties as Record<string, unknown>;
        const code = getCountryCode(props);
        const name = getCountryNameFromFeature(props);

        if (
          name.toLowerCase().includes(normalizedQuery) ||
          code.toLowerCase().includes(normalizedQuery)
        ) {
          results.push({ code, name });
        }
      }

      setSearchResults(results);
    },
    [countriesData]
  );

  // Handle search result click - zoom to country
  const handleSearchResultClick = useCallback(
    (code: string) => {
      if (!countriesData) return;

      const feature = countriesData.features.find((f) => {
        const featureCode = getCountryCode(
          (f.properties || {}) as Record<string, unknown>
        );
        return featureCode === code;
      });

      if (feature && feature.geometry) {
        try {
          const tempLayer = window.L.geoJSON(feature);
          const bounds = tempLayer.getBounds();

          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
          }
        } catch (error) {
          console.warn("Failed to zoom to country:", error);
        }
      }

      onSearch(code);
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
    },
    [countriesData, map, onSearch]
  );

  // Handle bulk region selection
  const handleRegionSelect = useCallback(
    (regionKey: RegionPresetKey) => {
      const region = REGION_PRESETS[regionKey];
      onBulkSelect([...region.countries]);
    },
    [onBulkSelect]
  );

  // Compact mode: minimal controls
  if (compact) {
    return (
      <div
        className="flex flex-row items-center gap-2"
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          zIndex: 1000,
        }}
      >
        {/* Search */}
        {showSearch ? (
          <div
            className="bg-white rounded-lg shadow-lg overflow-hidden w-56"
            style={{ zIndex: 1001 }}
          >
            <div className="flex items-center p-2 gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-7 text-sm border-0 focus-visible:ring-0 p-0"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 shrink-0"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="border-t max-h-48 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.code}
                    className="w-full px-3 py-1.5 text-left text-xs hover:bg-muted/50 flex items-center justify-between"
                    onClick={() => handleSearchResultClick(result.code)}
                  >
                    <span>{result.name}</span>
                    <span className="text-muted-foreground">{result.code}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 shadow-md"
            onClick={() => setShowSearch(true)}
          >
            <Search className="h-4 w-4" />
          </Button>
        )}

        {/* Regions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="h-8 w-8 shadow-md"
            >
              <Globe className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-48"
            style={{ zIndex: 1001 }}
          >
            <DropdownMenuItem onClick={() => handleRegionSelect("middleEast")}>
              Middle East
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRegionSelect("centralAsia")}>
              Central Asia
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRegionSelect("southAsia")}>
              South Asia
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRegionSelect("gulfStates")}>
              Gulf States
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleRegionSelect("europe")}>
              Europe
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onClearSelection}
              className="text-destructive focus:text-destructive"
            >
              Clear All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Full mode: all controls
  return (
    <div className="absolute top-4 right-4 map-control-overlay flex flex-col gap-2">
      {/* Search */}
      <div className="relative">
        {showSearch ? (
          <div className="bg-white rounded-lg shadow-md overflow-hidden w-64">
            <div className="flex items-center p-2 gap-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Search country..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-8 border-0 focus-visible:ring-0 p-0"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="border-t max-h-60 overflow-y-auto">
                {searchResults.map((result) => (
                  <button
                    key={result.code}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center justify-between"
                    onClick={() => handleSearchResultClick(result.code)}
                  >
                    <span>{result.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {result.code}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            className="shadow-md"
            onClick={() => setShowSearch(true)}
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </Button>
        )}
      </div>

      {/* Bulk Selection */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" className="shadow-md">
            <Globe className="h-4 w-4 mr-2" />
            Regions
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => handleRegionSelect("middleEast")}>
            <span className="flex-1">Middle East</span>
            <span className="text-xs text-muted-foreground">15 countries</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRegionSelect("centralAsia")}>
            <span className="flex-1">Central Asia</span>
            <span className="text-xs text-muted-foreground">6 countries</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRegionSelect("southAsia")}>
            <span className="flex-1">South Asia</span>
            <span className="text-xs text-muted-foreground">8 countries</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRegionSelect("gulfStates")}>
            <span className="flex-1">Gulf States (GCC)</span>
            <span className="text-xs text-muted-foreground">6 countries</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRegionSelect("europe")}>
            <span className="flex-1">Europe</span>
            <span className="text-xs text-muted-foreground">46 countries</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRegionSelect("northAmerica")}>
            <span className="flex-1">North America</span>
            <span className="text-xs text-muted-foreground">3 countries</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onClearSelection}
            className="text-destructive focus:text-destructive"
          >
            Clear All Selection
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Selection indicator - hide in compact mode */}
      {selectedCountries.length > 0 && !compact && (
        <Badge variant="secondary" className="shadow-md justify-center">
          {selectedCountries.length} selected
        </Badge>
      )}

      {/* Layer toggles - hide in compact mode */}
      {!compact && (
        <div className="bg-white rounded-lg shadow-md p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-2">
            <Layers className="h-3 w-3" />
            Layers
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={layers.countries}
              onCheckedChange={() => onToggleLayer("countries")}
            />
            <Globe className="h-3.5 w-3.5 text-muted-foreground" />
            Countries
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={layers.localZones}
              onCheckedChange={() => onToggleLayer("localZones")}
            />
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            Local Zones
          </label>
        </div>
      )}
    </div>
  );
}

/**
 * Selected countries display panel
 */
interface SelectedCountriesPanelProps {
  selectedCountries: string[];
  onRemove: (code: string) => void;
  maxVisible?: number;
}

export function SelectedCountriesPanel({
  selectedCountries,
  onRemove,
  maxVisible = 10,
}: SelectedCountriesPanelProps) {
  if (selectedCountries.length === 0) return null;

  const visible = selectedCountries.slice(0, maxVisible);
  const remaining = selectedCountries.length - maxVisible;

  return (
    <div className="absolute bottom-4 left-4 map-control-overlay bg-white rounded-lg shadow-md p-3 max-w-xs">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Selected Countries ({selectedCountries.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {visible.map((code) => (
          <Badge
            key={code}
            variant="secondary"
            className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onRemove(code)}
          >
            {getCountryName(code)}
            <X className="h-3 w-3 ml-1" />
          </Badge>
        ))}
        {remaining > 0 && (
          <Badge variant="outline" className="text-xs">
            +{remaining} more
          </Badge>
        )}
      </div>
    </div>
  );
}
