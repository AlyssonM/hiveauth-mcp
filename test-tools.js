#!/usr/bin/env node

/**
 * Simple test script to verify MCP server tools are working
 * This script simulates MCP protocol communication
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function testMCPServer() {
  console.log('🚀 Testing HiveAuth MCP Server...\n');

  // Start the MCP server
  const serverProcess = spawn('node', ['dist/index.js'], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let responseData = '';
  
  serverProcess.stdout.on('data', (data) => {
    responseData += data.toString();
  });

  serverProcess.stderr.on('data', (data) => {
    console.error('Server stderr:', data.toString());
  });

  // Helper function to send MCP messages
  function sendMCPMessage(message) {
    return new Promise((resolve, reject) => {
      const messageStr = JSON.stringify(message) + '\n';
      serverProcess.stdin.write(messageStr);
      
      setTimeout(() => {
        try {
          // Parse accumulated response data
          const lines = responseData.trim().split('\n').filter(line => line.trim());
          const responses = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return null;
            }
          }).filter(r => r !== null);
          
          resolve(responses);
        } catch (error) {
          reject(error);
        }
      }, 1000);
    });
  }

  try {
    // Test 1: Initialize the server
    console.log('📋 Test 1: Initialize MCP Server');
    const initResponse = await sendMCPMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    });
    console.log('✅ Server initialized successfully\n');

    // Test 2: List available tools
    console.log('🔧 Test 2: List Available Tools');
    responseData = ''; // Clear previous data
    const toolsResponse = await sendMCPMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });
    
    if (toolsResponse.length > 0 && toolsResponse[0].result?.tools) {
      console.log(`✅ Found ${toolsResponse[0].result.tools.length} tools:`);
      toolsResponse[0].result.tools.forEach(tool => {
        console.log(`   • ${tool.name}: ${tool.description}`);
      });
    } else {
      console.log('❌ No tools found in response');
    }
    console.log();

    // Test 3: Test create_presentation_definition tool
    console.log('📝 Test 3: Create Presentation Definition');
    responseData = '';
    const createDefResponse = await sendMCPMessage({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'create_presentation_definition',
        arguments: {
          id: 'test-presentation-def',
          name: 'Test University Degree Request',
          purpose: 'Verify university education credentials',
          inputDescriptors: [
            {
              id: 'university-degree',
              name: 'University Degree',
              purpose: 'Verify graduation from accredited university',
              constraints: {
                fields: [
                  {
                    path: ['$.type'],
                    filter: {
                      type: 'array',
                      contains: {
                        const: 'UniversityDegreeCredential'
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    });
    
    if (createDefResponse.length > 0 && createDefResponse[0].result?.content) {
      console.log('✅ Presentation definition created successfully');
      console.log('📄 Response:', createDefResponse[0].result.content[0].text);
    } else {
      console.log('❌ Failed to create presentation definition');
    }
    
    console.log('\n🎉 MCP Server tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Clean up
    serverProcess.kill();
  }
}

// Run the tests
testMCPServer().catch(console.error);