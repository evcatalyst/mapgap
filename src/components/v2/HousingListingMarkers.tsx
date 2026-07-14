import L from "leaflet";
import { useState } from "react";
import { Marker, useMap, useMapEvents } from "react-leaflet";
import {
  formatCompactHousingPrice,
  type HousingListing,
} from "../../domain/housing";

type HousingListingMarkersProps = {
  listings: HousingListing[];
  selectedListingId?: string | null;
  shortlistedIds?: Set<string>;
  onSelect: (listing: HousingListing) => void;
};

function sourceColor(listing: HousingListing, shortlisted: boolean) {
  if (shortlisted) return "#047857";
  if (listing.source === "illustrative") return "#78716c";
  if (listing.provenance.access === "user-provided") return "#4f46e5";
  return "#0f766e";
}

function makeHousingIcon(
  listing: HousingListing,
  zoom: number,
  selected: boolean,
  shortlisted: boolean,
) {
  const compact = zoom <= 9;
  const label = compact ? "" : formatCompactHousingPrice(listing.price);
  const color = sourceColor(listing, shortlisted);
  const classes = [
    "mapgap-housing-marker",
    compact ? "mapgap-housing-marker--compact" : "",
    selected ? "mapgap-housing-marker--selected" : "",
    shortlisted ? "mapgap-housing-marker--shortlisted" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const width = compact ? 22 : label.length >= 6 ? 68 : 58;
  const height = compact ? 22 : 30;

  return L.divIcon({
    className: "mapgap-housing-marker-shell",
    html: `<div class="${classes}" style="--housing-marker-color:${color}"><span>${label}</span></div>`,
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
  });
}

export function HousingListingMarkers({
  listings,
  selectedListingId,
  shortlistedIds = new Set(),
  onSelect,
}: HousingListingMarkersProps) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({
    zoomend: () => setZoom(map.getZoom()),
  });

  return (
    <>
      {listings.map((listing) => {
        const selected = listing.id === selectedListingId;
        const shortlisted = shortlistedIds.has(listing.id);

        return (
          <Marker
            key={listing.id}
            position={[listing.location.lat, listing.location.lng]}
            icon={makeHousingIcon(listing, zoom, selected, shortlisted)}
            title={`${listing.title}, ${formatCompactHousingPrice(listing.price)}`}
            zIndexOffset={selected ? 500 : shortlisted ? 250 : 0}
            eventHandlers={{ click: () => onSelect(listing) }}
          />
        );
      })}
    </>
  );
}
