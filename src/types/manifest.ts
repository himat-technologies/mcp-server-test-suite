export type ServerPreset = 'filesystem' | 'brave-search' | 'knowledge-graph' | 'postgresql' | 'custom';

export interface JsonRpcFrame {
  name: string;
  request: Record<string, unknown>;
  expected?: Record<string, unknown>;
  expectedError?: { code?: number; message?: string };
  capability?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  samples?: Array<{ args: Record<string, unknown>; expectedValid: boolean; label?: string }>;
}

export interface TestManifest {
  id: string;
  name: string;
  description: string;
  serverType: ServerPreset | string;
  protocolVersion: string;
  capabilities: string[];
  tools: McpTool[];
  frames: JsonRpcFrame[];
  createdAt?: string;
}

export type TestStatus = 'PASS' | 'FAIL' | 'SKIPPED';
export interface AssertionResult {
  id: string;
  name: string;
  status: TestStatus;
  explanation: string;
  expected: string;
  actual: string;
  durationMs: number;
  request?: unknown;
  response?: unknown;
  category: string;
}

export interface RunReport {
  id: string;
  timestamp: string;
  preset: string;
  suiteName: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  mode: 'mock';
  results: AssertionResult[];
}
