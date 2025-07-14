import {
  MonitoringStorage,
  RequestMetrics,
  AgentMetrics,
  SessionMetrics,
  TimeRange,
  MetricsQuery,
  AggregatedMetrics,
  DailyStats
} from '../types';

export class MemoryStorage implements MonitoringStorage {
  private metrics: RequestMetrics[] = [];
  private agentCache: Map<string, AgentMetrics> = new Map();
  private sessionCache: Map<string, SessionMetrics> = new Map();
  private lastCacheUpdate: Date = new Date();

  async saveMetrics(metrics: RequestMetrics): Promise<void> {
    this.metrics.push(metrics);
    this.invalidateCache();
  }

  async getAgentMetrics(agentId: string, timeRange?: TimeRange): Promise<AgentMetrics> {
    const cacheKey = `${agentId}_${timeRange?.start?.getTime()}_${timeRange?.end?.getTime()}`;
    
    if (this.agentCache.has(cacheKey) && this.isCacheValid()) {
      return this.agentCache.get(cacheKey)!;
    }

    const agentMetrics = await this.calculateAgentMetrics(agentId, timeRange);
    this.agentCache.set(cacheKey, agentMetrics);
    
    return agentMetrics;
  }

  async getSessionMetrics(sessionId: string): Promise<SessionMetrics> {
    if (this.sessionCache.has(sessionId) && this.isCacheValid()) {
      return this.sessionCache.get(sessionId)!;
    }

    const sessionMetrics = await this.calculateSessionMetrics(sessionId);
    this.sessionCache.set(sessionId, sessionMetrics);
    
    return sessionMetrics;
  }

  async getRequestMetrics(requestId: string): Promise<RequestMetrics | null> {
    return this.metrics.find(m => m.requestId === requestId) || null;
  }

  async searchMetrics(query: MetricsQuery): Promise<RequestMetrics[]> {
    let filtered = this.metrics;

    if (query.agentId) {
      filtered = filtered.filter(m => m.agentId === query.agentId);
    }

    if (query.sessionId) {
      filtered = filtered.filter(m => m.sessionId === query.sessionId);
    }

    if (query.provider) {
      filtered = filtered.filter(m => m.provider === query.provider);
    }

    if (query.model) {
      filtered = filtered.filter(m => m.model === query.model);
    }

    if (query.success !== undefined) {
      filtered = filtered.filter(m => m.success === query.success);
    }

    if (query.timeRange) {
      filtered = filtered.filter(m => 
        m.timestamp >= query.timeRange!.start && 
        m.timestamp <= query.timeRange!.end
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (query.offset) {
      filtered = filtered.slice(query.offset);
    }

    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }

    return filtered;
  }

  async aggregateMetrics(
    agentId: string, 
    interval: 'hour' | 'day' | 'week' | 'month'
  ): Promise<AggregatedMetrics[]> {
    const agentMetrics = this.metrics.filter(m => m.agentId === agentId);
    const aggregated = new Map<string, {
      requests: number;
      tokens: number;
      cost: number;
      responseTimeSum: number;
      successCount: number;
    }>();

    agentMetrics.forEach(metric => {
      const key = this.getIntervalKey(metric.timestamp, interval);
      const current = aggregated.get(key) || {
        requests: 0,
        tokens: 0,
        cost: 0,
        responseTimeSum: 0,
        successCount: 0
      };

      current.requests++;
      current.tokens += metric.totalTokens;
      current.cost += metric.cost;
      current.responseTimeSum += metric.duration;
      if (metric.success) current.successCount++;

      aggregated.set(key, current);
    });

    return Array.from(aggregated.entries()).map(([key, data]) => ({
      timestamp: this.parseIntervalKey(key, interval),
      requests: data.requests,
      tokens: data.tokens,
      cost: data.cost,
      averageResponseTime: data.responseTimeSum / data.requests,
      successRate: (data.successCount / data.requests) * 100
    })).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async cleanup(olderThan: Date): Promise<number> {
    const beforeCount = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp >= olderThan);
    const afterCount = this.metrics.length;
    
    this.invalidateCache();
    return beforeCount - afterCount;
  }

  private async calculateAgentMetrics(agentId: string, timeRange?: TimeRange): Promise<AgentMetrics> {
    const agentRequests = await this.searchMetrics({ agentId, timeRange });
    
    if (agentRequests.length === 0) {
      return {
        agentId,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalTokens: 0,
        totalCost: 0,
        averageResponseTime: 0,
        averageTokensPerRequest: 0,
        averageCostPerRequest: 0,
        firstRequest: new Date(),
        lastRequest: new Date(),
        toolUsage: {},
        errorTypes: {},
        dailyStats: []
      };
    }

    const totalRequests = agentRequests.length;
    const successfulRequests = agentRequests.filter(r => r.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const totalTokens = agentRequests.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCost = agentRequests.reduce((sum, r) => sum + r.cost, 0);
    const totalResponseTime = agentRequests.reduce((sum, r) => sum + r.duration, 0);

    // Tool usage statistics
    const toolUsage: Record<string, number> = {};
    agentRequests.forEach(r => {
      r.tool_calls?.forEach(tool => {
        toolUsage[tool.toolName] = (toolUsage[tool.toolName] || 0) + 1;
      });
    });

    // Error type statistics
    const errorTypes: Record<string, number> = {};
    agentRequests.filter(r => !r.success && r.error).forEach(r => {
      const errorType = this.categorizeError(r.error!);
      errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
    });

    // Daily statistics
    const dailyStats = this.calculateDailyStats(agentRequests);

    // Sort by timestamp to get first and last
    const sortedRequests = [...agentRequests].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return {
      agentId,
      totalRequests,
      successfulRequests,
      failedRequests,
      totalTokens,
      totalCost,
      averageResponseTime: totalResponseTime / totalRequests,
      averageTokensPerRequest: totalTokens / totalRequests,
      averageCostPerRequest: totalCost / totalRequests,
      firstRequest: sortedRequests[0].timestamp,
      lastRequest: sortedRequests[sortedRequests.length - 1].timestamp,
      toolUsage,
      errorTypes,
      dailyStats
    };
  }

  private async calculateSessionMetrics(sessionId: string): Promise<SessionMetrics> {
    const sessionRequests = await this.searchMetrics({ sessionId });
    
    if (sessionRequests.length === 0) {
      return {
        sessionId,
        agentId: '',
        messageCount: 0,
        totalTokens: 0,
        totalCost: 0,
        duration: 0,
        startTime: new Date(),
        lastActivity: new Date(),
        toolsUsed: []
      };
    }

    const agentId = sessionRequests[0].agentId;
    const totalTokens = sessionRequests.reduce((sum, r) => sum + r.totalTokens, 0);
    const totalCost = sessionRequests.reduce((sum, r) => sum + r.cost, 0);
    
    const sortedRequests = [...sessionRequests].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const startTime = sortedRequests[0].timestamp;
    const lastActivity = sortedRequests[sortedRequests.length - 1].timestamp;
    const duration = lastActivity.getTime() - startTime.getTime();

    const toolsUsed = new Set<string>();
    sessionRequests.forEach(r => {
      r.tool_calls?.forEach(tool => toolsUsed.add(tool.toolName));
    });

    return {
      sessionId,
      agentId,
      messageCount: sessionRequests.length,
      totalTokens,
      totalCost,
      duration,
      startTime,
      lastActivity,
      toolsUsed: Array.from(toolsUsed)
    };
  }

  private calculateDailyStats(requests: RequestMetrics[]): DailyStats[] {
    const dailyMap = new Map<string, {
      requests: number;
      tokens: number;
      cost: number;
      responseTimeSum: number;
    }>();

    requests.forEach(request => {
      const date = request.timestamp.toISOString().split('T')[0];
      const current = dailyMap.get(date) || {
        requests: 0,
        tokens: 0,
        cost: 0,
        responseTimeSum: 0
      };

      current.requests++;
      current.tokens += request.totalTokens;
      current.cost += request.cost;
      current.responseTimeSum += request.duration;

      dailyMap.set(date, current);
    });

    return Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        requests: stats.requests,
        tokens: stats.tokens,
        cost: stats.cost,
        averageResponseTime: stats.responseTimeSum / stats.requests
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private categorizeError(error: string): string {
    if (error.includes('rate limit') || error.includes('quota')) return 'Rate Limit';
    if (error.includes('auth') || error.includes('unauthorized')) return 'Authentication';
    if (error.includes('timeout')) return 'Timeout';
    if (error.includes('network') || error.includes('connection')) return 'Network';
    if (error.includes('invalid') || error.includes('validation')) return 'Validation';
    return 'Other';
  }

  private getIntervalKey(timestamp: Date, interval: 'hour' | 'day' | 'week' | 'month'): string {
    const date = new Date(timestamp);
    
    switch (interval) {
      case 'hour':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
      case 'day':
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      case 'week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.getFullYear()}-W${Math.ceil(weekStart.getDate() / 7)}`;
      case 'month':
        return `${date.getFullYear()}-${date.getMonth()}`;
      default:
        return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    }
  }

  private parseIntervalKey(key: string, interval: 'hour' | 'day' | 'week' | 'month'): Date {
    const parts = key.split('-');
    
    switch (interval) {
      case 'hour':
        return new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3]));
      case 'day':
        return new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
      case 'week':
        const year = parseInt(parts[0]);
        const week = parseInt(parts[1].substring(1));
        return new Date(year, 0, week * 7);
      case 'month':
        return new Date(parseInt(parts[0]), parseInt(parts[1]));
      default:
        return new Date(parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2]));
    }
  }

  private invalidateCache(): void {
    this.agentCache.clear();
    this.sessionCache.clear();
    this.lastCacheUpdate = new Date();
  }

  private isCacheValid(): boolean {
    const cacheMaxAge = 5 * 60 * 1000; // 5 minutes
    return (Date.now() - this.lastCacheUpdate.getTime()) < cacheMaxAge;
  }
}