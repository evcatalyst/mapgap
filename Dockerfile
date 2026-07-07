ARG VALHALLA_IMAGE=ghcr.io/valhalla/valhalla-scripted:latest
FROM ${VALHALLA_IMAGE}

ARG VALHALLA_TILE_URLS=https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf,https://download.geofabrik.de/north-america/us/new-jersey-latest.osm.pbf
ARG VALHALLA_EXTRACT_BBOX=
ARG VALHALLA_EXTRACT_NAME=ny-nj.osm.pbf
ARG VALHALLA_SERVER_THREADS=2

# Build a regional graph into the image so Cloud Run startup only starts services.
COPY cloudrun/valhalla-cloud-run-entrypoint.sh /valhalla/scripts/mapgap-cloud-run-entrypoint.sh
COPY cloudrun/valhalla-secret-proxy.py /valhalla/scripts/mapgap-valhalla-proxy.py
COPY cloudrun/build-prebuilt-valhalla.sh /valhalla/scripts/mapgap-build-prebuilt-valhalla.sh
RUN apt-get update > /dev/null \
    && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y osmium-tool > /dev/null \
    && rm -rf /var/lib/apt/lists/* \
    && chmod 755 /valhalla/scripts/mapgap-cloud-run-entrypoint.sh \
    && chmod 755 /valhalla/scripts/mapgap-build-prebuilt-valhalla.sh

ENV tile_urls="" \
    use_tiles_ignore_pbf="False" \
    force_rebuild="False" \
    build_tar="True" \
    build_elevation="False" \
    build_admins="True" \
    build_time_zones="True" \
    build_transit="False" \
    update_existing_config="True" \
    use_default_speeds_config="False" \
    server_threads="${VALHALLA_SERVER_THREADS}"

RUN /valhalla/scripts/mapgap-build-prebuilt-valhalla.sh

ENTRYPOINT ["/valhalla/scripts/mapgap-cloud-run-entrypoint.sh"]
CMD ["build_tiles"]

EXPOSE 8002 8082

ENV MAPGAP_PREBUILT_TILES="True" \
    MAPGAP_ENABLE_PROXY="True" \
    VALHALLA_SERVICE_PORT="8002" \
    use_tiles_ignore_pbf="True" \
    force_rebuild="False" \
    build_tar="False" \
    build_elevation="False" \
    build_admins="False" \
    build_time_zones="False" \
    build_transit="False" \
    update_existing_config="True" \
    use_default_speeds_config="False"
