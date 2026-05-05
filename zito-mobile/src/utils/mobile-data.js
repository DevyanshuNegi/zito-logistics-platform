export function readArray(payload, ...keys) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (payload.data && typeof payload.data === 'object') {
    for (const key of keys) {
      if (Array.isArray(payload.data[key])) {
        return payload.data[key];
      }
    }
  }

  return [];
}

export function readObject(payload, ...keys) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  for (const key of keys) {
    if (payload[key] && typeof payload[key] === 'object' && !Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    for (const key of keys) {
      if (payload.data[key] && typeof payload.data[key] === 'object' && !Array.isArray(payload.data[key])) {
        return payload.data[key];
      }
    }

    return payload.data;
  }

  return payload;
}
