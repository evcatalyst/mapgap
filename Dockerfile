ARG VALHALLA_IMAGE=ghcr.io/valhalla/valhalla-scripted:latest
FROM ${VALHALLA_IMAGE}

ARG VALHALLA_TILE_URLS=https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf
ARG VALHALLA_SERVER_THREADS=2

# Build the Valhalla graph into the image so Cloud Run startup only starts services.
COPY cloudrun/valhalla-cloud-run-entrypoint.sh /valhalla/scripts/mapgap-cloud-run-entrypoint.sh
COPY cloudrun/valhalla-secret-proxy.py /valhalla/scripts/mapgap-valhalla-proxy.py
RUN chmod 755 /valhalla/scripts/mapgap-cloud-run-entrypoint.sh

ENV tile_urls="${VALHALLA_TILE_URLS}" \
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

RUN /valhalla/scripts/configure_valhalla.sh /custom_files/valhalla.json /custom_files /custom_files/valhalla_tiles /custom_files/valhalla_tiles.tar \
    && valhalla_build_extract -c /custom_files/valhalla.json -v \
    && rm -f /custom_files/*.osm.pbf \
    && find /custom_files -type d -exec chmod 775 {} \; \
    && find /custom_files -type f -exec chmod 664 {} \;

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
