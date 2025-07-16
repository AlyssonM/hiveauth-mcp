import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS } from '../schemas/toolSchemas.js';

/**
 * Converts Zod schemas to MCP tool definitions with JSON Schema
 */

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'issue_credential',
    description: 'Issue a new verifiable credential using HiveAuth. Supports both W3C VC Data Model 1.1 and 2.0 formats with comprehensive validation.',
    inputSchema: TOOL_SCHEMAS.issue_credential
  },
  {
    name: 'verify_credential',
    description: 'Verify a verifiable credential for authenticity, integrity, and revocation status. Checks signature, issuer validity, and status list compliance.',
    inputSchema: TOOL_SCHEMAS.verify_credential
  },
  {
    name: 'verify_presentation',
    description: 'Verify a verifiable presentation containing multiple credentials. Validates presentation signature, holder verification, and all included credentials.',
    inputSchema: TOOL_SCHEMAS.verify_presentation
  },
  {
    name: 'revoke_credential',
    description: 'Revoke a verifiable credential using W3C Status List 2021 specification. Updates the credential status in the bitstring status list.',
    inputSchema: TOOL_SCHEMAS.revoke_credential
  },
  {
    name: 'create_presentation_definition',
    description: 'Create a DIF Presentation Exchange v2.0 definition for requesting specific credentials. Defines input descriptors and constraints for credential selection.',
    inputSchema: TOOL_SCHEMAS.create_presentation_definition
  },
  {
    name: 'evaluate_presentation',
    description: 'Evaluate credentials against a presentation definition using DIF Presentation Exchange Protocol. Tests credential compliance and matching.',
    inputSchema: TOOL_SCHEMAS.evaluate_presentation
  },
  {
    name: 'batch_issue_credentials',
    description: 'Issue multiple verifiable credentials in parallel or sequentially. Supports up to 50 credentials per batch with comprehensive error handling and performance metrics.',
    inputSchema: TOOL_SCHEMAS.batch_issue_credentials
  },
  {
    name: 'batch_verify_credentials',
    description: 'Verify multiple verifiable credentials efficiently. Supports parallel processing, early termination on errors, and detailed verification statistics.',
    inputSchema: TOOL_SCHEMAS.batch_verify_credentials
  },
  {
    name: 'derive_credential',
    description: 'Derive credentials with selective disclosure using JSON-LD frames. Supports credential chaining and zero-knowledge proofs for privacy-preserving presentations.',
    inputSchema: TOOL_SCHEMAS.derive_credential
  },
  {
    name: 'refresh_credential',
    description: 'Refresh expiring or expired credentials using W3C Credential Refresh specification. Supports automatic service discovery and credential lifecycle management.',
    inputSchema: TOOL_SCHEMAS.refresh_credential
  },
  {
    name: 'submit_presentation',
    description: 'Create and submit verifiable presentations from evaluation results. Builds presentations that satisfy DIF PEX v2.0 requirements with holder binding and proof generation.',
    inputSchema: TOOL_SCHEMAS.submit_presentation
  },
  {
    name: 'validate_presentation_definition',
    description: 'Validate presentation definitions against DIF PEX v2.0 specification. Performs comprehensive compliance checking, best practices validation, and provides improvement recommendations.',
    inputSchema: TOOL_SCHEMAS.validate_presentation_definition
  },
  {
    name: 'generate_presentation_request',
    description: 'Generate complete presentation request flows with DIF PEX v2.0 definitions. Creates wallet-ready requests with security features, human-readable instructions, and multiple format support.',
    inputSchema: TOOL_SCHEMAS.generate_presentation_request
  }
];

/**
 * Converts Zod schemas to MCP Tool definitions
 */
export function createMCPTools(): Tool[] {
  return TOOL_DEFINITIONS.map(toolDef => ({
    name: toolDef.name,
    description: toolDef.description,
    inputSchema: zodToJsonSchema(toolDef.inputSchema, {
      target: 'jsonSchema7',
      definitions: {},
      $refStrategy: 'none'
    }) as any
  }));
}

/**
 * Get tool names for validation
 */
export function getToolNames(): string[] {
  return TOOL_DEFINITIONS.map(tool => tool.name);
}

/**
 * Validate that a tool name exists
 */
export function isValidToolName(name: string): boolean {
  return TOOL_DEFINITIONS.some(tool => tool.name === name);
}