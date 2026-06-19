ARG VALHALLA_IMAGE=ghcr.io/gis-ops/docker-valhalla/valhalla:latest
FROM ${VALHALLA_IMAGE}

# Cloud Run must be configured to route traffic to this port.
EXPOSE 8002

ENV tile_urls="https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf" \
    use_tiles_ignore_pbf="False" \
    force_rebuild="False" \
    build_tar="True" \
    build_elevation="True" \
    build_admins="True" \
    build_time_zones="True" \
    update_existing_config="True" \
    server_threads="2"
