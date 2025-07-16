#!/usr/bin/env node

/**
 * HiveAuth MCP Server
 * 
 * A Model Context Protocol server that provides tools for verifiable credential
 * operations using the HiveAuth ecosystem.
 */

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  CallToolResult,
  Tool
} from '@modelcontextprotocol/sdk/types.js';
// Import our HiveAuth tools
import { issueCredential } from './tools/issueCredential.js';
import { verifyCredential } from './tools/verifyCredential.js';
import { verifyPresentation } from './tools/verifyPresentation.js';
import { revokeCredential } from './tools/revokeCredential.js';
import { createPresentationDefinition } from './tools/createPresentationDefinition.js';
import { evaluatePresentation } from './tools/evaluatePresentation.js';
import { batchIssueCredentials } from './tools/batchIssueCredentials.js';
import { batchVerifyCredentials } from './tools/batchVerifyCredentials.js';
import { deriveCredential } from './tools/deriveCredential.js';
import { refreshCredential } from './tools/refreshCredential.js';
import { submitPresentation } from './tools/submitPresentation.js';
import { validatePresentationDefinition } from './tools/validatePresentationDefinition.js';
import { generatePresentationRequest } from './tools/generatePresentationRequest.js';

// Import schema utilities
import { createMCPTools, isValidToolName } from './utils/schemaConverter.js';

/**
 * Available tools for the HiveAuth MCP server (generated from Zod schemas)
 */
const TOOLS: Tool[] = createMCPTools();

/**
 * Create and configure the MCP server
 */
async function main() {
  const server = new Server(
    {
      name: 'hiveauth-mcp',
      version: '1.0.0',
      description: 'HiveAuth Model Context Protocol server for verifiable credential operations'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const { name, arguments: args } = request.params;

    // Validate tool name
    if (!isValidToolName(name)) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Unknown tool: ${name}\n\nAvailable tools: ${TOOLS.map(t => t.name).join(', ')}`
          }
        ],
        isError: true
      };
    }

    try {
      switch (name) {
        case 'issue_credential':
          return await issueCredential(args);
        
        case 'verify_credential':
          return await verifyCredential(args);
        
        case 'verify_presentation':
          return await verifyPresentation(args);
        
        case 'revoke_credential':
          return await revokeCredential(args);
        
        case 'create_presentation_definition':
          return await createPresentationDefinition(args);
        
        case 'evaluate_presentation':
          return await evaluatePresentation(args);
        
        case 'batch_issue_credentials':
          return await batchIssueCredentials(args);
        
        case 'batch_verify_credentials':
          return await batchVerifyCredentials(args);
        
        case 'derive_credential':
          return await deriveCredential(args);
        
        case 'refresh_credential':
          return await refreshCredential(args);
        
        case 'submit_presentation':
          return await submitPresentation(args);
        
        case 'validate_presentation_definition':
          return await validatePresentationDefinition(args);
        
        case 'generate_presentation_request':
          return await generatePresentationRequest(args);
        
        default:
          // This should never happen due to tool name validation above
          return {
            content: [
              {
                type: 'text',
                text: `❌ Unexpected error: Tool ${name} passed validation but is not implemented`
              }
            ],
            isError: true
          };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error.message}`
          }
        ],
        isError: true
      };
    }
  });

  // Connect using stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Optional: Log when server is ready
  if (process.env.NODE_ENV !== 'production') {
    console.error('HiveAuth MCP Server running on stdio');
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  process.exit(0);
});

process.on('SIGTERM', async () => {
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});