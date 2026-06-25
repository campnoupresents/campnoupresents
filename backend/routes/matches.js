const express = require('express');
const router = express.Router();
const Match = require('../models/Match');
const Team = require('../models/Team');
const auth = require('../middleware/auth');

// GET all matches - public read access
router.get('/', async (req, res) => {
  const matches = await Match.find().lean();
  res.json(matches);
});

// GET /standings - compute group standings from Finished matches only
// Optional query param: ?group=GroupA  (returns only that group's table)
router.get('/standings', async (req, res) => {
  try {
    const { group } = req.query;

    // Only count finished matches
    const filter = { status: 'Finished' };
    if (group) filter.group = group;

    const [finishedMatches, allTeams] = await Promise.all([
      Match.find(filter).lean(),
      Team.find().lean(),
    ]);

    // Build table keyed by team name
    const table = {};
    allTeams.forEach((t) => {
      table[t.name] = {
        team: t.name,
        group: t.group || '',
        played: 0, won: 0, drawn: 0, lost: 0,
        gf: 0, ga: 0, gd: 0, points: 0,
      };
    });

    finishedMatches.forEach((match) => {
      const t1 = table[match.team1];
      const t2 = table[match.team2];
      if (!t1 || !t2) return;

      t1.played += 1; t2.played += 1;
      t1.gf += Number(match.score1) || 0;
      t1.ga += Number(match.score2) || 0;
      t2.gf += Number(match.score2) || 0;
      t2.ga += Number(match.score1) || 0;

      if (match.score1 > match.score2) {
        t1.won += 1; t2.lost += 1; t1.points += 3;
      } else if (match.score1 < match.score2) {
        t2.won += 1; t1.lost += 1; t2.points += 3;
      } else {
        t1.drawn += 1; t2.drawn += 1; t1.points += 1; t2.points += 1;
      }
    });

    // Compute GD
    Object.values(table).forEach((r) => { r.gd = r.gf - r.ga; });

    // FIFA sort: Points → GD → GF → name
    const sorted = Object.values(table).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      if (b.gf !== a.gf) return b.gf - a.gf;
      return a.team.localeCompare(b.team);
    });

    // Group by group name
    const byGroup = {};
    sorted.forEach((row) => {
      const g = row.group || 'Unassigned';
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(row);
    });

    res.json({ standings: sorted, byGroup });
  } catch (err) {
    console.error('Error computing standings:', err);
    res.status(500).json({ error: 'Failed to compute standings' });
  }
});

// POST new match - requires auth
router.post('/', auth, async (req, res) => {
  const { team1, team2, group } = req.body;
  if (!team1 || !team2) return res.status(400).json({ error: 'teams required' });
  const m = await Match.create({ team1, team2, group: group || '' });
  res.json(m);
});

// PUT update match - requires auth
router.put('/:id', auth, async (req, res) => {
  const updates = req.body;
  const m = await Match.findByIdAndUpdate(req.params.id, updates, { new: true });
  res.json(m);
});

// DELETE match - requires auth
router.delete('/:id', auth, async (req, res) => {
  await Match.findByIdAndDelete(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
