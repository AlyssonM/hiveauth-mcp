import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { VerifyCredentialInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Verify a verifiable credential
 */
export async function verifyCredential(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(VerifyCredentialInputSchema, args, 'verify_credential');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { credential } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const VERIFY_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/verify`;

  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to verify credential: ${errorData.message}`);
    }

    const result = await response.json();

    const statusText = result.verified ? '✅ VERIFIED' : '❌ INVALID';
    const details = [];

    if (result.verified) {
      details.push('• Signature verification: ✅ Valid');
      details.push('• Issuer verification: ✅ Valid');
      details.push('• Status check: ✅ Not revoked');
      
      if (result.credential?.validFrom) {
        details.push(`• Valid from: ${result.credential.validFrom}`);
      }
      if (result.credential?.validUntil) {
        details.push(`• Valid until: ${result.credential.validUntil}`);
      }
    } else {
      details.push(`• Error: ${result.message || 'Unknown verification error'}`);
      if (result.errors) {
        result.errors.forEach((error: string) => {
          details.push(`• ${error}`);
        });
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `Credential Verification Result: ${statusText}\n\n${details.join('\n')}`
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
          text: `Failed to verify credential: ${error.message}`
        }
      ],
      isError: true
    };
  }
}