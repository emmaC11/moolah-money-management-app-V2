const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/currency.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/latest', asyncHandler(ctrl.getExchangeRates));

module.exports = router;