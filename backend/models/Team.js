const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  manager: { type: String, default: '' },
  members: [{ name: String, position: String, goals: { type: Number, default: 0 } }],
  group: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Team', TeamSchema);
