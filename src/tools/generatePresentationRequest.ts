import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';
import { TOOL_SCHEMAS, type GeneratePresentationRequestInput } from '../schemas/toolSchemas.js';
import { randomBytes } from 'crypto';

/**
 * Generate a complete presentation request flow with DIF PEX v2.0 definition
 * Creates presentation requests suitable for wallets and credential holders
 */
export async function generatePresentationRequest(args: unknown): Promise<CallToolResult> {
  const validation = validateAndSanitizeInput(
    TOOL_SCHEMAS.generate_presentation_request,
    args,
    'generate_presentation_request'
  );

  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const startTime = Date.now();

  try {
    const {
      presentationDefinition,
      verifierDid,
      callbackUrl,
      challenge,
      domain,
      expiresIn,
      requestFormat,
      includeInstructions
    } = data;

    // Generate unique challenge if not provided
    const requestChallenge = challenge || randomBytes(32).toString('hex');
    
    // Calculate expiration time
    const now = new Date();
    const expiresAt = new Date(now.getTime() + expiresIn! * 1000);

    // Generate request ID
    const requestId = `pex_req_${randomBytes(16).toString('hex')}`;

    // Create the presentation request structure
    const presentationRequest = {
      id: requestId,
      type: 'PresentationRequest',
      from: verifierDid || 'unknown_verifier',
      created_time: now.toISOString(),
      expires_time: expiresAt.toISOString(),
      challenge: requestChallenge,
      domain: domain,
      presentation_definition: presentationDefinition,
      callback_url: callbackUrl,
      format: requestFormat
    };

    // Generate human-readable instructions
    const instructions = includeInstructions ? generateInstructions(presentationDefinition) : null;

    // Create different formats based on requestFormat
    let formattedRequest: any;
    let contentType: string;

    if (requestFormat! === 'jwt') {
      // For JWT format, we'd typically sign this, but for demo purposes we'll show the structure
      const jwtPayload = {
        iss: verifierDid || 'unknown_verifier',
        aud: 'credential_holder',
        iat: Math.floor(now.getTime() / 1000),
        exp: Math.floor(expiresAt.getTime() / 1000),
        nonce: requestChallenge,
        presentation_definition: presentationDefinition,
        callback_url: callbackUrl
      };

      formattedRequest = {
        format: 'jwt',
        jwt_header: {
          alg: 'EdDSA',
          typ: 'JWT',
          kid: verifierDid ? `${verifierDid}#key-1` : 'verification_key'
        },
        jwt_payload: jwtPayload,
        note: 'In production, this would be a signed JWT token'
      };
      contentType = 'application/jwt';
    } else {
      formattedRequest = presentationRequest;
      contentType = 'application/json';
    }

    // Analyze the request complexity
    const analysisResults = analyzePresentationRequest(presentationDefinition);
    const processingTime = Date.now() - startTime;

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Presentation Request Generated Successfully**

**Request Overview:**
• **Request ID:** ${requestId}
• **Format:** ${requestFormat!.toUpperCase()}
• **Content Type:** ${contentType}
• **Processing Time:** ${processingTime}ms
• **Expires:** ${expiresAt.toISOString()} (in ${Math.round(expiresIn! / 60)} minutes)

**🎯 Request Details:**
• **Verifier DID:** ${verifierDid || 'Not specified'}
• **Challenge:** ${requestChallenge.substring(0, 16)}... (${requestChallenge.length} chars)
• **Domain:** ${domain || 'Not specified'}
• **Callback URL:** ${callbackUrl || 'Not specified'}

**📋 Presentation Definition Analysis:**
• **Definition ID:** ${presentationDefinition.id}
• **Purpose:** ${presentationDefinition.purpose || 'Not specified'}
• **Input Descriptors:** ${presentationDefinition.input_descriptors.length}
• **Complexity:** ${analysisResults.complexity}
• **Estimated Response Time:** ${analysisResults.estimatedTime}

**🔍 Requirements Summary:**
${analysisResults.requirementsSummary.map((req: any, index: number) => 
  `${index + 1}. **${req.id}**: ${req.description}`
).join('\n')}

${includeInstructions ? `**📖 Human-Readable Instructions:**

${instructions}

` : ''}**📄 Generated Request:**
\`\`\`json
${JSON.stringify(formattedRequest, null, 2)}
\`\`\`

**🚀 Usage Instructions:**

**For Wallet Integration:**
1. Present this request to the credential holder's wallet
2. The wallet should evaluate available credentials against the presentation definition
3. User selects which credentials to include in the response
4. Wallet creates a verifiable presentation matching the requirements
5. Presentation is submitted to the callback URL (if provided)

**For API Integration:**
\`\`\`javascript
// Send request to wallet/holder
const response = await fetch(walletEndpoint, {
  method: 'POST',
  headers: {
    'Content-Type': '${contentType}',
    'Accept': 'application/json'
  },
  body: JSON.stringify(${requestFormat! === 'jwt' ? 'formattedRequest.jwt_payload' : 'formattedRequest'})
});
\`\`\`

**For QR Code Generation:**
The request can be encoded as a QR code for mobile wallet scanning:
\`\`\`
presentation-request://${Buffer.from(JSON.stringify(formattedRequest)).toString('base64')}
\`\`\`

**🔒 Security Features:**
• **Challenge-Response:** ${requestChallenge ? 'Implemented' : 'Not used'}
• **Domain Binding:** ${domain ? 'Configured' : 'Not configured'}
• **Time-bound:** ${expiresIn!}s expiration
• **Request Integrity:** ${requestFormat! === 'jwt' ? 'JWT signed (in production)' : 'JSON format'}

**🔧 Verification Steps:**
1. **Receive Presentation:** Wait for holder to submit presentation
2. **Validate Challenge:** Ensure challenge matches this request
3. **Check Expiration:** Verify presentation submitted before expiry
4. **Evaluate Compliance:** Use \`evaluate_presentation\` tool to check requirements
5. **Verify Signatures:** Validate all credential and presentation signatures

${analysisResults.recommendations.length > 0 ? `**💡 Optimization Recommendations:**
${analysisResults.recommendations.map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

` : ''}🎉 **Request ready for deployment!** Share this with credential holders or integrate into your verification workflow.
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
          text: `❌ **Presentation Request Generation Error**

**Error:** ${error.message}
**Processing Time:** ${processingTime}ms
**Tool:** generate_presentation_request

**📋 Input Summary:**
• **Definition ID:** ${data.presentationDefinition.id}
• **Request Format:** ${data.requestFormat}
• **Verifier DID:** ${data.verifierDid || 'Not specified'}
• **Expires In:** ${data.expiresIn}s

**🔧 Troubleshooting:**
1. **Definition Validity:** Ensure presentation definition is valid DIF PEX v2.0 format
2. **URL Validation:** Check that callback URL is properly formatted if provided
3. **DID Format:** Verify verifier DID follows proper DID specification
4. **Time Bounds:** Ensure expiresIn is reasonable (60s - 24h)

**🌐 Common Issues:**
• Invalid presentation definition structure
• Malformed callback URL
• Unrealistic expiration times
• Missing required fields in input descriptors

For assistance, validate your presentation definition using the \`validate_presentation_definition\` tool first.`
        }
      ],
      isError: true
    };
  }
}

/**
 * Analyze presentation request complexity and requirements
 */
function analyzePresentationRequest(presentationDefinition: any) {
  const inputDescriptors = presentationDefinition.input_descriptors || [];
  const totalFields = inputDescriptors.reduce((sum: number, desc: any) => 
    sum + (desc.constraints?.fields?.length || 0), 0
  );

  const complexity = totalFields === 0 ? 'Very Low' :
                    totalFields <= 3 ? 'Low' :
                    totalFields <= 8 ? 'Medium' :
                    totalFields <= 15 ? 'High' : 'Very High';

  const estimatedTime = totalFields === 0 ? '< 30 seconds' :
                       totalFields <= 3 ? '30-60 seconds' :
                       totalFields <= 8 ? '1-2 minutes' :
                       totalFields <= 15 ? '2-5 minutes' : '5+ minutes';

  const requirementsSummary = inputDescriptors.map((desc: any) => ({
    id: desc.id,
    description: desc.purpose || desc.name || `Credential matching descriptor ${desc.id}`
  }));

  const recommendations: string[] = [];

  if (inputDescriptors.length > 5) {
    recommendations.push('Consider reducing the number of input descriptors for better user experience');
  }

  if (totalFields > 10) {
    recommendations.push('High field count may lead to longer verification times');
  }

  if (!presentationDefinition.purpose) {
    recommendations.push('Add a purpose field to help users understand the request');
  }

  return {
    complexity,
    estimatedTime,
    requirementsSummary,
    recommendations
  };
}

/**
 * Generate human-readable instructions for the presentation request
 */
function generateInstructions(presentationDefinition: any): string {
  const purpose = presentationDefinition.purpose || 'verify your credentials';
  const inputDescriptors = presentationDefinition.input_descriptors || [];

  let instructions = `**Presentation Request: ${presentationDefinition.id}**\n\n`;
  instructions += `You are being asked to ${purpose}.\n\n`;
  instructions += `**Please provide the following credentials:**\n\n`;

  inputDescriptors.forEach((desc: any, index: number) => {
    const name = desc.name || desc.purpose || `Credential ${index + 1}`;
    instructions += `${index + 1}. **${name}**\n`;
    
    if (desc.purpose && desc.purpose !== name) {
      instructions += `   Purpose: ${desc.purpose}\n`;
    }

    if (desc.constraints?.fields?.length > 0) {
      instructions += `   Required information:\n`;
      desc.constraints.fields.forEach((field: any) => {
        const fieldName = field.purpose || 'Specific field';
        instructions += `   • ${fieldName}\n`;
      });
    }

    instructions += '\n';
  });

  instructions += `**What to do:**\n`;
  instructions += `1. Review the requirements above\n`;
  instructions += `2. Select credentials from your wallet that match these requirements\n`;
  instructions += `3. Confirm the presentation to share your credentials\n`;
  instructions += `4. Your privacy is protected - only requested information will be shared\n\n`;
  instructions += `**Security:** This request includes a unique challenge to prevent replay attacks.\n`;

  return instructions;
}