const express = require('express');
const router = express.Router();
const Tournament = require('../models/Tournament');
const auth = require('../middleware/auth');

// GET tournament - public read access
router.get('/', async (req, res) => {
  try {
    let t = await Tournament.findOne().lean();
    if (!t) {
      const created = await Tournament.create({ type: 'League', groups: {} });
      t = created.toObject();
    }
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tournament' });
  }
});

// PUT update tournament - requires auth
router.put('/', auth, async (req, res) => {
  try {
    let t = await Tournament.findOne();
    if (!t) {
      t = await Tournament.create(req.body);
    } else {
      if (req.body.type) t.type = req.body.type;
      if (req.body.groups !== undefined) {
        t.groups = req.body.groups;
        // Required: Mongoose Mixed fields need markModified to detect deep changes
        t.markModified('groups');
      }
      await t.save();
    }
    res.json(t.toObject());
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tournament' });
  }
});

module.exports = router;
