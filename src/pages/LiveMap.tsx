import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, RefreshCw, Truck, Navigation, Clock, ExternalLink, AlertCircle } from 'lucide-react';
import { LocationService, RepLiveLocation } from '../services/api';
import { OfflineCache } from '../services/offlineSync';
import { useLiveRefresh } from '../hooks/useLiveRefresh';

interface LiveMapProps {
  isActive?: boolean;
}

function formatTimeAgo(dateStr?: string | null): string {
  if (!dateStr) return 'Never';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

export const LiveMap: React.FC<LiveMapProps> = ({ isActive }) => {
  const [reps, setReps] = useState<RepLiveLocation[]>(() => OfflineCache.load<RepLiveLocation[]>('rep_locations', []));
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const loadLocations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await LocationService.getRepLocations();
      if (Array.isArray(data)) {
        setReps(data);
        OfflineCache.save('rep_locations', data);
      } else {
        setError('Server returned an unexpected response. Please ensure backend is deployed.');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        status === 502 || status === 503
          ? 'Backend server is currently unreachable (502/503). Check Railway deployment.'
          : err?.response?.data?.error || err?.message || 'Failed to load rep locations.';
      setError(msg);
      console.error('Failed to load rep locations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  useLiveRefresh(loadLocations, { isActive });

  // Auto-poll every 10 seconds when Live Map tab is active
  useEffect(() => {
    if (!isActive) return;
    loadLocations();
    const timer = setInterval(loadLocations, 10000);
    return () => clearInterval(timer);
  }, [isActive]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [7.8731, 80.7718], // Sri Lanka center default
      zoom: 8,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Re-invalidate map size when tab becomes visible
  useEffect(() => {
    if (isActive && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
    }
  }, [isActive]);

  // Update markers whenever reps data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const validCoords: [number, number][] = [];

    reps.forEach((rep) => {
      if (rep.lastLatitude == null || rep.lastLongitude == null) return;
      const latLng: [number, number] = [rep.lastLatitude, rep.lastLongitude];
      validCoords.push(latLng);

      const isRecent = rep.lastLocationAt
        ? Date.now() - new Date(rep.lastLocationAt).getTime() < 5 * 60 * 1000
        : false;

      const markerIcon = L.divIcon({
        className: 'custom-rep-pin',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
            <div style="background:${isRecent ? '#059669' : '#64748b'};color:#fff;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.22);border:2px solid #fff;">
              ${rep.lorry?.vehicleNumber || rep.fullName}
            </div>
            <div style="width:10px;height:10px;background:${isRecent ? '#059669' : '#64748b'};border:2px solid #fff;border-radius:999px;margin-top:2px;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });

      const speedKmh = rep.lastSpeed != null ? `${Math.round(rep.lastSpeed * 3.6)} km/h` : '0 km/h';
      const marker = L.marker(latLng, { icon: markerIcon });
      marker.bindPopup(`
        <div style="font-family:system-ui,sans-serif;min-width:170px;">
          <div style="font-weight:700;font-size:13px;color:#0f172a;">${rep.fullName}</div>
          <div style="font-size:11px;color:#475569;margin-top:2px;">
            ${rep.lorry ? `Lorry: <b>${rep.lorry.vehicleNumber}</b>` : 'No lorry assigned'}
          </div>
          ${rep.lorry?.route ? `<div style="font-size:11px;color:#64748b;">Route: ${rep.lorry.route.name}</div>` : ''}
          <div style="font-size:11px;color:#0f172a;margin-top:6px;">
            Speed: <b>${speedKmh}</b> &bull; Updated <b>${formatTimeAgo(rep.lastLocationAt)}</b>
          </div>
        </div>
      `);
      marker.addTo(layer);
    });

    if (validCoords.length > 0 && !selectedRepId) {
      if (validCoords.length === 1) {
        map.setView(validCoords[0], 14);
      } else {
        map.fitBounds(validCoords, { padding: [40, 40], maxZoom: 15 });
      }
    }
  }, [reps, selectedRepId]);

  const handleFocusRep = (rep: RepLiveLocation) => {
    setSelectedRepId(rep.id);
    if (rep.lastLatitude != null && rep.lastLongitude != null && mapInstanceRef.current) {
      mapInstanceRef.current.setView([rep.lastLatitude, rep.lastLongitude], 16, { animate: true });
    }
  };

  const onlineRepsCount = reps.filter(
    (r) => r.lastLocationAt && Date.now() - new Date(r.lastLocationAt).getTime() < 5 * 60 * 1000
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-0.5">
            <Navigation className="w-3.5 h-3.5" />
            <span>Background &amp; Foreground GPS</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Live Fleet Map</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            {onlineRepsCount} Live Now
          </span>
          <button
            type="button"
            onClick={loadLocations}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Split View: Map + Rep List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs h-[460px] lg:h-[600px] relative">
          <div ref={mapContainerRef} className="w-full h-full z-10" />
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col h-[460px] lg:h-[600px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">Active Sales Reps ({reps.length})</h2>
            <span className="text-[11px] text-slate-400 font-medium">Auto-updates 10s</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 mt-1">
            {reps.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No active sales reps found.
              </div>
            ) : (
              reps.map((rep) => {
                const hasCoords = rep.lastLatitude != null && rep.lastLongitude != null;
                const isRecent = rep.lastLocationAt
                  ? Date.now() - new Date(rep.lastLocationAt).getTime() < 5 * 60 * 1000
                  : false;

                return (
                  <div
                    key={rep.id}
                    onClick={() => hasCoords && handleFocusRep(rep)}
                    className={`py-3 px-2.5 rounded-xl transition cursor-pointer ${
                      selectedRepId === rep.id ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              !hasCoords
                                ? 'bg-slate-300'
                                : isRecent
                                ? 'bg-emerald-500 animate-pulse'
                                : 'bg-amber-500'
                            }`}
                          />
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {rep.fullName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-1">
                          <Truck className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {rep.lorry?.vehicleNumber || 'No Lorry'}
                            {rep.lorry?.route ? ` • ${rep.lorry.route.name}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(rep.lastLocationAt)}</span>
                        </div>
                        {hasCoords && (
                          <a
                            href={`https://www.google.com/maps?q=${rep.lastLatitude},${rep.lastLongitude}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:text-blue-700 mt-1"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            <span>Google Maps</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

