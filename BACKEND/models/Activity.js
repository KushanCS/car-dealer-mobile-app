const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VIEWED', 'SENT_EMAIL'],
      required: true,
    },
    entityType: {
      type: String,
      enum: ['VEHICLE', 'LEAD', 'APPOINTMENT', 'SALE', 'USER', 'STAFF', 'DOCUMENT', 'NOTIFICATION'],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      description: 'ID of the entity being acted upon',
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      description: 'User who performed the action',
    },
    userName: {
      type: String,
      description: 'Name of user for quick reference',
    },
    userRole: {
      type: String,
      enum: ['admin', 'staff', 'user'],
      description: 'Role of user who performed action',
    },
    title: {
      type: String,
      required: true,
      description: 'Human-readable title of the action',
    },
    description: {
      type: String,
      description: 'Detailed description of what was changed',
    },
    changes: {
      type: Object,
      description: 'Object containing before/after values for updates',
    },
    ipAddress: String,
    userAgent: String,
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'success',
    },
    metadata: {
      type: Object,
      description: 'Additional context-specific data',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
activitySchema.index({ userId: 1, timestamp: -1 });
activitySchema.index({ entityType: 1, timestamp: -1 });
activitySchema.index({ actionType: 1, timestamp: -1 });
activitySchema.index({ timestamp: -1 });

module.exports = mongoose.model('Activity', activitySchema);
