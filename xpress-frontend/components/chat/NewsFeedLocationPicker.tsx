"use client";

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LatLngLiteral } from 'leaflet';
import { LocateFixed, MapPin, X } from 'lucide-react';

const DEFAULT_CENTER: LatLngLiteral = {
  lat: 10.8231,
  lng: 106.6297,
};

const NewsFeedLocationMap = dynamic(() => import('./NewsFeedLocationMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-2xl border border-[#d6e0f3] bg-[#f8faff] text-sm text-[#5f6982]">
      Đang tải bản đồ...
    </div>
  ),
});

interface NewsFeedLocationPickerProps {
  value: string;
  onChange: (value: string) => void;
}

type LocationSource = 'current' | 'map';

interface ReverseGeocodeResult {
  display_name?: string;
  name?: string;
  address?: {
    neighbourhood?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    city_district?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

function formatPlaceLabel(result: ReverseGeocodeResult): string {
  const address = result.address ?? {};
  const candidates = [
    result.name,
    address.neighbourhood,
    address.suburb,
    address.city_district,
    address.village,
    address.town,
    address.city,
    address.county,
    address.state,
    address.country,
  ]
    .map((item) => item?.trim())
    .filter((item): item is string => Boolean(item));

  if (candidates.length > 0) {
    return candidates.slice(0, 4).join(', ');
  }

  const displayName = result.display_name?.trim();
  if (displayName) {
    return displayName;
  }

  return 'Vị trí đã chọn';
}

async function reverseGeocode(point: LatLngLiteral): Promise<string> {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(point.lat),
    lon: String(point.lng),
    zoom: '18',
    addressdetails: '1',
  });

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi',
    },
  });

  if (!response.ok) {
    throw new Error('Không thể xác định tên địa điểm.');
  }

  const data = (await response.json()) as ReverseGeocodeResult;
  return formatPlaceLabel(data);
}

async function resolveCurrentPoint(): Promise<LatLngLiteral> {
  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60_000,
    });
  });

  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };
}

export default function NewsFeedLocationPicker({ value, onChange }: NewsFeedLocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftPoint, setDraftPoint] = useState<LatLngLiteral>(DEFAULT_CENTER);
  const [draftLabel, setDraftLabel] = useState('');
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [error, setError] = useState('');

  const previewLabel = useMemo(() => value.trim(), [value]);

  const applyPoint = useCallback(
    async (point: LatLngLiteral, source: LocationSource) => {
      setDraftPoint(point);
      setError('');

      try {
        const label = await reverseGeocode(point);
        setDraftLabel(label);
      } catch (reverseError) {
        const fallbackLabel = source === 'current' ? 'Vị trí hiện tại' : 'Vị trí trên bản đồ';
        setDraftLabel(fallbackLabel);
        setError(
          reverseError instanceof Error
            ? reverseError.message
            : 'Không thể xác định tên địa điểm, hãy thử lại.',
        );
      }
    },
    [],
  );

  const resolveCurrentLocation = useCallback(async () => {
    setLoadingCurrent(true);
    setError('');

    try {
      const point = await resolveCurrentPoint();
      await applyPoint(point, 'current');
    } catch (currentError) {
      setError(
        currentError instanceof Error
          ? currentError.message
          : 'Không thể lấy vị trí hiện tại, hãy chọn thủ công trên bản đồ.',
      );
      await applyPoint(DEFAULT_CENTER, 'map');
    } finally {
      setLoadingCurrent(false);
    }
  }, [applyPoint]);

  useEffect(() => {
    if (!isOpen) return;

    void resolveCurrentLocation();
  }, [resolveCurrentLocation, isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-[#4f5870] transition-colors hover:bg-[#eef2fa]"
        title={previewLabel || 'Chọn vị trí'}
      >
        <MapPin size={16} className="text-[#425c9f]" />
        <span className="max-w-48 truncate">
          {previewLabel || 'Vị trí'}
        </span>
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1730]/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-[#dce4f3] bg-white shadow-[0_24px_60px_rgba(9,28,77,0.35)]">
            <div className="flex items-center justify-between border-b border-[#e7edf8] px-4 py-3 md:px-5">
              <div>
                <h3 className="text-base font-bold text-[#1a243a]">Chọn vị trí từ bản đồ</h3>
                <p className="text-xs text-[#67738b]">
                  Mặc định là vị trí hiện tại, bấm vào bản đồ để chọn lại một địa điểm khác.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-[#5f6982] transition-colors hover:bg-[#eef2fa]"
                aria-label="Đóng"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 p-4 md:p-5">
              <div className="overflow-hidden rounded-2xl border border-[#d6e0f3]">
                <NewsFeedLocationMap
                  center={draftPoint}
                  onPick={(point) => applyPoint(point, 'map')}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#f8faff] px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b748a]">
                    Tên địa điểm
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#1b2540]">
                    {loadingCurrent
                      ? 'Đang lấy vị trí hiện tại...'
                      : draftLabel || 'Bấm vào bản đồ để chọn một địa điểm'}
                  </p>
                  {error ? <p className="mt-1 text-xs text-[#be2a3b]">{error}</p> : null}
                </div>

                <button
                  type="button"
                  onClick={() => void resolveCurrentLocation()}
                  disabled={loadingCurrent}
                  className="inline-flex items-center gap-2 rounded-full border border-[#d7dff5] bg-white px-3 py-2 text-xs font-semibold text-[#3158b9] transition-colors hover:bg-[#eef4ff] disabled:opacity-60"
                >
                  <LocateFixed size={14} />
                  Lấy vị trí hiện tại
                </button>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="rounded-full border border-[#d7dff5] bg-white px-4 py-2 text-sm font-semibold text-[#4f5870] transition-colors hover:bg-[#f3f6fd]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onChange(draftLabel || 'Vị trí đã chọn');
                    setIsOpen(false);
                  }}
                  className="rounded-full bg-[#1d59df] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#184ec6]"
                >
                  Dùng vị trí này
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}