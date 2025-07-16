import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { VerifyPresentationInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Verify a verifiable presentation containing multiple credentials
 */
export async function verifyPresentation(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(VerifyPresentationInputSchema, args, 'verify_presentation');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { presentation } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const VERIFY_PRESENTATION_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/verify-presentation`;

  try {
    const response = await fetch(VERIFY_PRESENTATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ presentation }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to verify presentation: ${errorData.message}`);
    }

    const result = await response.json();

    const statusText = result.verified ? '✅ VERIFIED' : '❌ INVALID';
    const details = [];

    if (result.verified) {
      details.push('• Presentation signature: ✅ Valid');
      details.push('• Holder verification: ✅ Valid');
      
      const credentialCount = presentation.verifiableCredential?.length || 0;
      details.push(`• Credentials verified: ${credentialCount}`);
      
      if (result.credentialResults) {
        result.credentialResults.forEach((credResult: any, index: number) => {
          const credStatus = credResult.verified ? '✅' : '❌';
          details.push(`  - Credential ${index + 1}: ${credStatus} ${credResult.verified ? 'Valid' : 'Invalid'}`);
        });
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
          text: `Presentation Verification Result: ${statusText}\n\n${details.join('\n')}`
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
          text: `Failed to verify presentation: ${error.message}`
        }
      ],
      isError: true
    };
  }
}