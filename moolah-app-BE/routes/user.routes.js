const express = require('express');
const router = express.Router();

const auth = require('../middleware/authFirebase');
const requireAdmin = require('../middleware/requireAdmin');

const ctrl = require('../controllers/user.controller');
const asyncHandler = require('../utils/asyncHandler');

router.use(auth);

// Current user
router.get('/me', asyncHandler(ctrl.me));
router.put('/me', asyncHandler(ctrl.updateMe));
router.post('/', asyncHandler(ctrl.upsertMe)); // upsert current user's profile

// Admin endpoints
router.get('/:uid', requireAdmin, asyncHandler(ctrl.getById));
router.put('/:uid', requireAdmin, asyncHandler(ctrl.updateById));
router.delete('/:uid', requireAdmin, asyncHandler(ctrl.removeById));

module.exports = router;