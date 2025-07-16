import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { EvaluatePresentationInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Evaluate credentials against a presentation definition using DIF PEX
 */
export async function evaluatePresentation(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(EvaluatePresentationInputSchema, args, 'evaluate_presentation');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { presentationDefinition, credentials } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const EVALUATE_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/presentation/evaluate`;

  try {
    const response = await fetch(EVALUATE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        presentationDefinition, 
        credentials 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to evaluate presentation: ${errorData.message}`);
    }

    const result = await response.json();

    const details = [
      `• Definition ID: ${presentationDefinition.id}`,
      `• Credentials Evaluated: ${credentials.length}`,
      `• Evaluation Status: ${result.canSubmit ? '✅ Can Submit' : '❌ Cannot Submit'}`,
      ''
    ];

    if (result.inputDescriptorResults) {
      details.push('Input Descriptor Results:');
      result.inputDescriptorResults.forEach((descriptorResult: any) => {
        const status = descriptorResult.canSubmit ? '✅' : '❌';
        details.push(`  • ${descriptorResult.inputDescriptor.id}: ${status} ${descriptorResult.canSubmit ? 'Satisfied' : 'Not satisfied'}`);
        
        if (descriptorResult.matchingCredentials) {
          details.push(`    - Matching credentials: ${descriptorResult.matchingCredentials.length}`);
          descriptorResult.matchingCredentials.forEach((match: any, index: number) => {
            const credId = match.credential?.id || `Credential ${index + 1}`;
            details.push(`      • ${credId}`);
          });
        }

        if (descriptorResult.errors && descriptorResult.errors.length > 0) {
          details.push(`    - Errors: ${descriptorResult.errors.length}`);
          descriptorResult.errors.forEach((error: string) => {
            details.push(`      • ${error}`);
          });
        }
        details.push('');
      });
    }

    if (result.errors && result.errors.length > 0) {
      details.push('Overall Errors:');
      result.errors.forEach((error: string) => {
        details.push(`  • ${error}`);
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: `Presentation Evaluation Result:\n\n${details.join('\n')}`
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
          text: `Failed to evaluate presentation: ${error.message}`
        }
      ],
      isError: true
    };
  }
}