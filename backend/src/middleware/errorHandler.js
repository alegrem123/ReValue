function toErrorCode(err, statusCode) {
  if (err.code && typeof err.code === 'string') return err.code;
  if (err.name === 'ValidationError') return 'VALIDATION_ERROR';
  if (err.name === 'CastError') return 'INVALID_ID';
  if (err.code === 11000) return 'DUPLICATE_KEY';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 401) return 'UNAUTHORIZED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 409) return 'CONFLICT';
  return 'INTERNAL_ERROR';
}

function notFoundHandler(req, res) {
  return res.status(404).json({
    ok: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} non trovata`,
  });
}

function errorHandler(err, _req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const message = safeStatusCode === 500 ? 'Errore interno del server' : err.message;

  return res.status(safeStatusCode).json({
    ok: false,
    error: toErrorCode(err, safeStatusCode),
    message,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
