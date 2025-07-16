import { z } from 'zod';

/**
 * Zod schemas for validating MCP tool inputs
 * These schemas provide type safety, validation, and clear error messages
 */

// Base schemas for common types
export const CredentialSubjectSchema = z.record(z.any()).describe('Credential subject data');

export const CredentialTypeSchema = z.array(z.string()).min(1, 'At least one credential type is required')
  .describe('Array of credential types (e.g., ["VerifiableCredential", "EducationCredential"])');

export const VCVersionSchema = z.enum(['1.1', '2.0']).default('2.0')
  .describe('W3C VC Data Model version');

export const ISO8601DateSchema = z.string().datetime({ message: 'Must be a valid ISO 8601 date string' })
  .describe('ISO 8601 date string');

export const CredentialSchema = z.object({
  '@context': z.union([z.string(), z.array(z.string())]).optional(),
  id: z.string().optional(),
  type: z.array(z.string()),
  issuer: z.union([z.string(), z.object({}).passthrough()]),
  issuanceDate: z.string().optional(),
  validFrom: z.string().optional(),
  expirationDate: z.string().optional(),
  validUntil: z.string().optional(),
  credentialSubject: z.union([z.object({}).passthrough(), z.array(z.object({}).passthrough())]),
  proof: z.union([z.object({}).passthrough(), z.array(z.object({}).passthrough())]).optional(),
  credentialStatus: z.object({}).passthrough().optional()
}).passthrough().describe('W3C Verifiable Credential');

export const PresentationSchema = z.object({
  '@context': z.union([z.string(), z.array(z.string())]).optional(),
  id: z.string().optional(),
  type: z.array(z.string()),
  holder: z.string().optional(),
  verifiableCredential: z.union([
    z.array(CredentialSchema),
    z.array(z.string()) // JWT format
  ]),
  proof: z.union([z.object({}).passthrough(), z.array(z.object({}).passthrough())]).optional()
}).passthrough().describe('W3C Verifiable Presentation');

// Input descriptor and presentation definition schemas (DIF PEX v2.0)
export const FieldSchema = z.object({
  path: z.array(z.string()).min(1, 'At least one path is required'),
  filter: z.object({}).passthrough().optional(),
  purpose: z.string().optional(),
  name: z.string().optional(),
  predicate: z.enum(['required', 'preferred']).optional()
}).describe('DIF PEX Field constraint');

export const ConstraintsSchema = z.object({
  fields: z.array(FieldSchema).optional(),
  limit_disclosure: z.enum(['required', 'preferred']).optional(),
  statuses: z.object({
    active: z.object({
      directive: z.enum(['required', 'allowed', 'disallowed'])
    }).optional(),
    suspended: z.object({
      directive: z.enum(['required', 'allowed', 'disallowed'])
    }).optional(),
    revoked: z.object({
      directive: z.enum(['required', 'allowed', 'disallowed'])
    }).optional()
  }).optional()
}).describe('DIF PEX Constraints');

export const InputDescriptorSchema = z.object({
  id: z.string().min(1, 'Input descriptor ID is required'),
  name: z.string().optional(),
  purpose: z.string().optional(),
  constraints: ConstraintsSchema.optional(),
  schema: z.array(z.object({
    uri: z.string().url('Schema URI must be a valid URL'),
    required: z.boolean().optional()
  })).optional()
}).describe('DIF PEX Input Descriptor');

export const PresentationDefinitionSchema = z.object({
  id: z.string().min(1, 'Presentation definition ID is required'),
  name: z.string().optional(),
  purpose: z.string().optional(),
  input_descriptors: z.array(InputDescriptorSchema).min(1, 'At least one input descriptor is required'),
  submission_requirements: z.array(z.object({}).passthrough()).optional()
}).describe('DIF PEX Presentation Definition');

// Tool input schemas
export const IssueCredentialInputSchema = z.object({
  credentialSubject: CredentialSubjectSchema,
  type: CredentialTypeSchema,
  vcVersion: VCVersionSchema.optional(),
  expirationDate: ISO8601DateSchema.optional(),
  validUntil: ISO8601DateSchema.optional(),
  context: z.array(z.string()).optional().describe('Additional JSON-LD contexts'),
  issuer: z.union([z.string(), z.object({}).passthrough()]).optional().describe('Custom issuer DID or object')
});

export const VerifyCredentialInputSchema = z.object({
  credential: CredentialSchema.describe('The verifiable credential to verify')
});

export const VerifyPresentationInputSchema = z.object({
  presentation: PresentationSchema.describe('The verifiable presentation to verify')
});

export const RevokeCredentialInputSchema = z.object({
  credentialId: z.string().min(1, 'Credential ID is required'),
  statusListIndex: z.number().int().min(0, 'Status list index must be a non-negative integer'),
  reason: z.string().optional().describe('Reason for revocation')
});

export const CreatePresentationDefinitionInputSchema = z.object({
  id: z.string().min(1, 'Presentation definition ID is required'),
  name: z.string().optional(),
  purpose: z.string().optional(),
  inputDescriptors: z.array(InputDescriptorSchema).min(1, 'At least one input descriptor is required')
});

export const EvaluatePresentationInputSchema = z.object({
  presentationDefinition: PresentationDefinitionSchema,
  credentials: z.array(CredentialSchema).min(1, 'At least one credential is required')
});

// Batch operation schemas
export const BatchIssueCredentialsInputSchema = z.object({
  credentials: z.array(IssueCredentialInputSchema).min(1).max(50, 'Maximum 50 credentials per batch'),
  parallel: z.boolean().default(true).describe('Whether to process credentials in parallel')
});

export const BatchVerifyCredentialsInputSchema = z.object({
  credentials: z.array(CredentialSchema).min(1).max(100, 'Maximum 100 credentials per batch'),
  parallel: z.boolean().default(true).describe('Whether to process credentials in parallel'),
  stopOnFirstError: z.boolean().default(false).describe('Whether to stop verification on first error')
});

// Advanced operation schemas
export const DeriveCredentialInputSchema = z.object({
  originalCredential: CredentialSchema,
  frame: z.object({}).passthrough().describe('JSON-LD frame for selective disclosure'),
  nonce: z.string().optional().describe('Nonce for derived proof')
});

export const RefreshCredentialInputSchema = z.object({
  credentialId: z.string().min(1, 'Credential ID is required'),
  refreshService: z.string().url('Refresh service URL must be valid').optional()
});

export const SubmitPresentationInputSchema = z.object({
  presentationDefinition: PresentationDefinitionSchema,
  credentials: z.array(CredentialSchema).min(1, 'At least one credential is required'),
  holderDid: z.string().optional().describe('DID of the presentation holder'),
  challenge: z.string().optional().describe('Challenge for the presentation proof'),
  domain: z.string().optional().describe('Domain for the presentation proof')
});

export const ValidatePresentationDefinitionInputSchema = z.object({
  presentationDefinition: PresentationDefinitionSchema,
  strict: z.boolean().default(true).describe('Whether to perform strict DIF PEX v2.0 validation'),
  checkSchemas: z.boolean().default(false).describe('Whether to validate referenced credential schemas')
});

export const GeneratePresentationRequestInputSchema = z.object({
  presentationDefinition: PresentationDefinitionSchema,
  verifierDid: z.string().optional().describe('DID of the verifier requesting the presentation'),
  callbackUrl: z.string().url('Callback URL must be valid').optional().describe('URL where presentation should be submitted'),
  challenge: z.string().optional().describe('Challenge nonce for presentation security'),
  domain: z.string().optional().describe('Domain for presentation binding'),
  expiresIn: z.number().int().min(60).max(86400).default(3600).describe('Request expiration time in seconds (1 minute to 24 hours)'),
  requestFormat: z.enum(['jwt', 'json']).default('json').describe('Format for the presentation request'),
  includeInstructions: z.boolean().default(true).describe('Whether to include human-readable instructions')
});

// Export a mapping of tool names to their schemas for easy lookup
export const TOOL_SCHEMAS = {
  issue_credential: IssueCredentialInputSchema,
  verify_credential: VerifyCredentialInputSchema,
  verify_presentation: VerifyPresentationInputSchema,
  revoke_credential: RevokeCredentialInputSchema,
  create_presentation_definition: CreatePresentationDefinitionInputSchema,
  evaluate_presentation: EvaluatePresentationInputSchema,
  batch_issue_credentials: BatchIssueCredentialsInputSchema,
  batch_verify_credentials: BatchVerifyCredentialsInputSchema,
  derive_credential: DeriveCredentialInputSchema,
  refresh_credential: RefreshCredentialInputSchema,
  submit_presentation: SubmitPresentationInputSchema,
  validate_presentation_definition: ValidatePresentationDefinitionInputSchema,
  generate_presentation_request: GeneratePresentationRequestInputSchema
} as const;

// Type exports for use in tools
export type IssueCredentialInput = z.infer<typeof IssueCredentialInputSchema>;
export type VerifyCredentialInput = z.infer<typeof VerifyCredentialInputSchema>;
export type VerifyPresentationInput = z.infer<typeof VerifyPresentationInputSchema>;
export type RevokeCredentialInput = z.infer<typeof RevokeCredentialInputSchema>;
export type CreatePresentationDefinitionInput = z.infer<typeof CreatePresentationDefinitionInputSchema>;
export type EvaluatePresentationInput = z.infer<typeof EvaluatePresentationInputSchema>;
export type BatchIssueCredentialsInput = z.infer<typeof BatchIssueCredentialsInputSchema>;
export type BatchVerifyCredentialsInput = z.infer<typeof BatchVerifyCredentialsInputSchema>;
export type DeriveCredentialInput = z.infer<typeof DeriveCredentialInputSchema>;
export type RefreshCredentialInput = z.infer<typeof RefreshCredentialInputSchema>;
export type SubmitPresentationInput = z.infer<typeof SubmitPresentationInputSchema>;
export type ValidatePresentationDefinitionInput = z.infer<typeof ValidatePresentationDefinitionInputSchema>;
export type GeneratePresentationRequestInput = z.infer<typeof GeneratePresentationRequestInputSchema>;