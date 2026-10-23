export interface RpcValidation { valid: boolean; kind: 'request' | 'notification' | 'response' | 'error' | 'invalid'; errors: string[]; id?: string | number | null }
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export function validateJsonRpc(message: unknown): RpcValidation {
  const errors: string[] = [];
  if (!isObject(message)) return { valid: false, kind: 'invalid', errors: ['Message must be a JSON object'] };
  if (message.jsonrpc !== '2.0') errors.push('jsonrpc must equal "2.0"');
  const hasId = Object.prototype.hasOwnProperty.call(message, 'id');
  const hasMethod = Object.prototype.hasOwnProperty.call(message, 'method');
  const hasResult = Object.prototype.hasOwnProperty.call(message, 'result');
  const hasError = Object.prototype.hasOwnProperty.call(message, 'error');
  if (hasMethod) {
    if (typeof message.method !== 'string' || !message.method) errors.push('method must be a non-empty string');
    if (hasId && !(typeof message.id === 'string' || (typeof message.id === 'number' && Number.isFinite(message.id)) || message.id === null)) errors.push('id must be a string, finite number, or null');
    if ('params' in message && !isObject(message.params) && !Array.isArray(message.params)) errors.push('params must be an object or array when provided');
    return { valid: errors.length === 0, kind: hasId ? 'request' : 'notification', errors, ...(hasId ? { id: message.id as string | number | null } : {}) };
  }
  if (hasResult && hasError) errors.push('A response cannot contain both result and error');
  if (!hasId) errors.push('Response must include id');
  if (!(typeof message.id === 'string' || typeof message.id === 'number' || message.id === null)) errors.push('Response id must be a string, number, or null');
  if (hasError) {
    if (!isObject(message.error)) errors.push('error must be an object');
    else {
      if (typeof message.error.code !== 'number' || !Number.isFinite(message.error.code)) errors.push('error.code must be a number');
      if (typeof message.error.message !== 'string') errors.push('error.message must be a string');
    }
    if (!hasResult) return { valid: errors.length === 0, kind: 'error', errors, id: message.id as string | number | null };
  } else if (!hasResult) errors.push('Response must contain result or error');
  return { valid: errors.length === 0, kind: 'response', errors, ...(hasId ? { id: message.id as string | number | null } : {}) };
}

export function assertExpectedError(message: unknown, expected?: { code?: number; message?: string }): { valid: boolean; detail: string } {
  const result = validateJsonRpc(message);
  if (!expected) return { valid: false, detail: 'No expected error was specified.' };
  if (!result.valid || result.kind !== 'error' || !isObject(message) || !isObject(message.error)) return { valid: false, detail: `Expected a JSON-RPC error response; observed ${result.kind}.` };
  if (expected.code !== undefined && message.error.code !== expected.code) return { valid: false, detail: `Expected code ${expected.code}, received ${String(message.error.code)}.` };
  if (expected.message && !String(message.error.message).includes(expected.message)) return { valid: false, detail: `Expected message containing "${expected.message}".` };
  return { valid: true, detail: 'Error response matches the expected JSON-RPC error.' };
}
