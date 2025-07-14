import { EventEmitter } from 'events';
import {
  RequestMetrics,
  AgentMetrics,
  SessionMetrics,
  MonitoringConfig,
  MonitoringEvent,
  MonitoringStorage,
  TimeRange,
  MetricsQuery,
  ToolCallMetric,
  AlertRule,
  MonitoringDashboard
} from './types';
import { estimateCost } from '../utils/cost';
import { MemoryStorage } from './storage/MemoryStorage';

export class MonitoringService extends EventEmitter {
  private config: MonitoringConfig;
  private storage: MonitoringStorage;
  private activeRequests: Map<string, Partial<RequestMetrics>> = new Map();
  private activeSessions: Map<string, Partial<SessionMetrics>> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();

  constructor(config?: Partial<MonitoringConfig>, storage?: MonitoringStorage) {
    super();
    
    this.config = {
      enabled: true,
      trackTokens: true,
      trackCosts: true,
      trackTools: true,
      trackErrors: true,
      storageType: 'memory',
      retentionDays: 30,
      aggregationInterval: 5,
      ...config
    };

    this.storage = storage || new MemoryStorage();
    
    if (this.config.enabled) {
      this.startCleanupScheduler();
    }
  }

  // Request Tracking
  startRequest(
    requestId: string,
    agentId: string,
    sessionId: string,
    provider: string,
    model: string,
    promptLength: number,
    metadata?: Record<string, any>
  ): void {
    if (!this.config.enabled) return;

    const requestMetrics: Partial<RequestMetrics> = {
      requestId,
      agentId,
      sessionId,
      provider,
      model,
      timestamp: new Date(),
      promptLength,
      metadata
    };

    this.activeRequests.set(requestId, requestMetrics);
    this.emit('request_start', { requestId, agentId, sessionId });
  }

  endRequest(
    requestId: string,
    success: boolean,
    responseLength: number,
    inputTokens: number,
    outputTokens: number,
    toolCalls?: ToolCallMetric[],
    error?: string
  ): void {
    if (!this.config.enabled) return;

    const requestMetrics = this.activeRequests.get(requestId);
    if (!requestMetrics) {
      console.warn(`No active request found for ID: ${requestId}`);
      return;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - (requestMetrics.timestamp?.getTime() || 0);
    
    const cost = this.config.trackCosts ? 
      estimateCost(
        requestMetrics.provider!,
        requestMetrics.model!,
        inputTokens,
        outputTokens
      ) : 0;

    const completedMetrics: RequestMetrics = {
      ...requestMetrics,
      duration,
      success,
      responseLength,
      inputTokens: this.config.trackTokens ? inputTokens : 0,
      outputTokens: this.config.trackTokens ? outputTokens : 0,
      totalTokens: this.config.trackTokens ? inputTokens + outputTokens : 0,
      cost,
      tool_calls: this.config.trackTools ? toolCalls : undefined,
      error: this.config.trackErrors ? error : undefined
    } as RequestMetrics;

    this.storage.saveMetrics(completedMetrics);
    this.activeRequests.delete(requestId);
    
    this.emit('request_end', completedMetrics);
    this.checkAlerts(completedMetrics);
  }

  // Session Tracking
  startSession(sessionId: string, agentId: string): void {
    if (!this.config.enabled) return;

    const sessionMetrics: Partial<SessionMetrics> = {
      sessionId,
      agentId,
      messageCount: 0,
      totalTokens: 0,
      totalCost: 0,
      duration: 0,
      startTime: new Date(),
      lastActivity: new Date(),
      toolsUsed: []
    };

    this.activeSessions.set(sessionId, sessionMetrics);
    this.emit('session_start', { sessionId, agentId });
  }

  updateSession(sessionId: string, tokens: number, cost: number, toolsUsed: string[] = []): void {
    if (!this.config.enabled) return;

    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.messageCount = (session.messageCount || 0) + 1;
      session.totalTokens = (session.totalTokens || 0) + tokens;
      session.totalCost = (session.totalCost || 0) + cost;
      session.lastActivity = new Date();
      
      // Merge unique tools
      const currentTools = new Set(session.toolsUsed || []);
      toolsUsed.forEach(tool => currentTools.add(tool));
      session.toolsUsed = Array.from(currentTools);
    }
  }

  endSession(sessionId: string): void {
    if (!this.config.enabled) return;

    const session = this.activeSessions.get(sessionId);
    if (session) {
      const endTime = new Date();
      session.duration = endTime.getTime() - (session.startTime?.getTime() || 0);
      
      this.activeSessions.delete(sessionId);
      this.emit('session_end', session);
    }
  }

  // Tool Tracking
  trackToolCall(
    requestId: string,
    toolName: string,
    duration: number,
    success: boolean,
    inputSize: number,
    outputSize: number,
    error?: string
  ): void {
    if (!this.config.enabled || !this.config.trackTools) return;

    const toolMetric: ToolCallMetric = {
      toolName,
      duration,
      success,
      error,
      inputSize,
      outputSize
    };

    this.emit('tool_call', { requestId, toolMetric });
  }

  // Metrics Retrieval
  async getAgentMetrics(agentId: string, timeRange?: TimeRange): Promise<AgentMetrics> {
    return this.storage.getAgentMetrics(agentId, timeRange);
  }

  async getSessionMetrics(sessionId: string): Promise<SessionMetrics> {
    return this.storage.getSessionMetrics(sessionId);
  }

  async getRequestMetrics(requestId: string): Promise<RequestMetrics | null> {
    return this.storage.getRequestMetrics(requestId);
  }

  async searchMetrics(query: MetricsQuery): Promise<RequestMetrics[]> {
    return this.storage.searchMetrics(query);
  }

  async getDashboard(timeRange?: TimeRange): Promise<MonitoringDashboard> {
    const query: MetricsQuery = { timeRange };
    const allMetrics = await this.searchMetrics(query);

    const totalRequests = allMetrics.length;
    const successfulRequests = allMetrics.filter(m => m.success).length;
    const totalCost = allMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalTokens = allMetrics.reduce((sum, m) => sum + m.totalTokens, 0);
    const averageResponseTime = allMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests || 0;
    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    // Group by agent
    const agentStats = new Map();
    allMetrics.forEach(metric => {
      const current = agentStats.get(metric.agentId) || { requests: 0, cost: 0, tokens: 0 };
      current.requests++;
      current.cost += metric.cost;
      current.tokens += metric.totalTokens;
      agentStats.set(metric.agentId, current);
    });

    const topAgents = Array.from(agentStats.entries())
      .map(([agentId, stats]) => ({ agentId, ...stats }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    // Recent errors
    const recentErrors = allMetrics
      .filter(m => !m.success && m.error)
      .slice(-10)
      .map(m => ({
        timestamp: m.timestamp,
        agentId: m.agentId,
        error: m.error!,
        count: 1
      }));

    // Cost trends (daily)
    const costTrends = this.aggregateByCostTrends(allMetrics);

    return {
      totalRequests,
      totalCost,
      totalTokens,
      averageResponseTime,
      successRate,
      topAgents,
      recentErrors,
      costTrends
    };
  }

  // Alert Management
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
  }

  private checkAlerts(metrics: RequestMetrics): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      if (rule.agentId && rule.agentId !== metrics.agentId) continue;

      const shouldTrigger = this.evaluateAlertCondition(rule, metrics);
      if (shouldTrigger) {
        this.emit('alert', { rule, metrics });
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, metrics: RequestMetrics): boolean {
    let value: number;
    
    switch (rule.condition.metric) {
      case 'cost':
        value = metrics.cost;
        break;
      case 'tokens':
        value = metrics.totalTokens;
        break;
      case 'response_time':
        value = metrics.duration;
        break;
      case 'error_rate':
        value = metrics.success ? 0 : 1;
        break;
      default:
        return false;
    }

    switch (rule.condition.operator) {
      case 'gt':
        return value > rule.threshold;
      case 'gte':
        return value >= rule.threshold;
      case 'lt':
        return value < rule.threshold;
      case 'lte':
        return value <= rule.threshold;
      case 'eq':
        return value === rule.threshold;
      default:
        return false;
    }
  }

  private aggregateByCostTrends(metrics: RequestMetrics[]): Array<{ date: string; cost: number; tokens: number }> {
    const dailyStats = new Map<string, { cost: number; tokens: number }>();
    
    metrics.forEach(metric => {
      const date = metric.timestamp.toISOString().split('T')[0];
      const current = dailyStats.get(date) || { cost: 0, tokens: 0 };
      current.cost += metric.cost;
      current.tokens += metric.totalTokens;
      dailyStats.set(date, current);
    });

    return Array.from(dailyStats.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30); // Last 30 days
  }

  private startCleanupScheduler(): void {
    const cleanupInterval = 24 * 60 * 60 * 1000; // Daily cleanup
    
    setInterval(async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      try {
        const deleted = await this.storage.cleanup(cutoffDate);
        this.emit('cleanup', { deleted, cutoffDate });
      } catch (error) {
        this.emit('error', { type: 'cleanup_failed', error });
      }
    }, cleanupInterval);
  }

  // Configuration
  updateConfig(config: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Cost calculation is now handled by simple utility function
  }

  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // Cost Analysis
  async getCostAnalysis(agentId?: string, timeRange?: TimeRange): Promise<{
    totalCost: number;
    breakdown: Record<string, number>;
    trends: Array<{ date: string; cost: number }>;
    projections: { daily: number; monthly: number; yearly: number };
  }> {
    const query: MetricsQuery = { agentId, timeRange };
    const metrics = await this.searchMetrics(query);

    const totalCost = metrics.reduce((sum, m) => sum + m.cost, 0);
    
    // Breakdown by provider/model
    const breakdown: Record<string, number> = {};
    metrics.forEach(m => {
      const key = `${m.provider}/${m.model}`;
      breakdown[key] = (breakdown[key] || 0) + m.cost;
    });

    const trends = this.aggregateByCostTrends(metrics);
    
    // Simple projection based on recent average
    const recentDays = trends.slice(-7);
    const dailyAvg = recentDays.reduce((sum, day) => sum + day.cost, 0) / Math.max(recentDays.length, 1);
    
    return {
      totalCost,
      breakdown,
      trends,
      projections: {
        daily: dailyAvg,
        monthly: dailyAvg * 30,
        yearly: dailyAvg * 365
      }
    };
  }
}