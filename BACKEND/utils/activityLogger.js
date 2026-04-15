const Activity = require('../models/Activity');

/**
 * Log an activity
 * @param {Object} options - Activity options
 * @param {String} options.actionType - Type: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, VIEWED, SENT_EMAIL
 * @param {String} options.entityType - Type: VEHICLE, LEAD, APPOINTMENT, SALE, USER, STAFF, DOCUMENT, NOTIFICATION
 * @param {ObjectId} options.userId - User performing the action
 * @param {String} options.userName - Name of user
 * @param {String} options.userRole - Role of user
 * @param {String} options.title - Human-readable title
 * @param {String} options.description - Detailed description
 * @param {ObjectId} options.entityId - ID of entity being acted upon
 * @param {Object} options.changes - Before/after values
 * @param {String} options.ipAddress - IP address
 * @param {String} options.userAgent - User agent
 * @param {String} options.status - Status (success, failed, pending)
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<Object>} Created activity document
 */
async function logActivity(options) {
  try {
    const {
      actionType,
      entityType,
      userId,
      userName,
      userRole,
      title,
      description,
      entityId,
      changes,
      ipAddress,
      userAgent,
      status = 'success',
      metadata,
    } = options;

    if (!actionType || !entityType || !userId || !title) {
      console.warn('Missing required fields for activity logging', {
        actionType,
        entityType,
        userId,
        title,
      });
      return null;
    }

    const activity = new Activity({
      actionType,
      entityType,
      userId,
      userName,
      userRole,
      title,
      description,
      entityId,
      changes,
      ipAddress,
      userAgent,
      status,
      metadata,
      timestamp: new Date(),
    });

    await activity.save();
    return activity;
  } catch (error) {
    console.error('Error logging activity:', error);
    return null;
  }
}

/**
 * Get recent activities
 * @param {Object} options - Query options
 * @param {Number} options.limit - Number of records to return (default: 20)
 * @param {Number} options.skip - Number of records to skip (default: 0)
 * @param {String} options.entityType - Filter by entity type
 * @param {String} options.actionType - Filter by action type
 * @param {ObjectId} options.userId - Filter by user
 * @returns {Promise<Array>} Array of activities
 */
async function getRecentActivities(options = {}) {
  try {
    const {
      limit = 20,
      skip = 0,
      entityType,
      actionType,
      userId,
    } = options;

    const filter = {};

    if (entityType) filter.entityType = entityType;
    if (actionType) filter.actionType = actionType;
    if (userId) filter.userId = userId;

    const activities = await Activity.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .populate('userId', 'name email role')
      .lean();

    return activities;
  } catch (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
}

/**
 * Get activity count
 * @param {Object} filter - Filter conditions
 * @returns {Promise<Number>} Total count
 */
async function getActivityCount(filter = {}) {
  try {
    return await Activity.countDocuments(filter);
  } catch (error) {
    console.error('Error counting activities:', error);
    return 0;
  }
}

/**
 * Get activities for a specific entity
 * @param {String} entityType - Type of entity
 * @param {ObjectId} entityId - ID of entity
 * @returns {Promise<Array>} Activities for the entity
 */
async function getEntityActivities(entityType, entityId) {
  try {
    const activities = await Activity.find({
      entityType,
      entityId,
    })
      .sort({ timestamp: -1 })
      .populate('userId', 'name email')
      .lean();

    return activities;
  } catch (error) {
    console.error('Error fetching entity activities:', error);
    return [];
  }
}

/**
 * Get activity summary for dashboard
 * @returns {Promise<Object>} Activity summary
 */
async function getActivitySummary() {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [todayCount, weekCount, monthCount, byType, byAction] = await Promise.all([
      Activity.countDocuments({ timestamp: { $gte: today } }),
      Activity.countDocuments({ timestamp: { $gte: thisWeek } }),
      Activity.countDocuments({ timestamp: { $gte: thisMonth } }),
      Activity.aggregate([
        {
          $group: {
            _id: '$entityType',
            count: { $sum: 1 },
          },
        },
      ]),
      Activity.aggregate([
        {
          $group: {
            _id: '$actionType',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
      byType: byType,
      byAction: byAction,
    };
  } catch (error) {
    console.error('Error getting activity summary:', error);
    return {
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
      byType: [],
      byAction: [],
    };
  }
}

/**
 * Delete old activities (for cleanup)
 * @param {Number} daysOld - Delete activities older than this many days
 * @returns {Promise<Object>} Deletion result
 */
async function deleteOldActivities(daysOld = 90) {
  try {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await Activity.deleteMany({
      timestamp: { $lt: cutoffDate },
    });
    return result;
  } catch (error) {
    console.error('Error deleting old activities:', error);
    return null;
  }
}

module.exports = {
  logActivity,
  getRecentActivities,
  getActivityCount,
  getEntityActivities,
  getActivitySummary,
  deleteOldActivities,
};
