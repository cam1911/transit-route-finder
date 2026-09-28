function isPresent(value) {
  return value !== undefined && value !== null;
}

export function createTransitApi() {
  const caches = {
    nearby: new Map(),
    stop: new Map(),
    route: new Map(),
  };
  const controllers = {
    nearby: null,
    stop: null,
    route: null,
  };

  async function request(kind, key, url) {
    controllers[kind]?.abort();
    const cached = caches[kind].get(key);
    if (cached) return cached;

    const controller = new AbortController();
    controllers[kind] = controller;
    try {
      const response = await fetch(url, { signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Transit data could not be loaded.");
      caches[kind].set(key, data);
      return data;
    } finally {
      if (controllers[kind] === controller) controllers[kind] = null;
    }
  }

  return {
    nearby(position, radius) {
      const key = `${position.lat.toFixed(6)}:${position.lng.toFixed(6)}:${radius}`;
      return request(
        "nearby",
        key,
        `/api/transit/stops/nearby?lat=${position.lat}&lng=${position.lng}&radiusMiles=${radius}`,
      );
    },
    stop(stopId) {
      return request("stop", String(stopId), `/api/transit/stops/${encodeURIComponent(stopId)}`);
    },
    route(routeId, direction) {
      const params = new URLSearchParams();
      if (isPresent(direction?.id)) {
        params.set("directionId", direction.id);
      }
      if (direction?.headsign) params.set("headsign", direction.headsign);
      const url = `/api/transit/routes/${encodeURIComponent(routeId)}${params.size ? `?${params}` : ""}`;
      return request("route", url, url);
    },
    cancel(kind) {
      controllers[kind]?.abort();
      controllers[kind] = null;
    },
    dispose() {
      Object.values(controllers).forEach((controller) => {
        controller?.abort();
      });
    },
  };
}
