import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { RefreshCredentialInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Refresh an expiring or expired credential using W3C Credential Refresh specification
 * Supports automatic refresh service discovery and manual refresh endpoints
 */
export async function refreshCredential(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(RefreshCredentialInputSchema, args, 'refresh_credential');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { credentialId, refreshService } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const REFRESH_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/refresh`;

  try {
    console.log(`[RefreshCredential] Starting credential refresh for: ${credentialId}`);

    const payload = {
      credentialId,
      ...(refreshService && { refreshService })
    };

    const response = await fetch(REFRESH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to refresh credential: ${errorData.message}`);
    }

    const result = await response.json();

    // Analyze the refresh operation
    const oldCredential = result.originalCredential;
    const newCredential = result.refreshedCredential;
    const refreshInfo = result.refreshInfo || {};

    const summary = [
      `🔄 **Credential Refresh Results**`,
      ``,
      `• Original Credential ID: ${credentialId}`,
      `• New Credential ID: ${newCredential?.id || 'Generated automatically'}`,
      `• Refresh Method: ${refreshInfo.method || 'W3C Credential Refresh'}`,
      `• Refresh Service: ${refreshInfo.serviceEndpoint || refreshService || 'Auto-discovered'}`,
      `• Refresh Status: ${result.success ? '✅ Successful' : '❌ Failed'}`,
      ``
    ];

    if (result.success && oldCredential && newCredential) {
      // Compare expiration dates
      const oldExpiry = oldCredential.expirationDate || oldCredential.validUntil;
      const newExpiry = newCredential.expirationDate || newCredential.validUntil;
      
      summary.push(`**📅 Validity Period Comparison:**`);
      if (oldExpiry) {
        summary.push(`• Original Expiry: ${oldExpiry}`);
        const wasExpired = new Date(oldExpiry) < new Date();
        summary.push(`• Original Status: ${wasExpired ? '❌ Expired' : '⚠️ Expiring soon'}`);
      } else {
        summary.push(`• Original Expiry: No expiration date set`);
      }
      
      if (newExpiry) {
        summary.push(`• New Expiry: ${newExpiry}`);
        const timeUntilExpiry = new Date(newExpiry).getTime() - new Date().getTime();
        const daysUntilExpiry = Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24));
        summary.push(`• New Status: ✅ Valid for ${daysUntilExpiry} more days`);
      } else {
        summary.push(`• New Expiry: No expiration date (indefinite validity)`);
      }
      summary.push(``);

      // Compare credential content
      summary.push(`**🔍 Content Comparison:**`);
      const contentChanges = compareCredentialContent(oldCredential, newCredential);
      if (contentChanges.length === 0) {
        summary.push(`• Content: ✅ Unchanged (only validity period updated)`);
      } else {
        summary.push(`• Content: ⚠️ ${contentChanges.length} changes detected`);
        contentChanges.forEach((change, index) => {
          summary.push(`  ${index + 1}. ${change}`);
        });
      }
      summary.push(``);

      // Issuer and signature information
      summary.push(`**🔐 Security Information:**`);
      summary.push(`• Original Issuer: ${getIssuerInfo(oldCredential)}`);
      summary.push(`• New Issuer: ${getIssuerInfo(newCredential)}`);
      summary.push(`• Issuer Consistency: ${getIssuerInfo(oldCredential) === getIssuerInfo(newCredential) ? '✅ Same issuer' : '⚠️ Different issuer'}`);
      
      if (newCredential.proof) {
        summary.push(`• New Signature: ✅ Fresh cryptographic signature`);
        summary.push(`• Proof Type: ${newCredential.proof.type || 'Unknown'}`);
      }
      summary.push(``);

      // Refresh service information
      if (refreshInfo.serviceDiscovered) {
        summary.push(`**🔎 Service Discovery:**`);
        summary.push(`• Service Discovery: ✅ Automatic discovery successful`);
        summary.push(`• Discovered Endpoint: ${refreshInfo.serviceEndpoint}`);
        summary.push(`• Discovery Method: ${refreshInfo.discoveryMethod || 'DID Document'}`);
        summary.push(``);
      }

      // Chain of trust
      if (result.trustChain) {
        summary.push(`**🔗 Trust Chain:**`);
        summary.push(`• Original credential linked: ✅ Cryptographic reference maintained`);
        summary.push(`• Chain integrity: ${result.trustChain.valid ? '✅ Valid' : '❌ Broken'}`);
        summary.push(`• Refresh authorization: ${result.trustChain.authorized ? '✅ Authorized' : '❌ Unauthorized'}`);
        summary.push(``);
      }
    } else if (!result.success) {
      summary.push(`**❌ Refresh Failed:**`);
      summary.push(`• Reason: ${result.error || 'Unknown error'}`);
      if (result.retryable) {
        summary.push(`• Retry Possible: ✅ Yes, try again later`);
        summary.push(`• Suggested Retry: ${result.retryAfter || 'No specific time suggested'}`);
      } else {
        summary.push(`• Retry Possible: ❌ No, manual intervention required`);
      }
      summary.push(``);
    }

    // Usage recommendations
    summary.push(`**💡 Next Steps:**`);
    if (result.success) {
      summary.push(`• Replace the original credential with the refreshed version`);
      summary.push(`• Update any stored references to use the new credential ID`);
      summary.push(`• Verify the refreshed credential independently`);
      summary.push(`• Set up monitoring for the new expiration date`);
      if (result.originalCredential) {
        summary.push(`• Consider revoking the original credential if policy requires it`);
      }
    } else {
      summary.push(`• Check credential refresh service availability`);
      summary.push(`• Verify the credential is eligible for refresh`);
      summary.push(`• Contact the issuer if automatic refresh fails`);
      summary.push(`• Consider manual credential renewal process`);
    }

    return {
      content: [
        {
          type: 'text',
          text: summary.join('\n')
        },
        {
          type: 'text',
          text: `\`\`\`json\n${JSON.stringify({
            refreshSummary: {
              credentialId,
              success: result.success,
              refreshMethod: refreshInfo.method,
              serviceEndpoint: refreshInfo.serviceEndpoint,
              originalExpiry: oldCredential?.expirationDate || oldCredential?.validUntil,
              newExpiry: newCredential?.expirationDate || newCredential?.validUntil,
              contentChanges: result.success ? compareCredentialContent(oldCredential, newCredential).length : 0
            },
            refreshedCredential: result.success ? newCredential : null,
            refreshInfo: refreshInfo
          }, null, 2)}\n\`\`\``
        }
      ]
    };
  } catch (error: any) {
    // Check if it's a network error (HiveAuth API not available)
    if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
      return {
        content: [
          {
            type: 'text',
            text: `🔄 **Credential Refresh (Simulation Mode)**\n\n` +
                  `Since the HiveAuth API is not available, here's what the credential refresh would accomplish:\n\n` +
                  `**Input Analysis:**\n` +
                  `• Credential ID: ${credentialId}\n` +
                  `• Refresh Service: ${refreshService || 'Auto-discovery from credential'}\n\n` +
                  `**Expected Refresh Process:**\n` +
                  `• Locate credential by ID in the system\n` +
                  `• Check expiration status and refresh eligibility\n` +
                  `• Discover or use specified refresh service endpoint\n` +
                  `• Request new credential with extended validity period\n` +
                  `• Maintain credential content while updating temporal properties\n` +
                  `• Generate fresh cryptographic signatures\n\n` +
                  `**W3C Credential Refresh Benefits:**\n` +
                  `• Automated credential lifecycle management\n` +
                  `• Seamless validity period extension\n` +
                  `• Maintains trust chain and cryptographic integrity\n` +
                  `• Reduces manual intervention for routine renewals\n\n` +
                  `**To enable full refresh:** Ensure HiveAuth API is running at ${HIVEAUTH_API_BASE_URL}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Failed to refresh credential: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Compare two credentials and return list of changes
 */
function compareCredentialContent(oldCred: any, newCred: any): string[] {
  const changes: string[] = [];
  
  if (!oldCred || !newCred) return changes;

  // Compare credential subject
  if (JSON.stringify(oldCred.credentialSubject) !== JSON.stringify(newCred.credentialSubject)) {
    changes.push('Credential subject data modified');
  }

  // Compare types
  if (JSON.stringify(oldCred.type) !== JSON.stringify(newCred.type)) {
    changes.push('Credential types changed');
  }

  // Compare issuer
  if (getIssuerInfo(oldCred) !== getIssuerInfo(newCred)) {
    changes.push('Issuer information changed');
  }

  // Compare context
  if (JSON.stringify(oldCred['@context']) !== JSON.stringify(newCred['@context'])) {
    changes.push('JSON-LD context updated');
  }

  return changes;
}

/**
 * Extract issuer information from credential
 */
function getIssuerInfo(credential: any): string {
  if (!credential?.issuer) return 'Unknown';
  
  if (typeof credential.issuer === 'string') {
    return credential.issuer;
  }
  
  return credential.issuer.id || credential.issuer.name || 'Unknown';
}