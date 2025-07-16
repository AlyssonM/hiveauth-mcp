import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { BatchIssueCredentialsInputSchema } from '../schemas/toolSchemas.js';
import { validateAndSanitizeInput, createValidationErrorResult } from '../utils/validation.js';

/**
 * Issue multiple verifiable credentials in parallel using HiveAuth
 * Supports both parallel and sequential processing modes
 */
export async function batchIssueCredentials(args: any): Promise<CallToolResult> {
  // Validate and sanitize input
  const validation = validateAndSanitizeInput(BatchIssueCredentialsInputSchema, args, 'batch_issue_credentials');
  
  if (!validation.success) {
    return createValidationErrorResult(validation.error!);
  }

  const data = validation.data!;
  const { credentials, parallel = true } = data;

  const HIVEAUTH_API_BASE_URL = process.env.HIVEAUTH_API_BASE_URL || 'http://localhost:3000';
  const ISSUE_ENDPOINT = `${HIVEAUTH_API_BASE_URL}/api/issue`;

  const startTime = Date.now();
  const results: any[] = [];
  const errors: any[] = [];

  try {
    console.log(`[BatchIssue] Starting batch issuance of ${credentials.length} credentials (parallel: ${parallel})`);

    if (parallel) {
      // Process credentials in parallel
      const promises = credentials.map(async (credentialData, index) => {
        try {
          const payload = {
            credentialSubject: credentialData.credentialSubject,
            type: credentialData.type,
            vcVersion: credentialData.vcVersion || '2.0',
            ...(credentialData.expirationDate && { expirationDate: credentialData.expirationDate }),
            ...(credentialData.validUntil && { validUntil: credentialData.validUntil }),
            ...(credentialData.context && { context: credentialData.context }),
            ...(credentialData.issuer && { issuer: credentialData.issuer })
          };

          const response = await fetch(ISSUE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Credential ${index + 1}: ${errorData.message}`);
          }

          const result = await response.json();
          return { index, success: true, credential: result.credential, result };
        } catch (error: any) {
          return { index, success: false, error: error.message };
        }
      });

      const allResults = await Promise.all(promises);
      
      // Separate successful results from errors
      allResults.forEach(result => {
        if (result.success) {
          results.push(result);
        } else {
          errors.push(result);
        }
      });
    } else {
      // Process credentials sequentially
      for (let index = 0; index < credentials.length; index++) {
        const credentialData = credentials[index];
        
        try {
          const payload = {
            credentialSubject: credentialData.credentialSubject,
            type: credentialData.type,
            vcVersion: credentialData.vcVersion || '2.0',
            ...(credentialData.expirationDate && { expirationDate: credentialData.expirationDate }),
            ...(credentialData.validUntil && { validUntil: credentialData.validUntil }),
            ...(credentialData.context && { context: credentialData.context }),
            ...(credentialData.issuer && { issuer: credentialData.issuer })
          };

          const response = await fetch(ISSUE_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Credential ${index + 1}: ${errorData.message}`);
          }

          const result = await response.json();
          results.push({ index, success: true, credential: result.credential, result });
        } catch (error: any) {
          errors.push({ index, success: false, error: error.message });
        }
      }
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const successCount = results.length;
    const errorCount = errors.length;
    const totalCount = credentials.length;

    // Generate summary
    const summary = [
      `📊 **Batch Credential Issuance Results**`,
      ``,
      `• Total Credentials: ${totalCount}`,
      `• Successfully Issued: ${successCount} ✅`,
      `• Failed: ${errorCount} ❌`,
      `• Processing Mode: ${parallel ? 'Parallel' : 'Sequential'}`,
      `• Duration: ${duration}ms`,
      `• Average per credential: ${Math.round(duration / totalCount)}ms`,
      ``
    ];

    if (successCount > 0) {
      summary.push(`**✅ Successfully Issued Credentials:**`);
      results.forEach(result => {
        const credId = result.credential?.id || 'unknown';
        const vcVersion = result.result?.credential?.['@context']?.includes('credentials/v2') ? '2.0' : '1.1';
        summary.push(`${result.index + 1}. **${credId}** (VC ${vcVersion})`);
      });
      summary.push(``);
    }

    if (errorCount > 0) {
      summary.push(`**❌ Failed Credentials:**`);
      errors.forEach(error => {
        summary.push(`${error.index + 1}. ${error.error}`);
      });
      summary.push(``);
    }

    // Performance insights
    if (parallel && totalCount > 1) {
      const sequentialEstimate = duration * totalCount;
      const speedup = Math.round((sequentialEstimate / duration) * 10) / 10;
      summary.push(`**⚡ Performance:**`);
      summary.push(`• Parallel speedup: ~${speedup}x faster than sequential`);
      summary.push(`• Estimated sequential time: ${sequentialEstimate}ms`);
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
              total: totalCount,
              successful: successCount,
              failed: errorCount,
              duration: duration,
              parallel: parallel
            },
            results: results.map(r => ({
              index: r.index,
              credentialId: r.credential?.id,
              success: true
            })),
            errors: errors.map(e => ({
              index: e.index,
              error: e.error,
              success: false
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
          text: `Failed to issue credentials in batch: ${error.message}`
        }
      ],
      isError: true
    };
  }
}