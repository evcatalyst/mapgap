import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { getApplicationConfig, initApplicationConfig } from "@kepler.gl/utils";
import App from "./App";
import { v3Store } from "./store";

// Kepler's default config includes Mapbox even when a MapLibre style is passed.
// Replace that registry before mounting so the alpha never validates or requests
// a Mapbox token. The remaining MapLibre entry is the local, token-free style.
const defaultConfig = getApplicationConfig();
initApplicationConfig({
  baseMapLibraryConfig: {
    maplibre: defaultConfig.baseMapLibraryConfig.maplibre,
  } as never,
  enableRasterTileLayer: false,
  enableWMSLayer: false,
  showReleaseBanner: false,
});

createRoot(document.getElementById("root")!).render(
  <Provider store={v3Store}>
    <App />
  </Provider>,
);
