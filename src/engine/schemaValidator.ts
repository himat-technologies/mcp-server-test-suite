import Ajv from 'ajv';
import type { McpTool } from '../types/manifest';
const ajv = new Ajv({ allErrors: true, strict: false, allowUnionTypes: true });
export interface ToolSampleResult { tool: string; label: string; valid: boolean; expectedValid: boolean; passed: boolean; errors: string[]; args: unknown }
export function validateToolArgs(tool: McpTool, args: unknown): { valid: boolean; errors: string[] } {
  try {
    const schema = { ...tool.inputSchema, $schema: 'http://json-schema.org/draft-07/schema#' };
    const validator = ajv.compile(schema);
    const valid = validator(args);
    return { valid: Boolean(valid), errors: (validator.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message ?? 'invalid'}`) };
  } catch (error) {
    return { valid: false, errors: [error instanceof Error ? error.message : 'Schema compilation failed'] };
  }
}
export function runToolSamples(tools: McpTool[]): ToolSampleResult[] {
  return tools.flatMap((tool) => (tool.samples ?? []).map((sample, index) => {
    const result = validateToolArgs(tool, sample.args);
    return { tool: tool.name, label: sample.label ?? `Sample ${index + 1}`, valid: result.valid, expectedValid: sample.expectedValid, passed: result.valid === sample.expectedValid, errors: result.errors, args: sample.args };
  }));
}
