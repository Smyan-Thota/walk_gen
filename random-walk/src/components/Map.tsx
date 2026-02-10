"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import { useRouteStore } from "@/store/routeStore";

const MAPTILER_KEY = process.env.NEXT_PUBLIC_MAPTILER_KEY;

/** MapLibre GL map displaying the generated route and start marker. */
export default function MapView() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [mapError, setMapError] = useState(false);

  const routeResult = useRouteStore((s) => s.routeResult);
  const lat = useRouteStore((s) => s.lat);
  const lng = useRouteStore((s) => s.lng);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!MAPTILER_KEY) {
      setMapError(true);
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`,
      center: [lng ?? -122.4194, lat ?? 37.7749],
      zoom: 14,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map center when location changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) return;

    map.flyTo({ center: [lng, lat], zoom: 14 });

    if (markerRef.current) {
      markerRef.current.remove();
    }

    const el = document.createElement("div");
    el.style.width = "16px";
    el.style.height = "16px";
    el.style.borderRadius = "50%";
    el.style.backgroundColor = "#22c55e";
    el.style.border = "3px solid white";
    el.style.boxShadow = "0 0 4px rgba(0,0,0,0.3)";

    markerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat([lng, lat])
      .addTo(map);
  }, [lat, lng]);

  // Update route on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onLoad = () => {
      if (map.getSource("route")) {
        (map.getSource("route") as maplibregl.GeoJSONSource).setData(
          routeResult
            ? routeResult.candidate.geometry
            : { type: "FeatureCollection", features: [] }
        );
      } else if (routeResult) {
        map.addSource("route", {
          type: "geojson",
          data: routeResult.candidate.geometry,
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          paint: {
            "line-color": "#3b82f6",
            "line-width": 4,
          },
        });
      }

      if (routeResult) {
        const bbox = routeResult.candidate.bbox;
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 60, maxZoom: 16 }
        );
      }
    };

    if (map.isStyleLoaded()) {
      onLoad();
    } else {
      map.on("load", onLoad);
    }
  }, [routeResult]);

  if (mapError) {
    return (
      <div className="w-full h-[50vh] md:h-[60vh] bg-gray-100 flex items-center justify-center text-gray-500">
        Map tiles unavailable. Please check configuration.
      </div>
    );
  }

  return <div ref={mapContainerRef} className="w-full h-[50vh] md:h-[60vh] rounded-lg" />;
}
