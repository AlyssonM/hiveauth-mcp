import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CreatePresentationDefinitionInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Create a DIF Presentation Exchange definition for requesting specific credentials
 */
export async function createPresentationDefinition(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(CreatePresentationDefinitionInputSchema, args, 'create_presentation_definition');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { id, name, purpose, inputDescriptors } = data;

  try {
    // Build the presentation definition according to DIF PEX v2.0 spec
    const presentationDefinition = {
      id,
      name,
      purpose,
      input_descriptors: inputDescriptors.map((descriptor: any) => ({
        id: descriptor.id,
        name: descriptor.name,
        purpose: descriptor.purpose,
        constraints: descriptor.constraints || {},
        schema: descriptor.schema || undefined
      }))
    };

    // Validate the structure
    if (!presentationDefinition.input_descriptors.length) {
      throw new Error('At least one input descriptor is required');
    }

    // Check for duplicate IDs
    const descriptorIds = presentationDefinition.input_descriptors.map((d: any) => d.id);
    const uniqueIds = new Set(descriptorIds);
    if (descriptorIds.length !== uniqueIds.size) {
      throw new Error('Input descriptor IDs must be unique');
    }

    const summary = [
      `• Definition ID: ${id}`,
      `• Name: ${name || 'Not specified'}`,
      `• Purpose: ${purpose || 'Not specified'}`,
      `• Input Descriptors: ${inputDescriptors.length}`,
      ''
    ];

    inputDescriptors.forEach((descriptor: any, index: number) => {
      summary.push(`Input Descriptor ${index + 1}:`);
      summary.push(`  • ID: ${descriptor.id}`);
      summary.push(`  • Name: ${descriptor.name || 'Not specified'}`);
      summary.push(`  • Purpose: ${descriptor.purpose || 'Not specified'}`);
      
      if (descriptor.constraints?.fields) {
        summary.push(`  • Field Constraints: ${descriptor.constraints.fields.length}`);
        descriptor.constraints.fields.forEach((field: any, fieldIndex: number) => {
          summary.push(`    - Field ${fieldIndex + 1}: ${field.path?.join(', ') || 'No path specified'}`);
        });
      }
      summary.push('');
    });

    return {
      content: [
        {
          type: 'text',
          text: `Created Presentation Definition:\n\n${summary.join('\n')}`
        },
        {
          type: 'text',
          text: `\`\`\`json\n${JSON.stringify(presentationDefinition, null, 2)}\n\`\`\``
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to create presentation definition: ${error.message}`
        }
      ],
      isError: true
    };
  }
}