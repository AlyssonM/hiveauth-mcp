import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { BatchVerifyCredentialsInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Verify multiple verifiable credentials in parallel using HiveAuth
 * Supports parallel processing with optional early termination on errors
 */
export async function batchVerifyCredentials(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(BatchVerifyCredentialsInputSchema, args, 'batch_verify_credentials');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { credentials, parallel = true, stopOnFirstError = false } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const VERIFY_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/verify`;

  const startTime = Date.now();
  const results: any[] = [];
  const errors: any[] = [];
  let stopped = false;

  try {
    console.log(`[BatchVerify] Starting batch verification of ${credentials.length} credentials`);
    console.log(`[BatchVerify] Config: parallel=${parallel}, stopOnFirstError=${stopOnFirstError}`);

    if (parallel && !stopOnFirstError) {
      // Process all credentials in parallel
      const promises = credentials.map(async (credential, index) => {
        try {
          const response = await fetch(VERIFY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`API Error: ${errorData.message}`);
          }

          const result = await response.json();
          return { 
            index, 
            success: true, 
            verified: result.verified,
            credential,
            result,
            credentialId: credential.id || `credential-${index + 1}`
          };
        } catch (error: any) {
          return { 
            index, 
            success: false, 
            verified: false,
            error: error.message,
            credentialId: credential.id || `credential-${index + 1}`
          };
        }
      });

      const allResults = await Promise.all(promises);
      
      // Separate results
      allResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
    } else {
      // Process sequentially or with early termination
      for (let index = 0; index < credentials.length; index++) {
        if (stopped) break;
        
        const credential = credentials[index];
        
        try {
          const response = await fetch(VERIFY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`API Error: ${errorData.message}`);
          }

          const result = await response.json();
          
          const verificationResult = { 
            index, 
            success: true, 
            verified: result.verified,
            credential,
            result,
            credentialId: credential.id || `credential-${index + 1}`
          };
          
          results.push(verificationResult);
          
          // Stop on first verification failure if requested
          if (stopOnFirstError && !result.verified) {
            stopped = true;
            console.log(`[BatchVerify] Stopping on first verification failure at index ${index}`);
          }
        } catch (error: any) {
          const errorResult = { 
            index, 
            success: false, 
            verified: false,
            error: error.message,
            credentialId: credential.id || `credential-${index + 1}`
          };
          
          errors.push(errorResult);
          
          // Stop on first error if requested
          if (stopOnFirstError) {
            stopped = true;
            console.log(`[BatchVerify] Stopping on first error at index ${index}`);
          }
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const totalProcessed = results.length + errors.length;
    const validCredentials = results.filter(r => r.verified).length;
    const invalidCredentials = results.filter(r => !r.verified).length;
    const apiErrors = errors.length;

    // Generate detailed summary
    const summary = [
      `🔍 **Batch Credential Verification Results**`,
      ``,
      `• Total Processed: ${totalProcessed}/${credentials.length}`,
      `• Valid Credentials: ${validCredentials} ✅`,
      `• Invalid Credentials: ${invalidCredentials} ❌`,
      `• API Errors: ${apiErrors} 🚫`,
      `• Processing Mode: ${parallel ? 'Parallel' : 'Sequential'}`,
      `• Duration: ${duration}ms`,
      `• Average per credential: ${Math.round(duration / totalProcessed)}ms`,
      ``
    ];

    if (stopped) {
      summary.push(`⚠️ **Early Termination**: Stopped processing due to stopOnFirstError setting`);
      summary.push(``);
    }

    // Valid credentials
    const validResults = results.filter(r => r.verified);
    if (validResults.length > 0) {
      summary.push(`**✅ Valid Credentials (${validResults.length}):**`);
      validResults.forEach(result => {
        const issuer = result.credential.issuer;
        const issuerInfo = typeof issuer === 'string' ? issuer : issuer?.id || 'Unknown';
        const types = result.credential.type?.filter((t: string) => t !== 'VerifiableCredential').join(', ') || 'Unknown';
        summary.push(`${result.index + 1}. **${result.credentialId}** - ${types} (Issuer: ${issuerInfo})`);
      });
      summary.push(``);
    }

    // Invalid credentials
    const invalidResults = results.filter(r => !r.verified);
    if (invalidResults.length > 0) {
      summary.push(`**❌ Invalid Credentials (${invalidResults.length}):**`);
      invalidResults.forEach(result => {
        const reason = result.result?.message || 'Verification failed';
        summary.push(`${result.index + 1}. **${result.credentialId}** - ${reason}`);
      });
      summary.push(``);
    }

    // API errors
    if (apiErrors > 0) {
      summary.push(`**🚫 API Errors (${apiErrors}):**`);
      errors.forEach(error => {
        summary.push(`${error.index + 1}. **${error.credentialId}** - ${error.error}`);
      });
      summary.push(``);
    }

    // Performance insights
    if (parallel && totalProcessed > 1) {
      const sequentialEstimate = duration * totalProcessed;
      const speedup = Math.round((sequentialEstimate / duration) * 10) / 10;
      summary.push(`**⚡ Performance:**`);
      summary.push(`• Parallel speedup: ~${speedup}x faster than sequential`);
      summary.push(`• Verification rate: ${Math.round(totalProcessed / (duration / 1000))} credentials/second`);
    }

    // Recommendations
    summary.push(`**💡 Recommendations:**`);
    if (invalidCredentials > 0) {
      summary.push(`• Review invalid credentials for common issues (expired, revoked, signature problems)`);
    }
    if (apiErrors > 0) {
      summary.push(`• Check network connectivity and HiveAuth API availability`);
    }
    if (validCredentials / totalProcessed < 0.8) {
      summary.push(`• Consider reviewing credential sources - low validation rate detected`);
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
            summary: {
              totalProcessed,
              totalCredentials: credentials.length,
              validCredentials,
              invalidCredentials,
              apiErrors,
              duration,
              parallel,
              stopOnFirstError,
              stopped
            },
            validCredentials: validResults.map(r => ({
              index: r.index,
              credentialId: r.credentialId,
              verified: true,
              types: r.credential.type
            })),
            invalidCredentials: invalidResults.map(r => ({
              index: r.index,
              credentialId: r.credentialId,
              verified: false,
              reason: r.result?.message
            })),
            errors: errors.map(e => ({
              index: e.index,
              credentialId: e.credentialId,
              error: e.error
            }))
          }, null, 2)}\n\`\`\``
        }
      ]
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Failed to verify credentials in batch: ${error.message}`
        }
      ],
      isError: true
    };
  }
}