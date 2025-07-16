import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { RevokeCredentialInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Revoke a verifiable credential using status lists
 */
export async function revokeCredential(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(RevokeCredentialInputSchema, args, 'revoke_credential');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { credentialId, statusListIndex, reason } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const REVOKE_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/revoke`;

  try {
    const response = await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        credentialId, 
        statusListIndex,
        reason
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to revoke credential: ${errorData.message}`);
    }

    const result = await response.json();

    const details = [
      `• Credential ID: ${credentialId}`,
      `• Status List Index: ${statusListIndex}`,
      `• Revocation Status: ✅ Successfully revoked`,
      `• Status List Updated: ${result.statusListCredential ? '✅ Yes' : '❌ No'}`
    ];

    if (result.statusListCredential?.id) {
      details.push(`• Updated Status List ID: ${result.statusListCredential.id}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: `Credential Revocation Result:\n\n${details.join('\n')}`
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
          text: `Failed to revoke credential: ${error.message}`
        }
      ],
      isError: true
    };
  }
}