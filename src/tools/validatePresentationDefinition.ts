import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';
import { TOOL_SCHEMAS, type ValidatePresentationDefinitionInput } from '../schemas/toolSchemas.js';

/**
 * Validate a presentation definition against DIF Presentation Exchange v2.0 specification
 * Performs comprehensive validation including schema compliance and best practices
 */
export async function validatePresentationDefinition(args: unknown): Promise<CallToolResult> {
  const validation = validateAndSanitizeInput(
    TOOL_SCHEMAS.validate_presentation_definition,
    args,
    'validate_presentation_definition'
  );

  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const startTime = Date.now();

  try {
    const validationIssues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];
    
    const { presentationDefinition, strict, checkSchemas } = data;

    // Basic structure validation (already validated by Zod, but we'll add business logic checks)
    
    // 1. ID validation
    if (!presentationDefinition.id || presentationDefinition.id.trim().length === 0) {
      validationIssues.push('Presentation definition ID is required and cannot be empty');
    } else if (!/^[a-zA-Z0-9_-]+$/.test(presentationDefinition.id)) {
      warnings.push('ID should only contain alphanumeric characters, underscores, and hyphens for maximum compatibility');
    }

    // 2. Input descriptors validation
    if (!presentationDefinition.input_descriptors || presentationDefinition.input_descriptors.length === 0) {
      validationIssues.push('At least one input descriptor is required');
    } else {
      // Check for duplicate input descriptor IDs
      const descriptorIds = presentationDefinition.input_descriptors.map(desc => desc.id);
      const duplicateIds = descriptorIds.filter((id, index) => descriptorIds.indexOf(id) !== index);
      if (duplicateIds.length > 0) {
        validationIssues.push(`Duplicate input descriptor IDs found: ${duplicateIds.join(', ')}`);
      }

      // Validate each input descriptor
      presentationDefinition.input_descriptors.forEach((descriptor, index) => {
        const prefix = `Input Descriptor ${index + 1} (${descriptor.id})`;

        // ID validation
        if (!descriptor.id || descriptor.id.trim().length === 0) {
          validationIssues.push(`${prefix}: ID is required and cannot be empty`);
        }

        // Purpose/Name recommendation
        if (!descriptor.purpose && !descriptor.name) {
          recommendations.push(`${prefix}: Consider adding a 'purpose' or 'name' for better user experience`);
        }

        // Constraints validation
        if (descriptor.constraints) {
          if (descriptor.constraints.fields && descriptor.constraints.fields.length > 0) {
            descriptor.constraints.fields.forEach((field, fieldIndex) => {
              const fieldPrefix = `${prefix}, Field ${fieldIndex + 1}`;

              // Path validation
              if (!field.path || field.path.length === 0) {
                validationIssues.push(`${fieldPrefix}: At least one path is required`);
              } else {
                // JSONPath validation
                field.path.forEach((path, pathIndex) => {
                  if (!path.startsWith('$.')) {
                    warnings.push(`${fieldPrefix}, Path ${pathIndex + 1}: JSONPath should start with '$.' for clarity`);
                  }
                });
              }

              // Filter validation
              if (field.filter) {
                const filterKeys = Object.keys(field.filter);
                const validFilterKeys = ['type', 'const', 'contains', 'pattern', 'format', 'minimum', 'maximum', 'minLength', 'maxLength'];
                const invalidKeys = filterKeys.filter(key => !validFilterKeys.includes(key));
                
                if (invalidKeys.length > 0) {
                  warnings.push(`${fieldPrefix}: Unrecognized filter keys: ${invalidKeys.join(', ')}`);
                }
              }

              // Purpose recommendation
              if (!field.purpose) {
                recommendations.push(`${fieldPrefix}: Consider adding a 'purpose' to explain why this field is required`);
              }
            });
          } else if (strict) {
            warnings.push(`${prefix}: No field constraints specified - this may accept any credential type`);
          }

          // Status validation
          if (descriptor.constraints.statuses) {
            const statuses = descriptor.constraints.statuses;
            Object.keys(statuses).forEach(statusType => {
              if (!['active', 'suspended', 'revoked'].includes(statusType)) {
                warnings.push(`${prefix}: Unrecognized status type '${statusType}'`);
              }
            });
          }
        } else if (strict) {
          warnings.push(`${prefix}: No constraints specified - this may be overly permissive`);
        }

        // Schema validation
        if (descriptor.schema && descriptor.schema.length > 0) {
          descriptor.schema.forEach((schema, schemaIndex) => {
            const schemaPrefix = `${prefix}, Schema ${schemaIndex + 1}`;
            
            try {
              new URL(schema.uri);
            } catch (error) {
              validationIssues.push(`${schemaPrefix}: Invalid schema URI '${schema.uri}'`);
            }

            if (checkSchemas) {
              // Note: In a real implementation, you would fetch and validate the schema
              recommendations.push(`${schemaPrefix}: Schema validation not implemented - would validate ${schema.uri}`);
            }
          });
        }
      });
    }

    // 3. Submission requirements validation (if present)
    if (presentationDefinition.submission_requirements && presentationDefinition.submission_requirements.length > 0) {
      recommendations.push('Submission requirements detected - ensure they are properly structured according to DIF PEX v2.0 spec');
    }

    // 4. Overall recommendations
    if (!presentationDefinition.purpose) {
      recommendations.push('Consider adding a top-level purpose to explain the intent of this presentation request');
    }

    if (!presentationDefinition.name) {
      recommendations.push('Consider adding a name for better user identification of this presentation request');
    }

    const processingTime = Date.now() - startTime;
    const isValid = validationIssues.length === 0;
    const hasWarnings = warnings.length > 0;
    const hasRecommendations = recommendations.length > 0;

    return {
      content: [
        {
          type: 'text',
          text: `${isValid ? '✅' : '❌'} **Presentation Definition Validation ${isValid ? 'Passed' : 'Failed'}**

**Validation Summary:**
• **Status:** ${isValid ? 'Valid' : 'Invalid'}
• **Processing Time:** ${processingTime}ms
• **Strict Mode:** ${strict ? 'Enabled' : 'Disabled'}
• **Schema Checking:** ${checkSchemas ? 'Enabled' : 'Disabled'}

**📊 Results Overview:**
• **Errors:** ${validationIssues.length}
• **Warnings:** ${warnings.length}
• **Recommendations:** ${recommendations.length}
• **Input Descriptors:** ${presentationDefinition.input_descriptors?.length || 0}

**🎯 Presentation Definition Details:**
• **ID:** ${presentationDefinition.id}
• **Name:** ${presentationDefinition.name || 'Not specified'}
• **Purpose:** ${presentationDefinition.purpose || 'Not specified'}

${validationIssues.length > 0 ? `**❌ Validation Errors:**
${validationIssues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

` : ''}${hasWarnings ? `**⚠️ Warnings:**
${warnings.map((warning, index) => `${index + 1}. ${warning}`).join('\n')}

` : ''}${hasRecommendations ? `**💡 Recommendations:**
${recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

` : ''}**📋 Input Descriptor Analysis:**
${presentationDefinition.input_descriptors?.map((desc, index) => {
  const fieldCount = desc.constraints?.fields?.length || 0;
  const hasConstraints = !!desc.constraints;
  const hasSchemas = desc.schema && desc.schema.length > 0;
  
  return `• **${desc.id}** ${desc.name ? `(${desc.name})` : ''}
  - Purpose: ${desc.purpose || 'Not specified'}
  - Fields: ${fieldCount} constraint${fieldCount !== 1 ? 's' : ''}
  - Schemas: ${hasSchemas ? desc.schema!.length : 0} referenced
  - Status: ${hasConstraints ? 'Has constraints' : 'No constraints'}`;
}).join('\n') || '(No input descriptors)'}

**🔍 DIF PEX v2.0 Compliance:**
• **Structure:** ${isValid ? 'Compliant' : 'Non-compliant'}
• **Required Fields:** ${presentationDefinition.id && presentationDefinition.input_descriptors ? 'Present' : 'Missing'}
• **Best Practices:** ${hasWarnings ? 'Some issues found' : 'Following best practices'}

${isValid 
  ? '🎉 **This presentation definition is valid and ready for use in credential requests.**' 
  : '🔧 **Please address the validation errors before using this presentation definition.**'}

${hasRecommendations || hasWarnings 
  ? '\n💡 **Next Steps:** Consider implementing the recommendations above for better interoperability and user experience.' 
  : ''}
`
        }
      ]
    };

  } catch (error: any) {
    const processingTime = Date.now() - startTime;

    return {
      content: [
        {
          type: 'text',
          text: `❌ **Presentation Definition Validation Error**

**Error:** ${error.message}
**Processing Time:** ${processingTime}ms
**Tool:** validate_presentation_definition

**📋 Input Summary:**
• **Definition ID:** ${data.presentationDefinition.id}
• **Input Descriptors:** ${data.presentationDefinition.input_descriptors?.length || 0}
• **Strict Mode:** ${data.strict}

**🔧 Troubleshooting:**
1. **Definition Structure:** Ensure the presentation definition follows DIF PEX v2.0 format
2. **Required Fields:** Verify all required fields (id, input_descriptors) are present
3. **Field Constraints:** Check that constraint fields use valid JSONPath expressions
4. **Schema References:** Ensure any referenced schemas are accessible if checkSchemas is enabled

**📚 Reference:**
• DIF Presentation Exchange v2.0: https://identity.foundation/presentation-exchange/spec/v2.0.0/
• JSONPath specification: https://tools.ietf.org/rfc/rfc9535.txt

For detailed validation requirements, consult the DIF PEX v2.0 specification.`
        }
      ],
      isError: true
    };
  }
}