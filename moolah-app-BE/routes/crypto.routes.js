const express = require('express');
const router = express.Router();

const ctrl = require('../controllers/crypto.controller');
const asyncHandler = require('../utils/asyncHandler');

router.get('/top-10', asyncHandler(ctrl.getTopCrypto));

module.exports = router;