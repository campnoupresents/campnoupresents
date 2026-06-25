const mongoose = require('mongoose');

const MatchSchema = new mongoose.Schema({
  team1: { type: String, required: true },
  team2: { type: String, required: true },
  score1: { type: Number, default: 0 },
  score2: { type: Number, default: 0 },
  status: { type: String, enum: ['Upcoming', 'Finished'], default: 'Upcoming' },
  group: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Match', MatchSchema);
