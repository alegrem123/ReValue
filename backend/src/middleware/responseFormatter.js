function errorCodeFromStatus(statusCode) {
  if (statusCode === 400) return 'BAD_REQUEST';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode === 410) return 'GONE';
  if (statusCode >= 500) return 'INTERNAL_ERROR';
  return 'ERROR';
}

function normalizeErrorPayload(body, statusCode) {
  if (body && typeof body.error === 'object' && body.error !== null) {
    return {
      ok: false,
      error: body.error.code || errorCodeFromStatus(statusCode),
      message: body.error.message || 'Errore',
    };
  }

  return {
    ok: false,
    error: body?.code || errorCodeFromStatus(statusCode),
    message: body?.message || body?.error || 'Errore',
  };
}

function responseFormatter(req, res, next) {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'ok')) {
      if (body.ok === false && !body.message) {
        return originalJson(normalizeErrorPayload(body, res.statusCode || 500));
      }
      return originalJson(body);
    }

    const statusCode = res.statusCode || 200;
    if (statusCode >= 400) {
      return originalJson(normalizeErrorPayload(body, statusCode));
    }

    return originalJson({ ok: true, data: body ?? null });
  };

  return next();
}

module.exports = { responseFormatter };
