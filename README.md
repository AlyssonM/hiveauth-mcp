# HiveAuth MCP Server

A Model Context Protocol (MCP) server that provides tools for verifiable credential operations using the HiveAuth ecosystem. This server exposes HiveAuth's credential management capabilities to LLM applications via the standardized MCP interface.

## Overview

The HiveAuth MCP Server provides these tools to LLM applications:
- **Issue Credential**: Create new verifiable credentials with HiveAuth
- **Verify Credential**: Verify individual credentials for authenticity and status
- **Verify Presentation**: Verify complete presentations containing multiple credentials
- **Revoke Credential**: Revoke credentials using status lists
- **Create Presentation Definition**: Build DIF Presentation Exchange definitions
- **Evaluate Presentation**: Test credentials against presentation definitions

## Installation

```bash
cd hiveauth-mcp
npm install
```

## Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Key environment variables:
- `HIVEAUTH_API_BASE_URL`: URL of the main HiveAuth application (default: http://localhost:3000)

## Usage

### As an MCP Server

The server is designed to be used with MCP-compatible clients (like Claude Desktop, IDEs with MCP support, etc.):

```bash
# Start the server
npm run dev
```

The server communicates via stdio and will be available for MCP clients to connect to.

### Building for Production

```bash
npm run build
npm start
```

## Available Tools

### `issue_credential`
Issues a new verifiable credential using HiveAuth.

**Parameters:**
- `credentialSubject` (object): The subject data for the credential
- `type` (array): Credential types (e.g., ["VerifiableCredential", "EducationCredential"])
- `vcVersion` (string, optional): VC Data Model version ("1.1" or "2.0", default: "2.0")
- `expirationDate` (string, optional): ISO 8601 expiration date

### `verify_credential`
Verifies a verifiable credential for authenticity and status.

**Parameters:**
- `credential` (object): The verifiable credential to verify

### `verify_presentation`
Verifies a verifiable presentation containing multiple credentials.

**Parameters:**
- `presentation` (object): The verifiable presentation to verify

### `revoke_credential`
Revokes a verifiable credential using status lists.

**Parameters:**
- `credentialId` (string): The ID of the credential to revoke
- `statusListIndex` (number): The status list index of the credential

### `create_presentation_definition`
Creates a DIF Presentation Exchange definition for requesting specific credentials.

**Parameters:**
- `id` (string): Unique identifier for the presentation definition
- `name` (string, optional): Human-readable name
- `purpose` (string, optional): Purpose of the presentation request
- `inputDescriptors` (array): Input descriptors defining what credentials are requested

### `evaluate_presentation`
Evaluates credentials against a presentation definition using DIF PEX.

**Parameters:**
- `presentationDefinition` (object): The presentation definition to evaluate against
- `credentials` (array): Array of credentials to evaluate

## Integration with LLM Applications

This MCP server allows LLM applications to:

1. **Issue credentials on behalf of users**: Create education, employment, or other types of credentials
2. **Verify credentials in real-time**: Check authenticity and revocation status
3. **Build presentation requests**: Create complex credential requirements using DIF PEX
4. **Evaluate credential compliance**: Test if available credentials meet specific requirements
5. **Manage credential lifecycle**: Handle revocation and status updates

## Example Usage in Claude Desktop

Add this server to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "hiveauth": {
      "command": "node",
      "args": ["/path/to/hiveauth-mcp/dist/index.js"],
      "env": {
        "HIVEAUTH_API_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

Then you can ask Claude to:
- "Issue a university degree credential for John Smith with Computer Science major"
- "Verify this credential for authenticity"
- "Create a presentation definition requesting employment credentials"
- "Check if these credentials satisfy the job application requirements"

## Architecture

- **MCP SDK**: Built on the official Model Context Protocol TypeScript SDK
- **HiveAuth Integration**: Calls HiveAuth API endpoints for all credential operations
- **Tool-based Interface**: Exposes functionality as discrete, composable tools
- **Standards Compliance**: Supports W3C VC Data Model 1.1/2.0 and DIF Presentation Exchange

## Development Status

This implementation includes:
- ✅ Complete MCP server with stdio transport
- ✅ All core HiveAuth credential operations as tools
- ✅ W3C VC 1.1 and 2.0 support
- ✅ DIF Presentation Exchange Protocol integration
- ✅ Comprehensive error handling and validation
- ✅ Production-ready TypeScript implementation
- 🚧 HTTP transport support
- 🚧 Authentication/authorization mechanisms
- 🚧 Tool input validation with Zod schemas
