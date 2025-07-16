import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { IssueCredentialInputSchema, type IssueCredentialInput } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Issue a new verifiable credential using HiveAuth
 */
export async function issueCredential(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(IssueCredentialInputSchema, args, 'issue_credential');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { credentialSubject, type, vcVersion = '2.0', expirationDate, validUntil, context, issuer } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const ISSUE_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/issue`;

  try {
    const payload: any = {
      credentialSubject,
      type,
      vcVersion
    };

    // Add optional fields if provided
    if (expirationDate) {
      payload.expirationDate = expirationDate;
    }
    
    if (validUntil) {
      payload.validUntil = validUntil;
    }
    
    if (context) {
      payload.context = context;
    }
    
    if (issuer) {
      payload.issuer = issuer;
    }

    const response = await fetch(ISSUE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to issue credential: ${errorData.message}`);
    }

    const result = await response.json();

    return {
      content: [
        {
          type: 'text',
          text: `Successfully issued ${vcVersion === '2.0' ? 'VC 2.0' : 'VC 1.1'} credential with ID: ${result.credential?.id || 'unknown'}`
        },
        {
          type: 'text',
          text: `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to issue credential: ${error.message}`
        }
      ],
      isError: true
    };
  }
}