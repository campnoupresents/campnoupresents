const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const auth = require('../middleware/auth');

// GET all teams - public read access
router.get('/', async (req, res) => {
  const teams = await Team.find().lean();
  res.json(teams);
});

// POST new team - requires auth
router.post('/', auth, async (req, res) => {
  const { name, manager, group } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const t = await Team.create({ name, manager: manager || '', group: group || '' });
  res.json(t);
});

// PUT update team - requires auth
router.put('/:id', auth, async (req, res) => {
  const updates = req.body;
  const t = await Team.findByIdAndUpdate(req.params.id, updates, { new: true });
  res.json(t);
});

// DELETE team - requires auth
router.delete('/:id', auth, async (req, res) => {
  await Team.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
