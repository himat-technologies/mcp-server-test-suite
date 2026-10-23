import Ajv, { type ErrorObject } from 'ajv';
import type { TestManifest } from '../types/manifest';

export const manifestSchema = {
  type: 'object', additionalProperties: true,
  required: ['id', 'name', 'description', 'serverType', 'protocolVersion', 'capabilities', 'tools', 'frames'],
  properties: {
    id: { type: 'string', minLength: 1 }, name: { type: 'string', minLength: 1 }, description: { type: 'string' }, serverType: { type: 'string', minLength: 1 },
    protocolVersion: { type: 'string', minLength: 1 }, capabilities: { type: 'array', items: { type: 'string' } },
    tools: { type: 'array', items: { type: 'object', required: ['name', 'description', 'inputSchema'], properties: { name: { type: 'string', minLength: 1 }, description: { type: 'string' }, inputSchema: { type: 'object' } } } },
    frames: { type: 'array', items: { type: 'object', required: ['name', 'request'], properties: { name: { type: 'string' }, request: { type: 'object' } } } },
  },
} as const;
const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(manifestSchema);

export interface ValidationResult { valid: boolean; errors: Array<{ path: string; message: string }>; manifest?: TestManifest }
export function validateManifestText(text: string): ValidationResult {
  let data: unknown;
  try { data = JSON.parse(text); } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown JSON parse error';
    const lineMatch = message.match(/position (\d+)/i);
    const position = lineMatch ? Number(lineMatch[1]) : -1;
    const line = position >= 0 ? text.slice(0, position).split('\n').length : undefined;
    return { valid: false, errors: [{ path: line ? `JSON line ${line}` : 'JSON syntax', message }] };
  }
  const valid = validate(data);
  const errors = (validate.errors ?? []).map((e: ErrorObject) => ({ path: e.instancePath || '/', message: e.message ?? 'Invalid value' }));
  return { valid: Boolean(valid), errors, ...(valid ? { manifest: data as TestManifest } : {}) };
}

export function validateManifest(data: unknown): ValidationResult {
  return validateManifestText(JSON.stringify(data));
}
