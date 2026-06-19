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
  local service_port="${PORT:-8002}"
  local listen_address="tcp://*:${service_port}"

  echo "INFO: Configuring Valhalla service to listen on ${listen_address}"
  jq --arg listen "${listen_address}" '.httpd.service.listen = $listen' "${CONFIG_FILE}" | sponge "${CONFIG_FILE}"
}

export server_threads=${server_threads:-$(nproc)}

if [[ "${force_rebuild}" == "True" ]]; then
  build_tar="Force"
fi

if [[ "$1" == "build_tiles" ]]; then
  /valhalla/scripts/configure_valhalla.sh "${CONFIG_FILE}" "${CUSTOM_FILES}" "${TILE_DIR}" "${TILE_TAR}" || exit 1

  if [[ "${build_tar}" == "True" ]] || [[ "${build_tar}" == "Force" ]]; then
    do_build_tar "${build_tar}"
  else
    echo "WARNING: Skipping tar building. Expect degraded performance while using Valhalla."
  fi

  find "${CUSTOM_FILES}" -type d -exec chmod 775 {} \;
  find "${CUSTOM_FILES}" -type f -exec chmod 664 {} \;

  if [[ "${serve_tiles}" == "True" ]]; then
    if test -f "${CONFIG_FILE}"; then
      configure_cloud_run_port
      echo "INFO: Found config file. Starting valhalla service!"
      exec valhalla_service "${CONFIG_FILE}" "${server_threads}"
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
