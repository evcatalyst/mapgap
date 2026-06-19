ARG VALHALLA_IMAGE=ghcr.io/valhalla/valhalla-scripted:latest
FROM ${VALHALLA_IMAGE}

# Cloud Run injects PORT. Local Valhalla still defaults to 8002.
COPY cloudrun/valhalla-cloud-run-entrypoint.sh /valhalla/scripts/mapgap-cloud-run-entrypoint.sh
RUN chmod 755 /valhalla/scripts/mapgap-cloud-run-entrypoint.sh
ENTRYPOINT ["/valhalla/scripts/mapgap-cloud-run-entrypoint.sh"]
CMD ["build_tiles"]

EXPOSE 8002 8082

ENV tile_urls="https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf" \
    use_tiles_ignore_pbf="False" \
    force_rebuild="False" \
    build_tar="True" \
    build_elevation="True" \
    build_admins="True" \
    build_time_zones="True" \
    update_existing_config="True" \
    server_threads="2"
