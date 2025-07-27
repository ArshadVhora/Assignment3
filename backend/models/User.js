const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true,
  },
  dob: {
    type: Date,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    default: 'patient',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
  strict: false,
});

// Add indexes for fast lookups
// 1. Unique index on email for login/registration
UserSchema.index({ email: 1 }, { unique: true });

// 2. Index on role for querying doctors vs. patients
UserSchema.index({ role: 1 });

// 3. (Optional) If you frequently search by name for directory lookups:
// UserSchema.index({ name: 'text' });

module.exports = mongoose.model('User', UserSchema);
