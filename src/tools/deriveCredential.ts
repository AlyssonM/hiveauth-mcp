import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { DeriveCredentialInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Derive a credential with selective disclosure using JSON-LD frames
 * Supports credential chaining and derived proof creation
 */
export async function deriveCredential(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(DeriveCredentialInputSchema, args, 'derive_credential');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { originalCredential, frame, nonce } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const DERIVE_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/derive`;

  try {
    console.log(`[DeriveCredential] Starting credential derivation for credential: ${originalCredential.id}`);

    const payload = {
      credential: originalCredential,
      frame,
      ...(nonce && { nonce })
    };

    const response = await fetch(DERIVE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`Failed to derive credential: ${errorData.message}`);
    }

    const result = await response.json();

    // Analyze the derivation
    const originalFields = extractCredentialFields(originalCredential);
    const derivedFields = extractCredentialFields(result.derivedCredential);
    const hiddenFields = originalFields.filter(field => !derivedFields.includes(field));
    const revealedFields = derivedFields;

    const summary = [
      `🔄 **Credential Derivation Results**`,
      ``,
      `• Original Credential ID: ${originalCredential.id || 'Not specified'}`,
      `• Derived Credential ID: ${result.derivedCredential?.id || 'Generated automatically'}`,
      `• Derivation Method: ${result.derivationMethod || 'JSON-LD Frame'}`,
      `• Selective Disclosure: ${hiddenFields.length > 0 ? 'Yes' : 'No'}`,
      ``,
      `**📊 Field Analysis:**`,
      `• Original Fields: ${originalFields.length}`,
      `• Revealed Fields: ${revealedFields.length}`,
      `• Hidden Fields: ${hiddenFields.length}`,
      `• Privacy Level: ${Math.round((hiddenFields.length / originalFields.length) * 100)}% fields hidden`,
      ``
    ];

    if (revealedFields.length > 0) {
      summary.push(`**✅ Revealed Fields (${revealedFields.length}):**`);
      revealedFields.forEach((field, index) => {
        summary.push(`${index + 1}. ${field}`);
      });
      summary.push(``);
    }

    if (hiddenFields.length > 0) {
      summary.push(`**🔒 Hidden Fields (${hiddenFields.length}):**`);
      hiddenFields.forEach((field, index) => {
        summary.push(`${index + 1}. ${field} (protected by selective disclosure)`);
      });
      summary.push(``);
    }

    // Proof information
    if (result.derivedCredential?.proof) {
      const proof = result.derivedCredential.proof;
      summary.push(`**🔐 Derived Proof Information:**`);
      summary.push(`• Proof Type: ${proof.type || 'Unknown'}`);
      summary.push(`• Verification Method: ${proof.verificationMethod || 'Not specified'}`);
      summary.push(`• Created: ${proof.created || 'Not specified'}`);
      summary.push(`• Purpose: ${proof.proofPurpose || 'assertionMethod'}`);
      
      if (nonce) {
        summary.push(`• Nonce: ${nonce} (replay protection enabled)`);
      }
      summary.push(``);
    }

    // Derivation integrity checks
    summary.push(`**🛡️ Integrity Verification:**`);
    summary.push(`• Original signature preserved: ${result.signaturePreserved ? '✅ Yes' : '❌ No'}`);
    summary.push(`• Derivation proof valid: ${result.derivationValid ? '✅ Yes' : '❌ No'}`);
    summary.push(`• JSON-LD frame applied: ${result.frameApplied ? '✅ Yes' : '❌ No'}`);
    
    if (result.chainedCredential) {
      summary.push(`• Credential chaining: ✅ Derived credential properly chained`);
    }

    // Usage recommendations
    summary.push(``);
    summary.push(`**💡 Usage Recommendations:**`);
    if (hiddenFields.length > 0) {
      summary.push(`• Use this derived credential for privacy-sensitive scenarios`);
      summary.push(`• Original credential remains unchanged and can be used separately`);
    }
    if (nonce) {
      summary.push(`• Nonce provides replay protection - credential is single-use`);
    }
    summary.push(`• Verify derived credential independently before accepting`);
    summary.push(`• Consider the revealed fields sufficient for your use case`);

    return {
      content: [
        {
          type: 'text',
          text: summary.join('\n')
        },
        {
          type: 'text',
          text: `\`\`\`json\n${JSON.stringify({
            derivationSummary: {
              originalCredentialId: originalCredential.id,
              derivedCredentialId: result.derivedCredential?.id,
              originalFields: originalFields.length,
              revealedFields: revealedFields.length,
              hiddenFields: hiddenFields.length,
              privacyLevel: Math.round((hiddenFields.length / originalFields.length) * 100),
              frameApplied: result.frameApplied,
              signaturePreserved: result.signaturePreserved
            },
            derivedCredential: result.derivedCredential,
            derivationProof: result.derivationProof
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
            text: `🔄 **Credential Derivation (Simulation Mode)**\n\n` +
                  `Since the HiveAuth API is not available, here's what the credential derivation would accomplish:\n\n` +
                  `**Input Analysis:**\n` +
                  `• Original Credential ID: ${originalCredential.id || 'Not specified'}\n` +
                  `• Original Credential Type: ${originalCredential.type?.join(', ') || 'Unknown'}\n` +
                  `• Derivation Frame: ${Object.keys(frame).length} frame properties specified\n` +
                  `• Nonce: ${nonce ? 'Provided (replay protection)' : 'Not provided'}\n\n` +
                  `**Expected Derivation Results:**\n` +
                  `• New credential with selective disclosure applied\n` +
                  `• Original signature preserved in derived proof\n` +
                  `• Only specified fields revealed according to frame\n` +
                  `• Cryptographic link to original credential maintained\n\n` +
                  `**Privacy Benefits:**\n` +
                  `• Sensitive fields hidden while maintaining verifiability\n` +
                  `• Zero-knowledge proof of credential possession\n` +
                  `• Granular control over revealed information\n\n` +
                  `**To enable full derivation:** Ensure HiveAuth API is running at ${HIVEAUTH_API_BASE_URL}`
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Failed to derive credential: ${error.message}`
        }
      ],
      isError: true
    };
  }
}

/**
 * Extract field names from a credential for analysis
 */
function extractCredentialFields(credential: any): string[] {
  const fields: string[] = [];
  
  function extractFromObject(obj: any, prefix = ''): void {
    if (!obj || typeof obj !== 'object') return;
    
    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      
      // Skip metadata fields
      if (['@context', 'id', 'type', 'proof'].includes(key)) continue;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        extractFromObject(value, fieldPath);
      } else {
        fields.push(fieldPath);
      }
    }
  }
  
  extractFromObject(credential);
  return fields;
}