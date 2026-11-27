import { useState } from 'react';
import { MapPin } from 'lucide-react';

const TILE = 256;
const ZOOM = 15;
const TILE_URL = (x: number, y: number) => `https://tile.openstreetmap.org/${ZOOM}/${x}/${y}.png`;

/** Coordenadas → posición en el mosaico de OpenStreetMap (en tiles, con fracción). */
function toTile(lat: number, lng: number) {
  const n = 2 ** ZOOM;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

/**
 * Mapa estático sin librerías: 3×3 tiles de OSM alrededor del punto, corridos
 * para que el pin quede en el centro. Sin internet (intranet cerrada) los tiles
 * no cargan y queda el fondo con el pin; las coordenadas se muestran aparte.
 */
export default function LocationMap({ lat, lng, width = 280, height = 150 }: {
  lat: number; lng: number; width?: number; height?: number;
}) {
  const [failed, setFailed] = useState(false);
  const { x, y } = toTile(lat, lng);
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  // Píxel del punto dentro del mosaico de 3×3 (que empieza en tx-1, ty-1).
  const px = (x - tx + 1) * TILE;
  const py = (y - ty + 1) * TILE;

  return (
    <div className="relative overflow-hidden bg-ink-750" style={{ width, height }}>
      {!failed && (
        <div
          className="absolute grid grid-cols-3"
          style={{ width: TILE * 3, left: width / 2 - px, top: height / 2 - py }}
        >
          {[-1, 0, 1].flatMap((dy) => [-1, 0, 1].map((dx) => (
            <img
              key={`${dx}:${dy}`}
              src={TILE_URL(tx + dx, ty + dy)}
              alt=""
              width={TILE}
              height={TILE}
              loading="lazy"
              draggable={false}
              onError={() => setFailed(true)}
              className="block select-none"
            />
          )))}
        </div>
      )}
      <MapPin
        size={30}
        className="absolute -translate-x-1/2 -translate-y-full text-red-500 drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]"
        style={{ left: width / 2, top: height / 2 }}
        fill="currentColor"
        stroke="white"
        strokeWidth={1.5}
      />
      <span className="absolute bottom-0.5 right-1 rounded bg-white/75 px-1 text-[9px] leading-tight text-black/70">
        © OpenStreetMap
      </span>
    </div>
  );
}
