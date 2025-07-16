import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';
import { TOOL_SCHEMAS, type SubmitPresentationInput } from '../schemas/toolSchemas.js';

/**
 * Submit a presentation based on evaluation results
 * Creates a verifiable presentation that satisfies the presentation definition requirements
 */
export async function submitPresentation(args: unknown): Promise<CallToolResult> {
  const validation = validateAndSanitizeInput(
    TOOL_SCHEMAS.submit_presentation,
    args,
    'submit_presentation'
  );

  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const startTime = Date.now();

  try {
    // First evaluate which credentials match the presentation definition
    const evaluationResponse = await fetch(`${process.env.HIVEAUTH_API_BASE_URL}/api/presentation/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        presentationDefinition: data.presentationDefinition,
        credentials: data.credentials
      })
    });

    if (!evaluationResponse.ok) {
      const errorText = await evaluationResponse.text();
      throw new Error(`Evaluation failed (${evaluationResponse.status}): ${errorText}`);
    }

    const evaluationResult = await evaluationResponse.json();

    // Check if evaluation was successful
    if (!evaluationResult.success || !evaluationResult.data) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Presentation Submission Failed**

**Error:** Credentials do not satisfy presentation definition requirements

**Evaluation Result:** ${JSON.stringify(evaluationResult, null, 2)}

**Resolution:** Ensure provided credentials match the input descriptors and constraints specified in the presentation definition.`
          }
        ],
        isError: true
      };
    }

    // Now submit the presentation with the matching credentials
    const submissionResponse = await fetch(`${process.env.HIVEAUTH_API_BASE_URL}/api/presentation/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        presentationDefinition: data.presentationDefinition,
        credentials: data.credentials,
        holderDid: data.holderDid,
        challenge: data.challenge,
        domain: data.domain
      })
    });

    if (!submissionResponse.ok) {
      const errorText = await submissionResponse.text();
      throw new Error(`Submission failed (${submissionResponse.status}): ${errorText}`);
    }

    const submissionResult = await submissionResponse.json();
    const processingTime = Date.now() - startTime;

    if (!submissionResult.success) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ **Presentation Submission Failed**

**Error:** ${submissionResult.error || 'Unknown submission error'}

**Processing Time:** ${processingTime}ms

**Evaluation Results:** ${JSON.stringify(evaluationResult.data, null, 2)}

**Debug Info:** Check that all required credentials are present and valid.`
          }
        ],
        isError: true
      };
    }

    // Analyze the submitted presentation
    const presentation = submissionResult.data.presentation;
    const presentationSubmission = submissionResult.data.presentationSubmission;
    
    const credentialCount = Array.isArray(presentation.verifiableCredential) 
      ? presentation.verifiableCredential.length 
      : 1;
    
    const inputDescriptorIds = data.presentationDefinition.input_descriptors.map(desc => desc.id);
    const submittedDescriptors = presentationSubmission?.descriptor_map?.map((desc: any) => desc.id) || [];
    
    const fulfillmentStatus = inputDescriptorIds.map(id => ({
      inputDescriptorId: id,
      fulfilled: submittedDescriptors.includes(id),
      descriptor: data.presentationDefinition.input_descriptors.find(desc => desc.id === id)
    }));

    const allRequirementsMet = fulfillmentStatus.every(status => status.fulfilled);

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Presentation Submission Successful**

**Submission Status:** ${allRequirementsMet ? 'All requirements satisfied' : 'Partial fulfillment'}
**Processing Time:** ${processingTime}ms
**Credentials Included:** ${credentialCount}
**Presentation ID:** ${presentation.id || 'Generated'}

**📋 Requirement Fulfillment:**
${fulfillmentStatus.map(status => 
  `• ${status.fulfilled ? '✅' : '❌'} **${status.inputDescriptorId}**: ${status.descriptor?.purpose || status.descriptor?.name || 'No description'}`
).join('\n')}

**🎯 Presentation Submission Details:**
• **Definition ID:** ${data.presentationDefinition.id}
• **Definition Purpose:** ${data.presentationDefinition.purpose || 'Not specified'}
• **Holder DID:** ${data.holderDid || presentation.holder || 'Not specified'}
• **Challenge:** ${data.challenge ? 'Included' : 'Not provided'}
• **Domain:** ${data.domain || 'Not specified'}

**📊 Submission Summary:**
• **Input Descriptors:** ${inputDescriptorIds.length} required
• **Submitted Descriptors:** ${submittedDescriptors.length} fulfilled  
• **Success Rate:** ${Math.round((submittedDescriptors.length / inputDescriptorIds.length) * 100)}%

**🔒 Security Features:**
• **Holder Binding:** ${presentation.holder ? 'Verified' : 'Anonymous'}
• **Challenge-Response:** ${data.challenge ? 'Protected' : 'Open'}
• **Domain Binding:** ${data.domain ? 'Domain-specific' : 'Cross-domain'}
• **Proof Type:** ${presentation.proof?.type || 'Not specified'}

**📄 Generated Presentation:**
\`\`\`json
${JSON.stringify(presentation, null, 2)}
\`\`\`

**📋 Presentation Submission:**
\`\`\`json
${JSON.stringify(presentationSubmission, null, 2)}
\`\`\`

${allRequirementsMet 
  ? '🎉 **Ready for verification** - This presentation can now be submitted to verifiers for validation.' 
  : '⚠️ **Partial fulfillment** - Some requirements may not be met. Review the fulfillment status above.'}
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
          text: `❌ **Presentation Submission Error**

**Error:** ${error.message}
**Processing Time:** ${processingTime}ms
**Tool:** submit_presentation

**📋 Input Summary:**
• **Definition ID:** ${data.presentationDefinition.id}
• **Credentials Count:** ${data.credentials.length}
• **Holder DID:** ${data.holderDid || 'Not specified'}

**🔧 Troubleshooting:**
1. **API Connectivity:** Ensure HiveAuth API is accessible at ${process.env.HIVEAUTH_API_BASE_URL}
2. **Credential Validity:** Verify all credentials are valid and properly formatted
3. **Definition Compliance:** Check that credentials meet presentation definition requirements
4. **Network Issues:** Verify network connectivity and API endpoint availability

**🌐 API Endpoints Used:**
• Evaluation: \`/api/presentation/evaluate\`
• Submission: \`/api/presentation/submit\`

For detailed debugging, check the HiveAuth API logs and ensure all required services are running.`
        }
      ],
      isError: true
    };
  }
}