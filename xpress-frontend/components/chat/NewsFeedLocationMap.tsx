"use client";

import { CircleMarker, MapContainer, TileLayer, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { LatLngLiteral } from 'leaflet';

interface NewsFeedLocationMapProps {
  center: LatLngLiteral;
  onPick: (point: LatLngLiteral) => void;
}

function RecenterMap({ center }: { center: LatLngLiteral }) {
  const map = useMap();

  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);

  return null;
}

function MapClickHandler({ onPick }: { onPick: (point: LatLngLiteral) => void }) {
  const map = useMap();

  useEffect(() => {
    const handleClick = (event: import('leaflet').LeafletMouseEvent) => {
      onPick(event.latlng);
    };

    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onPick]);

  return null;
}

export default function NewsFeedLocationMap({ center, onPick }: NewsFeedLocationMapProps) {
  return (
    <MapContainer
      center={center}
      zoom={15}
      scrollWheelZoom
      className="h-80 w-full rounded-2xl"
    >
      <RecenterMap center={center} />
      <MapClickHandler onPick={onPick} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={center}
        radius={11}
        pathOptions={{
          color: '#1d59df',
          fillColor: '#5b8cff',
          fillOpacity: 0.3,
          weight: 2,
        }}
      />
    </MapContainer>
  );
}