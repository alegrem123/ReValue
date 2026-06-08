const mongoose = require('mongoose');

function isValidObjectId(value) {
  return typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);
}

function validateObjectIdParam(paramName = 'id') {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!isValidObjectId(value)) {
      return res.status(400).json({ error: `${paramName} non valido` });
    }
    return next();
  };
}

function validateObjectIdBody(fieldName) {
  return (req, res, next) => {
    const value = req.body?.[fieldName];
    if (!isValidObjectId(value)) {
      return res.status(400).json({ error: `${fieldName} non valido` });
    }
    return next();
  };
}

module.exports = {
  isValidObjectId,
  validateObjectIdParam,
  validateObjectIdBody,
};
