"use client";

import { useMemo, useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { type SanityDocument } from "next-sanity";
import { geoCentroid } from "d3-geo";

// US map topology URL - using a simple US states map
const geoUrl =
  "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface StatesMapProps {
  states: SanityDocument[];
}

// State name to code mapping (for matching states without codes)
const STATE_NAME_TO_CODE: Record<string, string> = {
  Alabama: "AL",
  Alaska: "AK",
  Arizona: "AZ",
  Arkansas: "AR",
  California: "CA",
  Colorado: "CO",
  Connecticut: "CT",
  Delaware: "DE",
  Florida: "FL",
  Georgia: "GA",
  Hawaii: "HI",
  Idaho: "ID",
  Illinois: "IL",
  Indiana: "IN",
  Iowa: "IA",
  Kansas: "KS",
  Kentucky: "KY",
  Louisiana: "LA",
  Maine: "ME",
  Maryland: "MD",
  Massachusetts: "MA",
  Michigan: "MI",
  Minnesota: "MN",
  Mississippi: "MS",
  Missouri: "MO",
  Montana: "MT",
  Nebraska: "NE",
  Nevada: "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  Ohio: "OH",
  Oklahoma: "OK",
  Oregon: "OR",
  Pennsylvania: "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  Tennessee: "TN",
  Texas: "TX",
  Utah: "UT",
  Vermont: "VT",
  Virginia: "VA",
  Washington: "WA",
  "West Virginia": "WV",
  Wisconsin: "WI",
  Wyoming: "WY",
  "District of Columbia": "DC",
};

export default function StatesMap({ states }: StatesMapProps) {
  const [hoveredState, setHoveredState] = useState<{
    name: string;
    code: string;
    coordinates: [number, number];
  } | null>(null);

  // Create sets of licensed state codes and names, plus a map for state info
  const { licensedStateCodes, licensedStateNames, stateInfoMap } = useMemo(() => {
    const codes = new Set<string>();
    const names = new Set<string>();
    const infoMap = new Map<string, { name: string; code: string }>();
    
    // Add licensed states from Sanity
    states.forEach((state: any) => {
      const code = state.code || STATE_NAME_TO_CODE[state.name];
      if (code) {
        codes.add(code.toUpperCase());
        infoMap.set(code.toUpperCase(), { name: state.name, code: code.toUpperCase() });
      }
      if (state.name) {
        names.add(state.name.toLowerCase());
        const stateCode = code || STATE_NAME_TO_CODE[state.name];
        if (stateCode) {
          infoMap.set(stateCode.toUpperCase(), { name: state.name, code: stateCode.toUpperCase() });
        }
      }
    });
    
    // Also add all states from the mapping for fallback (so all states show names on hover)
    Object.entries(STATE_NAME_TO_CODE).forEach(([name, code]) => {
      if (!infoMap.has(code)) {
        infoMap.set(code, { name, code });
      }
    });
    
    return { licensedStateCodes: codes, licensedStateNames: names, stateInfoMap: infoMap };
  }, [states]);

  return (
    <div className="w-full h-full min-h-[400px] lg:min-h-[500px] relative">
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{
          scale: 1000,
        }}
        className="w-full h-full"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }: { geographies: Array<{
            rsmKey: string;
            properties: {
              STUSPS?: string;
              STUSAB?: string;
              postal?: string;
              NAME?: string;
              name?: string;
              [key: string]: any;
            };
            geometry: any;
          }> }) => {
            // First pass: collect all state labels
            const stateLabels: Array<{
              code: string;
              name: string;
              coordinates: [number, number];
            }> = [];

            geographies.forEach((geo) => {
              const stateCode = 
                geo.properties.STUSPS || 
                geo.properties.STUSAB || 
                geo.properties.postal ||
                "";
              const stateName = geo.properties.NAME || geo.properties.name || "";
              
              if (stateCode) {
                const centroid = geoCentroid(geo.geometry as any);
                stateLabels.push({
                  code: stateCode.toUpperCase(),
                  name: stateName || stateCode,
                  coordinates: centroid,
                });
              }
            });

            return (
              <>
                {geographies.map((geo: {
                  rsmKey: string;
                  properties: {
                    STUSPS?: string;
                    STUSAB?: string;
                    postal?: string;
                    NAME?: string;
                    name?: string;
                    [key: string]: any;
                  };
                  geometry: any;
                }) => {
                  // Try multiple property names that might contain state codes
                  const stateCode = 
                    geo.properties.STUSPS || 
                    geo.properties.STUSAB || 
                    geo.properties.postal ||
                    "";
                  const stateName = geo.properties.NAME || geo.properties.name || "";
                  
                  // Check if state is licensed by code or name
                  const isLicensed = 
                    (stateCode && licensedStateCodes.has(stateCode.toUpperCase())) ||
                    (stateName && licensedStateNames.has(stateName.toLowerCase()));
                  
                  // Calculate centroid for label placement and hover
                  const centroid = geoCentroid(geo.geometry as any);
                  
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={isLicensed ? "hsl(var(--custom))" : "#e5e7eb"}
                      stroke="#ffffff"
                      strokeWidth={0.5}
                      onMouseEnter={() => {
                        // Always show tooltip for any state
                        if (stateCode) {
                          const info = stateInfoMap.get(stateCode.toUpperCase());
                          if (info) {
                            setHoveredState({
                              name: info.name,
                              code: info.code,
                              coordinates: centroid,
                            });
                          } else {
                            // Use the state name from the geography properties
                            setHoveredState({
                              name: stateName || stateCode,
                              code: stateCode.toUpperCase(),
                              coordinates: centroid,
                            });
                          }
                        } else if (stateName) {
                          // Fallback if no code but we have a name
                          setHoveredState({
                            name: stateName,
                            code: "",
                            coordinates: centroid,
                          });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredState(null);
                      }}
                      style={{
                        default: {
                          outline: "none",
                          transition: "all 0.3s ease",
                        },
                        hover: {
                          fill: isLicensed
                            ? "hsl(var(--custom)/0.8)"
                            : "#d1d5db",
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: {
                          outline: "none",
                        },
                      }}
                    />
                  );
                })}
                
                {/* State abbreviation labels */}
                {stateLabels.map((label, idx) => {
                  const isLicensed = licensedStateCodes.has(label.code);
                  return (
                    <Marker key={`label-${idx}`} coordinates={label.coordinates}>
                      <text
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill={isLicensed ? "#ffffff" : "#6b7280"}
                        style={{
                          pointerEvents: "none",
                          userSelect: "none",
                          textShadow: isLicensed
                            ? "0 1px 2px rgba(0,0,0,0.3)"
                            : "0 1px 2px rgba(255,255,255,0.8)",
                        }}
                      >
                        {label.code}
                      </text>
                    </Marker>
                  );
                })}
              </>
            );
          }}
        </Geographies>
        
        {/* Hover tooltip */}
        {hoveredState && (
          <Marker coordinates={hoveredState.coordinates}>
            <g transform="translate(0, -35)">
              {/* Tooltip background with arrow */}
              <defs>
                <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
                </filter>
              </defs>
              <g filter="url(#shadow)">
                <rect
                  x={-Math.max(hoveredState.name.length * 6, 60) / 2}
                  y="-14"
                  width={Math.max(hoveredState.name.length * 6, 60)}
                  height="28"
                  fill="rgba(0, 0, 0, 0.9)"
                  rx="6"
                  style={{ pointerEvents: "none" }}
                />
                {/* Arrow pointing down */}
                <polygon
                  points={`${-6},${-2} ${0},${4} ${6},${-2}`}
                  fill="rgba(0, 0, 0, 0.9)"
                  style={{ pointerEvents: "none" }}
                />
                <text
                  textAnchor="middle"
                  fontSize="13"
                  fontWeight="600"
                  fill="#ffffff"
                  dy="4"
                  style={{
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  {hoveredState.name}
                </text>
              </g>
            </g>
          </Marker>
        )}
      </ComposableMap>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-4 items-center justify-center bg-white/95 backdrop-blur-sm rounded-lg p-3 shadow-lg border border-gray-200/60">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-[hsl(var(--custom))]" />
          <span className="text-sm font-medium text-gray-700">Licensed States</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200" />
          <span className="text-sm font-medium text-gray-700">Other States</span>
        </div>
      </div>
    </div>
  );
}
