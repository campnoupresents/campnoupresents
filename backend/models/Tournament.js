const mongoose = require('mongoose');

const TournamentSchema = new mongoose.Schema({
  type: { type: String, enum: ['League', 'Group Stage'], default: 'League' },
  // Using Mixed (plain object) instead of Map to avoid Mongoose serialization issues.
  // Structure: { "Group A": ["Team1", "Team2"], "Group B": [...] }
  groups: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('Tournament', TournamentSchema);

