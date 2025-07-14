export interface RequestMetrics {
  requestId: string;
  agentId: string;
  sessionId: string;
  provider: string;
  model: string;
  timestamp: Date;
  duration: number; // milliseconds
  success: boolean;
  error?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number; // in USD
  promptLength: number;
  responseLength: number;
  tool_calls?: ToolCallMetric[];
  metadata?: Record<string, any>;
}

export interface ToolCallMetric {
  toolName: string;
  duration: number;
  success: boolean;
  error?: string;
  inputSize: number;
  outputSize: number;
}

export interface AgentMetrics {
  agentId: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  firstRequest: Date;
  lastRequest: Date;
  toolUsage: Record<string, number>;
  errorTypes: Record<string, number>;
  dailyStats: DailyStats[];
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
}

export interface SessionMetrics {
  sessionId: string;
  agentId: string;
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  duration: number; // session length in milliseconds
  startTime: Date;
  lastActivity: Date;
  toolsUsed: string[];
}

// Removed over-engineered CostBreakdown - cost is just a number

export interface MonitoringConfig {
  enabled: boolean;
  trackTokens: boolean;
  trackCosts: boolean;
  trackTools: boolean;
  trackErrors: boolean;
  storageType: 'memory' | 'file' | 'database';
  retentionDays: number;
  aggregationInterval: number; // minutes
}

// Removed over-engineered CostModel - cost calculation is now simple

export interface MonitoringEvent {
  type: 'request_start' | 'request_end' | 'tool_call' | 'error' | 'session_start' | 'session_end';
  timestamp: Date;
  agentId: string;
  sessionId?: string;
  requestId?: string;
  data: any;
}

export interface MonitoringStorage {
  saveMetrics(metrics: RequestMetrics): Promise<void>;
  getAgentMetrics(agentId: string, timeRange?: TimeRange): Promise<AgentMetrics>;
  getSessionMetrics(sessionId: string): Promise<SessionMetrics>;
  getRequestMetrics(requestId: string): Promise<RequestMetrics | null>;
  searchMetrics(query: MetricsQuery): Promise<RequestMetrics[]>;
  aggregateMetrics(agentId: string, interval: 'hour' | 'day' | 'week' | 'month'): Promise<AggregatedMetrics[]>;
  cleanup(olderThan: Date): Promise<number>; // returns number of deleted records
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface MetricsQuery {
  agentId?: string;
  sessionId?: string;
  provider?: string;
  model?: string;
  success?: boolean;
  timeRange?: TimeRange;
  limit?: number;
  offset?: number;
}

export interface AggregatedMetrics {
  timestamp: Date;
  requests: number;
  tokens: number;
  cost: number;
  averageResponseTime: number;
  successRate: number;
}

export interface AlertRule {
  id: string;
  name: string;
  agentId?: string;
  condition: AlertCondition;
  threshold: number;
  timeWindow: number; // minutes
  enabled: boolean;
  notifications: NotificationConfig[];
}

export interface AlertCondition {
  metric: 'cost' | 'tokens' | 'requests' | 'error_rate' | 'response_time';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  aggregation: 'sum' | 'avg' | 'count' | 'rate';
}

export interface NotificationConfig {
  type: 'email' | 'webhook' | 'slack';
  destination: string;
  template?: string;
}

export interface MonitoringDashboard {
  totalRequests: number;
  totalCost: number;
  totalTokens: number;
  averageResponseTime: number;
  successRate: number;
  topAgents: Array<{
    agentId: string;
    requests: number;
    cost: number;
    tokens: number;
  }>;
  recentErrors: Array<{
    timestamp: Date;
    agentId: string;
    error: string;
    count: number;
  }>;
  costTrends: Array<{
    date: string;
    cost: number;
    tokens: number;
  }>;
}