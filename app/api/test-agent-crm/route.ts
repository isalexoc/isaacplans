import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Use Private Integration token instead of API key
    const piToken = process.env.AGENT_CRM_PI;
    const locationId = process.env.AGENT_CRM_LOCATION_ID;
    
    if (!piToken) {
      return NextResponse.json(
        { 
          success: false,
          error: "Agent CRM Private Integration token not found in environment variables",
          hint: "Make sure AGENT_CRM_PI is set in your .env.local file"
        },
        { status: 500 }
      );
    }

    const baseUrl = 'https://services.leadconnectorhq.com';
    
    // Test configurations using Private Integration token
    // Testing with "view business" scope - trying various endpoints to see what works
    const testConfigs = [
      // Config 1: Try locations endpoint (might work with view business)
      {
        url: `${baseUrl}/locations/${locationId}`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${piToken}`,
          'Version': '2021-07-28',
        },
        name: 'Get Location (view business scope)'
      },
      // Config 2: Try locations list
      {
        url: `${baseUrl}/locations/`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${piToken}`,
          'Version': '2021-07-28',
        },
        name: 'Get Locations List (view business scope)'
      },
      // Config 3: Try sub-accounts endpoint (locations are now called sub-accounts)
      {
        url: `${baseUrl}/sub-accounts/${locationId}`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${piToken}`,
          'Version': '2021-07-28',
        },
        name: 'Get Sub-Account (view business scope)'
      },
      // Config 4: Try sub-accounts list
      {
        url: `${baseUrl}/sub-accounts/`,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${piToken}`,
          'Version': '2021-07-28',
        },
        name: 'Get Sub-Accounts List (view business scope)'
      },
    ];

    console.log('Testing Agent CRM Private Integration...');
    console.log('PI Token length:', piToken.length);
    console.log('PI Token starts with:', piToken.substring(0, 10));
    console.log('Has Location ID:', !!locationId);
    
    // Try each configuration until one works
    let lastError: any = null;
    for (const config of testConfigs) {
      console.log(`\nTrying: ${config.name}`);
      console.log('URL:', config.url);
      
      try {
        const response = await fetch(config.url, {
          method: 'GET',
          headers: config.headers,
        });

        const responseText = await response.text();
        let responseData;
        
        try {
          responseData = JSON.parse(responseText);
        } catch {
          responseData = { raw: responseText };
        }

        if (response.ok) {
          // Success!
          return NextResponse.json({
            success: true,
            message: `✅ Successfully connected using Private Integration! Method: ${config.name}`,
            data: responseData,
            details: {
              url: config.url,
              status: response.status,
              hasPIToken: true,
              hasLocationId: !!locationId,
              method: config.name,
            }
          });
        } else {
          // Store error but continue trying other configs
          lastError = {
            config: config.name,
            status: response.status,
            statusText: response.statusText,
            response: responseData,
            message: responseData?.message || responseData?.error || 'Unknown error',
          };
          console.log(`❌ Failed: ${config.name} - ${response.status} ${response.statusText}`);
          console.log(`Error details:`, JSON.stringify(responseData, null, 2));
        }
      } catch (err) {
        lastError = {
          config: config.name,
          error: err instanceof Error ? err.message : 'Unknown error',
        };
        console.log(`❌ Error with ${config.name}:`, err);
      }
    }

    // If we get here, all configs failed due to scope limitations
    // But we've confirmed the token is valid (401 "not authorized for scope" vs "invalid token")
    const hasScopeError = lastError?.message?.includes('not authorized for this scope');
    
    return NextResponse.json({
      success: hasScopeError ? 'partial' : false, // Partial success = token works but scope is limited
      error: hasScopeError 
        ? `Token is valid but 'view business' scope is too limited for these endpoints`
        : `All API connection attempts failed`,
      lastAttempt: lastError,
      allAttempts: testConfigs.map(c => c.name),
      details: {
        hasPIToken: !!piToken,
        piTokenLength: piToken.length,
        piTokenPrefix: piToken.substring(0, 20) + '...',
        hasLocationId: !!locationId,
        tokenStatus: hasScopeError ? '✅ Valid and authenticated' : '❌ Authentication issue',
        hint: hasScopeError 
          ? "✅ SUCCESS: Your Private Integration token is valid and authenticated! The 'view business' scope is just very limited. To use the API for creating contacts (guide unlock forms), add 'contacts.write' scope in Agent CRM Settings → Private Integrations → Edit your integration."
          : "Check that your Private Integration token is correct and has the 'view business' scope enabled."
      }
    }, { status: hasScopeError ? 200 : 401 });

  } catch (error) {
    console.error("Error testing Agent CRM API:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to connect to Agent CRM API",
      message: error instanceof Error ? error.message : 'Unknown error',
      details: {
        hasPIToken: !!process.env.AGENT_CRM_PI,
        hasLocationId: !!process.env.AGENT_CRM_LOCATION_ID,
      }
    }, { status: 500 });
  }
}
