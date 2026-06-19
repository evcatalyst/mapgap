#!/usr/bin/env bash
set -o errexit -o pipefail -o nounset

. /valhalla/scripts/helpers.sh

VALHALLA_VERSION=$(valhalla_service --version | tr -d '\n')
echo "Valhalla version: ${VALHALLA_VERSION}"
echo ""

do_build_tar() {
  local build_tar_local=$1
  local options

  if ([[ "${build_tar_local}" == "True" && ! -f "${TILE_TAR}" ]]) || [[ "${build_tar_local}" == "Force" ]]; then
    options="-c ${CONFIG_FILE} -v"

    if ! [[ -z "${traffic_name}" ]]; then
      options="${options} -t"
    fi

    if [[ "${build_tar_local}" == "Force" ]]; then
      options="${options} --overwrite"
    fi

    valhalla_build_extract ${options} || exit 1
  fi
}

configure_cloud_run_port() {
  local service_port="${1:-${PORT:-8002}}"
  local listen_address="tcp://*:${service_port}"

  echo "INFO: Configuring Valhalla service to listen on ${listen_address}"
  jq --arg listen "${listen_address}" '.httpd.service.listen = $listen' "${CONFIG_FILE}" | sponge "${CONFIG_FILE}"
}

configure_prebuilt_runtime() {
  if [[ "${MAPGAP_PREBUILT_TILES:-False}" != "True" ]]; then
    return
  fi

  if ! test -f "${TILE_TAR}"; then
    echo "ERROR: MAPGAP_PREBUILT_TILES=True, but ${TILE_TAR} does not exist."
    exit 1
  fi

  echo "INFO: Using prebuilt Valhalla tiles from ${TILE_TAR}; runtime tile builds are disabled."
  export tile_urls=""
  export use_tiles_ignore_pbf="True"
  export force_rebuild="False"
  export build_tar="False"
  export build_elevation="False"
  export build_admins="False"
  export build_time_zones="False"
  export build_transit="False"
  export use_default_speeds_config="False"
}

wait_for_valhalla() {
  local service_port="${1}"

  for _ in {1..60}; do
    if (: >"/dev/tcp/127.0.0.1/${service_port}") 2>/dev/null; then
      return
    fi

    sleep 1
  done

  echo "ERROR: Valhalla did not open port ${service_port} in time."
  exit 1
}

start_valhalla() {
  local service_port="${VALHALLA_SERVICE_PORT:-8002}"

  if [[ "${MAPGAP_ENABLE_PROXY:-True}" != "True" ]]; then
    configure_cloud_run_port
    echo "INFO: Found config file. Starting valhalla service!"
    exec valhalla_service "${CONFIG_FILE}" "${server_threads}"
  fi

  configure_cloud_run_port "${service_port}"
  echo "INFO: Starting valhalla service on internal port ${service_port}."
  valhalla_service "${CONFIG_FILE}" "${server_threads}" &
  local valhalla_pid=$!

  wait_for_valhalla "${service_port}"

  echo "INFO: Starting MapGap Valhalla proxy on Cloud Run port ${PORT:-8080}."
  python3 /valhalla/scripts/mapgap-valhalla-proxy.py &
  local proxy_pid=$!

  trap 'kill "${proxy_pid}" "${valhalla_pid}" 2>/dev/null || true' TERM INT
  wait -n "${proxy_pid}" "${valhalla_pid}"
  local status=$?
  kill "${proxy_pid}" "${valhalla_pid}" 2>/dev/null || true
  wait "${proxy_pid}" "${valhalla_pid}" 2>/dev/null || true
  exit "${status}"
}

export server_threads=${server_threads:-$(nproc)}
configure_prebuilt_runtime

if [[ "${force_rebuild}" == "True" ]]; then
  build_tar="Force"
fi

if [[ "$1" == "build_tiles" ]]; then
  /valhalla/scripts/configure_valhalla.sh "${CONFIG_FILE}" "${CUSTOM_FILES}" "${TILE_DIR}" "${TILE_TAR}" || exit 1

  if [[ "${build_tar}" == "True" ]] || [[ "${build_tar}" == "Force" ]]; then
    do_build_tar "${build_tar}"
  elif [[ "${MAPGAP_PREBUILT_TILES:-False}" == "True" ]]; then
    echo "INFO: Prebuilt tile archive found. Skipping runtime tar build."
  else
    echo "WARNING: Skipping tar building. Expect degraded performance while using Valhalla."
  fi

  if [[ "${MAPGAP_PREBUILT_TILES:-False}" != "True" ]]; then
    find "${CUSTOM_FILES}" -type d -exec chmod 775 {} \;
    find "${CUSTOM_FILES}" -type f -exec chmod 664 {} \;
  fi

  if [[ "${serve_tiles}" == "True" ]]; then
    if test -f "${CONFIG_FILE}"; then
      start_valhalla
    else
      echo "WARNING: No config found!"
    fi

    exec "$@"
  else
    echo "INFO: Not serving tiles. Exiting."
  fi
elif [[ "$1" == "tar_tiles" ]]; then
  do_build_tar "${build_tar}"
else
  echo "ERROR: Unrecognized CMD: '$1'"
  exit 1
fi
