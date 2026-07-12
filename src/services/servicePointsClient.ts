import type {
  MapBounds,
  ServicePointCategory,
  ServicePointResponse,
} from "../types";

function bboxParam(bounds: MapBounds) {
  return [bounds.west, bounds.south, bounds.east, bounds.north].join(",");
}

async function parseApiError(response: Response) {
  const raw = await response.text();

  try {
    const data = JSON.parse(raw) as { message?: string };
    return data.message || raw || response.statusText;
  } catch {
    return raw || response.statusText;
  }
}

export async function fetchServicePoints({
  category,
  bounds,
  extensions,
  query,
}: {
  category: ServicePointCategory;
  bounds: MapBounds;
  extensions?: string[];
  query?: string;
}) {
  const params = new URLSearchParams({
    category,
    bbox: bboxParam(bounds),
  });

  if (query?.trim()) {
    params.set("q", query.trim());
  }

  if (extensions && extensions.length > 0) {
    params.set("include", extensions.join(","));
  }

  let response: Response;

  try {
    response = await fetch(`/api/service-points?${params}`, {
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Service point search needs the MapGap API proxy. Run Netlify Dev locally and try again.",
      );
    }

    throw error;
  }

  if (!response.ok) {
    const message = await parseApiError(response);
    throw new Error(`Service point search ${response.status}: ${message}`);
  }

  const data = (await response.json()) as ServicePointResponse;

  if (!Array.isArray(data.points)) {
    throw new Error("Service point search returned no point data.");
  }

  return data;
}
