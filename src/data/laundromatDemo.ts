import type { LatLng } from "../types";

export type DemoLocation = LatLng & {
  name: string;
  address?: string;
  sourceId?: string;
};

// Seeded from OpenStreetMap Overpass on 2026-07-06 for the hosted Capital Region
// Valhalla graph. Keep this list small enough for a reliable mobile demo.
export const CAPITAL_REGION_LAUNDRY_PLACES: DemoLocation[] = [
  {
    name: "Lucky Cat Laundromat",
    address: "Albany, NY",
    lat: 42.6461867,
    lng: -73.7559131,
    sourceId: "osm-node-1228524800",
  },
  {
    name: "Supreme Wash Laundromat",
    address: "849 Madison Avenue, Albany, NY",
    lat: 42.6609178,
    lng: -73.7821535,
    sourceId: "osm-node-1404738541",
  },
  {
    name: "University Laundry",
    address: "1148 Western Avenue, Albany, NY",
    lat: 42.675708,
    lng: -73.8214115,
    sourceId: "osm-node-5987495238",
  },
  {
    name: "Rocco's Laundromat",
    address: "Albany, NY",
    lat: 42.6554827,
    lng: -73.7644358,
    sourceId: "osm-node-9921548339",
  },
  {
    name: "The Missing Sock Laundromat",
    address: "Albany, NY",
    lat: 42.6516366,
    lng: -73.7678098,
    sourceId: "osm-node-9921611023",
  },
  {
    name: "Madison Coin Laundry",
    address: "783 Madison Avenue, Albany, NY",
    lat: 42.659675,
    lng: -73.7799062,
    sourceId: "osm-node-11079628042",
  },
  {
    name: "Capital South Laundry",
    address: "Albany, NY",
    lat: 42.6391914,
    lng: -73.7580915,
    sourceId: "osm-node-11345801417",
  },
  {
    name: "Washtime Laundromat",
    address: "1340 State Street, Schenectady, NY",
    lat: 42.7955831,
    lng: -73.9216357,
    sourceId: "osm-way-135620105",
  },
  {
    name: "Mayflower Laundromat",
    address: "Eastern Parkway, Schenectady, NY",
    lat: 42.8070335,
    lng: -73.9137302,
    sourceId: "osm-node-854682350",
  },
  {
    name: "Vinewood Laundromat",
    address: "2903 Guilderland Avenue, Schenectady, NY",
    lat: 42.783747,
    lng: -73.9713718,
    sourceId: "osm-node-8408478595",
  },
  {
    name: "EZ Wash Laundromat",
    address: "2513 Guilderland Avenue, Schenectady, NY",
    lat: 42.790383,
    lng: -73.9686438,
    sourceId: "osm-node-11040522837",
  },
  {
    name: "Midtowne Laundry Center",
    address: "Schenectady, NY",
    lat: 42.8001031,
    lng: -73.9265816,
    sourceId: "osm-node-11991055502",
  },
  {
    name: "Patricelli's Laundromat",
    address: "221 2nd Street, Troy, NY",
    lat: 42.7229987,
    lng: -73.693544,
    sourceId: "osm-node-8353947809",
  },
  {
    name: "Aqua Bright Laundromat",
    address: "2237 15th Street, Troy, NY",
    lat: 42.7357093,
    lng: -73.6760737,
    sourceId: "osm-way-1354747524",
  },
  {
    name: "West Troy Laundry",
    address: "1507 2nd Avenue, Watervliet, NY",
    lat: 42.7264267,
    lng: -73.702576,
    sourceId: "osm-way-875656340",
  },
  {
    name: "Cohoes Clean Clothes",
    address: "8 Garner Street, Cohoes, NY",
    lat: 42.7783431,
    lng: -73.7098199,
    sourceId: "osm-way-1028563787",
  },
];
