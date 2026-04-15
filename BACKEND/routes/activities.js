const express = require('express');
const auth = require('../middleware/auth.middleware');
const authorize = require('../middleware/authorize');
const {
  logActivity,
  getRecentActivities,
  getActivitySummary,
  getEntityActivities,
  deleteOldActivities,
} = require('../utils/activityLogger');

const router = express.Router();

/**
 * GET /api/activities/recent
 * Get recent activities
 * Query params:
 *   - limit: number (default: 20)
 *   - skip: number (default: 0)
 *   - entityType: string (optional)
 *   - actionType: string (optional)
 */
router.get('/recent', auth, authorize('admin'), async (req, res) => {
  try {
    const { limit = 20, skip = 0, entityType, actionType } = req.query;

    const activities = await getRecentActivities({
      limit: parseInt(limit),
      skip: parseInt(skip),
      entityType,
      actionType,
    });

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activities',
      error: error.message,
    });
  }
});

/**
 * GET /api/activities/summary
 * Get activity summary for dashboard
 */
router.get('/summary', auth, authorize('admin'), async (req, res) => {
  try {
    const summary = await getActivitySummary();
    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity summary',
      error: error.message,
    });
  }
});

/**
 * GET /api/activities/entity/:entityType/:entityId
 * Get activities for a specific entity
 */
router.get('/entity/:entityType/:entityId', auth, authorize('admin'), async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    const activities = await getEntityActivities(entityType, entityId);

    res.json({
      success: true,
      data: activities,
      count: activities.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch entity activities',
      error: error.message,
    });
  }
});

/**
 * POST /api/activities/cleanup
 * Admin only: Delete activities older than specified days
 */
router.post('/cleanup', auth, authorize('admin'), async (req, res) => {
  try {
    const { daysOld = 90 } = req.body;

    const result = await deleteOldActivities(parseInt(daysOld));

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} old activities`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to cleanup activities',
      error: error.message,
    });
  }
});

module.exports = router;
