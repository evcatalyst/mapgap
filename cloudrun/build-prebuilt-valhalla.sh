#!/usr/bin/env bash
set -o errexit -o pipefail -o nounset

SOURCE_DIR="/tmp/mapgap-valhalla-source"
OUTPUT_NAME="${VALHALLA_EXTRACT_NAME:-ny-nj.osm.pbf}"
OUTPUT_PATH="/custom_files/${OUTPUT_NAME}"

if [[ -z "${VALHALLA_TILE_URLS:-}" ]]; then
  echo "ERROR: VALHALLA_TILE_URLS is required."
  exit 1
fi

rm -rf "${SOURCE_DIR}"
mkdir -p "${SOURCE_DIR}" /custom_files

IFS=',' read -r -a urls <<< "${VALHALLA_TILE_URLS}"

source_paths=()
extract_paths=()

for index in "${!urls[@]}"; do
  url="$(echo "${urls[$index]}" | xargs)"

  if [[ -z "${url}" ]]; then
    continue
  fi

  source_path="${SOURCE_DIR}/source-${index}.osm.pbf"
  echo "INFO: Downloading Valhalla OSM extract ${index}: ${url}"
  curl --location --fail --output "${source_path}" "${url}"
  source_paths+=("${source_path}")

  if [[ -n "${VALHALLA_EXTRACT_BBOX:-}" ]]; then
    extract_path="${SOURCE_DIR}/extract-${index}.osm.pbf"
    echo "INFO: Clipping extract ${index} to bbox ${VALHALLA_EXTRACT_BBOX}"
    osmium extract --overwrite --bbox "${VALHALLA_EXTRACT_BBOX}" "${source_path}" -o "${extract_path}"
    extract_paths+=("${extract_path}")
  fi
done

if [[ "${#source_paths[@]}" -eq 0 ]]; then
  echo "ERROR: VALHALLA_TILE_URLS did not contain any usable URLs."
  exit 1
fi

if [[ "${#extract_paths[@]}" -gt 0 ]]; then
  build_paths=("${extract_paths[@]}")
else
  build_paths=("${source_paths[@]}")
fi

rm -f "${OUTPUT_PATH}"

if [[ "${#build_paths[@]}" -eq 1 ]]; then
  echo "INFO: Preparing single Valhalla extract at ${OUTPUT_PATH}"
  cp "${build_paths[0]}" "${OUTPUT_PATH}"
else
  echo "INFO: Merging ${#build_paths[@]} Valhalla extracts into ${OUTPUT_PATH}"
  osmium merge --overwrite "${build_paths[@]}" -o "${OUTPUT_PATH}"
fi

rm -rf "${SOURCE_DIR}"

echo "INFO: Configuring and building precomputed Valhalla tiles."
/valhalla/scripts/configure_valhalla.sh /custom_files/valhalla.json /custom_files /custom_files/valhalla_tiles /custom_files/valhalla_tiles.tar
valhalla_build_extract -c /custom_files/valhalla.json -v

rm -f /custom_files/*.osm.pbf
find /custom_files -type d -exec chmod 775 {} \;
find /custom_files -type f -exec chmod 664 {} \;
