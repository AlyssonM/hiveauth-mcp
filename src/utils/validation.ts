import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Validation utilities for MCP tools with enhanced error reporting
 */

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: ValidationError;
}

export interface ValidationError {
  message: string;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  field: string;
  message: string;
  code: string;
  received?: any;
  expected?: string;
}

/**
 * Validates input data against a Zod schema with enhanced error reporting
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  toolName: string
): ValidationResult<T> {
  try {
    const result = schema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data
      };
    } else {
      const issues: ValidationIssue[] = result.error.issues.map(issue => ({
        field: issue.path.join('.') || 'root',
        message: issue.message,
        code: issue.code,
        received: (issue as any).received,
        expected: getExpectedType(issue)
      }));

      return {
        success: false,
        error: {
          message: `Invalid input for ${toolName}`,
          issues
        }
      };
    }
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: `Validation error for ${toolName}: ${error.message}`,
        issues: [{
          field: 'unknown',
          message: error.message,
          code: 'unknown_error'
        }]
      }
    };
  }
}

/**
 * Creates a CallToolResult for validation errors
 */
export function createValidationErrorResult(error: ValidationError): CallToolResult {
  const errorMessage = formatValidationError(error);
  
  return {
    content: [
      {
        type: 'text',
        text: errorMessage
      }
    ],
    isError: true
  };
}

/**
 * Formats validation errors into a human-readable message
 */
function formatValidationError(error: ValidationError): string {
  const lines = [
    `❌ ${error.message}`,
    '',
    '**Validation Issues:**'
  ];

  error.issues.forEach((issue, index) => {
    lines.push(`${index + 1}. **${issue.field}**: ${issue.message}`);
    
    if (issue.received !== undefined) {
      lines.push(`   - Received: \`${JSON.stringify(issue.received)}\``);
    }
    
    if (issue.expected) {
      lines.push(`   - Expected: ${issue.expected}`);
    }
    
    lines.push('');
  });

  lines.push('**How to fix:**');
  lines.push('- Check the parameter types and values');
  lines.push('- Ensure required fields are provided');
  lines.push('- Validate data formats (dates, URLs, etc.)');
  lines.push('- Refer to the tool documentation for examples');

  return lines.join('\n');
}

/**
 * Gets a human-readable expected type from a Zod issue
 */
function getExpectedType(issue: z.ZodIssue): string {
  const issueAny = issue as any;
  
  switch (issue.code) {
    case 'invalid_type':
      return `${issueAny.expected} (received ${issueAny.received})`;
    
    case 'invalid_string':
      if (issueAny.validation === 'email') return 'valid email address';
      if (issueAny.validation === 'url') return 'valid URL';
      if (issueAny.validation === 'datetime') return 'ISO 8601 date string';
      return 'valid string';
    
    case 'too_small':
      if (issueAny.type === 'array') return `array with at least ${issueAny.minimum} items`;
      if (issueAny.type === 'string') return `string with at least ${issueAny.minimum} characters`;
      if (issueAny.type === 'number') return `number >= ${issueAny.minimum}`;
      return `value >= ${issueAny.minimum}`;
    
    case 'too_big':
      if (issueAny.type === 'array') return `array with at most ${issueAny.maximum} items`;
      if (issueAny.type === 'string') return `string with at most ${issueAny.maximum} characters`;
      if (issueAny.type === 'number') return `number <= ${issueAny.maximum}`;
      return `value <= ${issueAny.maximum}`;
    
    case 'invalid_enum_value':
      return `one of: ${issueAny.options.map((o: any) => `"${o}"`).join(', ')}`;
    
    case 'unrecognized_keys':
      return `object without unexpected keys: ${issueAny.keys.join(', ')}`;
    
    default:
      return 'valid value';
  }
}

/**
 * Type guard for checking if data is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && 
         typeof value === 'object' && 
         !Array.isArray(value) &&
         Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Sanitizes input by removing undefined values and normalizing data
 */
export function sanitizeInput<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeInput(item)) as T;
  }

  if (isPlainObject(data)) {
    const sanitized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        sanitized[key] = sanitizeInput(value);
      }
    }
    
    return sanitized as T;
  }

  return data;
}

/**
 * Validates and sanitizes tool input in a single operation
 */
export function validateAndSanitizeInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  toolName: string
): ValidationResult<T> {
  // First sanitize the input
  const sanitized = sanitizeInput(data);
  
  // Then validate
  return validateInput(schema, sanitized, toolName);
}