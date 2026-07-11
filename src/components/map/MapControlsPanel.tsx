import { Bike, Car, Footprints, KeyRound, Layers3, Server } from "lucide-react";
import {
  ISOCHRONE_MODE_LABELS,
  ISOCHRONE_PRESET_LABELS,
  LABEL_DENSITY_LABELS,
  MOBILITY_MODE_ORDER,
  MOBILITY_MODES,
  ROUTING_PROVIDER_DESCRIPTIONS,
  ROUTING_PROVIDER_LABELS,
  ROUTING_PROVIDER_ORDER,
  TIME_OPTIONS,
  TRANSPORT_DESCRIPTIONS,
  TRANSPORT_LABELS,
} from "../../constants";
import type {
  IsochroneMode,
  IsochronePreset,
  LabelDensity,
  MobilityMode,
  RoutingProvider,
  TransportMode,
} from "../../types";
import { useMapIsoStore } from "../../store/useMapIsoStore";
import {
  getRoutingProviderUnavailableMessage,
  isRoutingProviderReady,
} from "../../lib/routingStatus";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Select } from "../ui/select";
import { Slider } from "../ui/slider";
import { Tabs } from "../ui/tabs";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const transportIcons: Record<TransportMode, typeof Car> = {
  "driving-car": Car,
  "cycling-regular": Bike,
  "foot-walking": Footprints,
};

type MapControlsPanelProps = {
  compact?: boolean;
  showValhallaAccessSecret?: boolean;
};

export function ValhallaAccessSecretField() {
  const settings = useMapIsoStore((state) => state.settings);
  const status = useMapIsoStore((state) => state.status);
  const setValhallaAccessSecret = useMapIsoStore((state) => state.setValhallaAccessSecret);

  if (settings.routingProvider !== "valhalla" || !status.apiCapabilities.valhallaRequiresSecret) {
    return null;
  }

  return (
    <label className="block">
      <span className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
        Valhalla access secret
      </span>
      <Input
        type="password"
        value={settings.valhallaAccessSecret}
        onChange={(event) => setValhallaAccessSecret(event.target.value)}
        placeholder="Enter shared secret"
        autoComplete="off"
      />
    </label>
  );
}

export function MapControlsPanel({
  compact = false,
  showValhallaAccessSecret = true,
}: MapControlsPanelProps) {
  const settings = useMapIsoStore((state) => state.settings);
  const status = useMapIsoStore((state) => state.status);
  const setIsochroneMode = useMapIsoStore((state) => state.setIsochroneMode);
  const setPreset = useMapIsoStore((state) => state.setPreset);
  const setTransportMode = useMapIsoStore((state) => state.setTransportMode);
  const setRoutingProvider = useMapIsoStore((state) => state.setRoutingProvider);
  const setMobilityMode = useMapIsoStore((state) => state.setMobilityMode);
  const setTimeBuckets = useMapIsoStore((state) => state.setTimeBuckets);
  const setTimeMinutes = useMapIsoStore((state) => state.setTimeMinutes);
  const setRingSpacingMinutes = useMapIsoStore((state) => state.setRingSpacingMinutes);
  const setOpacity = useMapIsoStore((state) => state.setOpacity);
  const setLabelDensity = useMapIsoStore((state) => state.setLabelDensity);

  return (
    <Card className="w-full">
      <CardHeader className={compact ? "pb-2" : "pb-3"}>
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-sky-500" aria-hidden="true" />
          <CardTitle>Isochrone controls</CardTitle>
        </div>
      </CardHeader>
      <CardContent className={compact ? "space-y-3" : "space-y-4"}>
        <Tabs<IsochroneMode>
          value={settings.isochroneMode}
          onValueChange={setIsochroneMode}
          ariaLabel="Isochrone mode"
          items={(Object.keys(ISOCHRONE_MODE_LABELS) as IsochroneMode[]).map((value) => ({
            value,
            label: ISOCHRONE_MODE_LABELS[value],
          }))}
        />

        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(ISOCHRONE_PRESET_LABELS) as IsochronePreset[]).map((preset) => (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={settings.preset === preset ? "primary" : "secondary"}
              onClick={() => setPreset(preset)}
            >
              {ISOCHRONE_PRESET_LABELS[preset]}
            </Button>
          ))}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Server className="h-3.5 w-3.5" aria-hidden="true" />
            Routing provider
          </p>
          <div className="grid grid-cols-2 gap-2">
            {ROUTING_PROVIDER_ORDER.map((provider: RoutingProvider) => {
              const selected = settings.routingProvider === provider;
              const available = isRoutingProviderReady(status, provider);

              return (
                <Button
                  key={provider}
                  type="button"
                  variant={selected ? "primary" : "secondary"}
                  size="sm"
                  title={
                    !available
                      ? getRoutingProviderUnavailableMessage(provider)
                      : ROUTING_PROVIDER_DESCRIPTIONS[provider]
                  }
                  onClick={() => setRoutingProvider(provider)}
                  aria-label={`Use ${ROUTING_PROVIDER_LABELS[provider]} routing`}
                >
                  {ROUTING_PROVIDER_LABELS[provider]}
                </Button>
              );
            })}
          </div>
        </div>

        {showValhallaAccessSecret && <ValhallaAccessSecretField />}

        <div>
          <p className="mb-2 block text-xs font-medium text-neutral-500">Access profile</p>
          <div className="grid grid-cols-4 gap-2">
            {MOBILITY_MODE_ORDER.map((mode: MobilityMode) => {
              const config = MOBILITY_MODES[mode];
              const selected = settings.mobilityMode === mode;

              return (
                <Button
                  key={mode}
                  type="button"
                  variant={selected ? "primary" : "secondary"}
                  size="sm"
                  title={config.description}
                  style={selected ? { backgroundColor: config.color } : undefined}
                  onClick={() => setMobilityMode(mode)}
                >
                  {config.shortLabel}
                </Button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 block text-xs font-medium text-neutral-500">Routing engine</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TRANSPORT_LABELS) as TransportMode[]).map((mode) => {
              const Icon = transportIcons[mode];
              return (
                <Button
                  key={mode}
                  type="button"
                  variant={settings.transportMode === mode ? "primary" : "secondary"}
                  size="sm"
                  title={TRANSPORT_DESCRIPTIONS[mode]}
                  onClick={() => setTransportMode(mode)}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {TRANSPORT_LABELS[mode]}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-neutral-500">Max time</span>
            <Select
              value={String(settings.timeMinutes)}
              onChange={(event) => setTimeMinutes(Number(event.target.value))}
            >
              {TIME_OPTIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-medium text-neutral-500">Label density</span>
            <Select
              value={settings.labelDensity}
              onChange={(event) => setLabelDensity(event.target.value as LabelDensity)}
            >
              {(Object.keys(LABEL_DENSITY_LABELS) as LabelDensity[]).map((density) => (
                <option key={density} value={density}>
                  {LABEL_DENSITY_LABELS[density]}
                </option>
              ))}
            </Select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[5, 10, 15, 20, 25, 30].map((bucket) => {
            const selected = settings.timeBuckets.includes(bucket);
            return (
              <Button
                key={bucket}
                type="button"
                size="sm"
                variant={selected ? "primary" : "secondary"}
                onClick={() => {
                  const next = selected
                    ? settings.timeBuckets.filter((value) => value !== bucket)
                    : [...settings.timeBuckets, bucket].sort((a, b) => a - b);
                  setTimeBuckets(next.length > 0 ? next : [bucket]);
                }}
              >
                {bucket}m
              </Button>
            );
          })}
        </div>

        <div className={compact ? "space-y-2" : "space-y-3"}>
          <label className="block">
            <span className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-500">
              <span>Opacity</span>
              <span>{Math.round(settings.opacity * 100)}%</span>
            </span>
            <Slider
              min={0.1}
              max={0.6}
              step={0.02}
              value={settings.opacity}
              onChange={(event) => setOpacity(Number(event.currentTarget.value))}
            />
          </label>
          <label className="block">
            <span className="mb-2 flex items-center justify-between text-xs font-medium text-neutral-500">
              <span>Ring spacing</span>
              <span>{settings.ringSpacingMinutes}m</span>
            </span>
            <Slider
              min={5}
              max={15}
              step={5}
              value={settings.ringSpacingMinutes}
              onChange={(event) => setRingSpacingMinutes(Number(event.currentTarget.value))}
            />
          </label>
        </div>
      </CardContent>
    </Card>
  );
}
