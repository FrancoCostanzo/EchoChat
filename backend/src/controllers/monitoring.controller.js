const monitoringService = require('../services/monitoring.service');

class MonitoringController {
  async getDashboard(req, res) {
    const data = await monitoringService.getDashboard();
    res.json({ status: 'success', data });
  }

  async getCompleteSystemStatus(req, res) {
    const data = await monitoringService.getCompleteSystemStatus();
    res.json({ status: 'success', data });
  }

  async getSystemMetrics(req, res) {
    const data = await monitoringService.getSystemMetrics();
    res.json({ status: 'success', data });
  }

  async getDetailedPoolStats(req, res) {
    const data = await monitoringService.getDetailedPoolStats();
    res.json({ status: 'success', data });
  }

  async getSnapshotHistory(req, res) {
    const range = req.query.range || '24h';
    const data = await monitoringService.getSnapshotHistory(range);
    res.json({ status: 'success', data });
  }

  async getLiveness(req, res) {
    const data = monitoringService.getLiveness();
    res.json({ status: 'success', data });
  }

  async getReadiness(req, res) {
    const data = await monitoringService.getReadiness();
    const statusCode = data.ready ? 200 : 503;
    res.status(statusCode).json({ status: 'success', data });
  }
}

module.exports = new MonitoringController();
