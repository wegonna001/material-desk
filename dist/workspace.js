export function createView(id, from, to, source = {}) {
  return {
    id,
    from,
    to,
    view: source.view || 'index',
    preset: source.preset ?? 5,
    zoom: structuredClone(source.zoom || {}),
  };
}
export function closeView(group, id, fallback) {
  const index = group.tabs.findIndex((t) => t.id === id);
  if (index < 0) return group;
  const tabs = group.tabs.filter((t) => t.id !== id);
  if (!tabs.length) tabs.push(fallback());
  return { tabs, active: group.active === id ? tabs[Math.min(index, tabs.length - 1)].id : group.active };
}
export function readWorkspace(raw) {
  try {
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    for (const id of ['WPU08', 'WPU101', 'WPU133']) {
      const g = data.groups[id];
      if (
        !g ||
        !Array.isArray(g.tabs) ||
        !g.tabs.length ||
        g.tabs.length > 100 ||
        new Set(g.tabs.map((t) => t.id)).size !== g.tabs.length ||
        !g.tabs.some((t) => t.id === g.active)
      )
        return null;
      for (const t of g.tabs) {
        if (
          typeof t.id !== 'string' ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(t.from) ||
          !/^\d{4}-(0[1-9]|1[0-2])$/.test(t.to) ||
          t.from > t.to ||
          !['index', 'mom', 'yoy', 'vol', 'all'].includes(t.view)
        )
          return null;
        const zoom = {};
        for (const key of ['index', 'mom', 'yoy', 'vol']) {
          const z = t.zoom?.[key];
          if (
            z &&
            Number.isFinite(z.start) &&
            Number.isFinite(z.end) &&
            z.start >= 0 &&
            z.end <= 100 &&
            z.start <= z.end
          )
            zoom[key] = { start: z.start, end: z.end };
        }
        t.zoom = zoom;
        t.preset = [0, 1, 5, 10].includes(t.preset) ? t.preset : null;
      }
    }
    return data.groups;
  } catch {
    return null;
  }
}
