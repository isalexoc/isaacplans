import { NextRequest, NextResponse } from "next/server";
import { sendMetaCapiEvent } from "@/lib/meta-capi";

export async function POST(request: NextRequest) {
  try {
    const piToken = process.env.AGENT_CRM_PI;
    const locationId = process.env.AGENT_CRM_LOCATION_ID;
    
    if (!piToken) {
      return NextResponse.json(
        { 
          success: false,
          error: "Agent CRM Private Integration token not found",
          hint: "Make sure AGENT_CRM_PI is set in your .env.local file"
        },
        { status: 500 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { 
          success: false,
          error: "Location ID not found",
          hint: "Make sure AGENT_CRM_LOCATION_ID is set in your .env.local file"
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { firstName, lastName, email, phone, iulLeadGenData, meta } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      return NextResponse.json(
        { 
          success: false,
          error: "Missing required fields",
          required: ["firstName", "lastName", "email", "phone"]
        },
        { status: 400 }
      );
    }

    const baseUrl = 'https://services.leadconnectorhq.com';
    
    // First, fetch custom fields to get the IUL Lead Gen Data field ID
    let iulLeadGenDataFieldId: string | null = null;
    let iulLeadGenDataFieldKey: string | null = null;
    
    try {
      const customFieldsResponse = await fetch(`${baseUrl}/locations/${locationId}/customFields`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${piToken}`,
          'Version': '2021-07-28',
        },
      });
      
      if (customFieldsResponse.ok) {
        const customFieldsData = await customFieldsResponse.json();
        const customFields = customFieldsData.customFields || customFieldsData;
        
        // Find the iul_lead_gen_data custom field
        if (Array.isArray(customFields)) {
          for (const field of customFields) {
            const fieldName = field.name?.toLowerCase() || '';
            const fieldKey = field.key?.toLowerCase() || '';
            
            // Look for iul_lead_gen_data field
            if (fieldKey === 'iul_lead_gen_data' || 
                fieldKey.includes('iul') && fieldKey.includes('lead') && fieldKey.includes('gen') ||
                fieldName.includes('iul') && fieldName.includes('lead') && fieldName.includes('gen')) {
              iulLeadGenDataFieldId = field.id;
              iulLeadGenDataFieldKey = field.key || field.name;
              console.log('Found iul_lead_gen_data field:', { id: field.id, key: field.key, name: field.name });
              break;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Could not fetch custom fields, will try without IDs:', err);
    }
    
    // Build customFields array
    // Format: { id: string, key?: string, field_value: string | string[] }
    const customFieldsArray: Array<{ id: string; key?: string; field_value: string | string[] }> = [];
    
    // Format IUL Lead Gen data as a readable multi-line string
    if (iulLeadGenData && iulLeadGenDataFieldId) {
      const formatInvestments = (investments: string[] | undefined): string => {
        if (!investments || !Array.isArray(investments) || investments.length === 0) {
          return 'None';
        }
        return investments.join(', ');
      };
      
      // Format language display name
      const languageDisplay = iulLeadGenData.language === 'es' ? 'Spanish (Español)' : 
                              iulLeadGenData.language === 'en' ? 'English' : 
                              iulLeadGenData.language || 'Not provided';
      
      const leadGenDataText = [
        'IUL Lead Generation Form Data',
        '============================',
        '',
        `Language: ${languageDisplay}`,
        `Retirement Timeline: ${iulLeadGenData.retirementTimeline || 'Not provided'}`,
        `Current Investments: ${formatInvestments(iulLeadGenData.investments)}`,
        `Monthly Savings: ${iulLeadGenData.monthlySavings || 'Not provided'}`,
        `Age: ${iulLeadGenData.age || 'Not provided'}`,
        `State: ${iulLeadGenData.state || 'Not provided'}`,
        '',
        `Submitted: ${new Date().toLocaleString()}`,
      ].join('\n');
      
      customFieldsArray.push({
        id: iulLeadGenDataFieldId,
        key: iulLeadGenDataFieldKey || undefined,
        field_value: leadGenDataText // Multi-line text field - string value
      });
    }
    
    // Create contact payload with customFields included
    const contactPayload: any = {
      firstName,
      lastName,
      email,
      phone,
      locationId,
    };
    
    // Add customFields if we have any
    if (customFieldsArray.length > 0) {
      contactPayload.customFields = customFieldsArray;
    }
    
    console.log('Creating contact with payload:', JSON.stringify(contactPayload, null, 2));
    
    // Create contact with custom fields in one request
    const createResponse = await fetch(`${baseUrl}/contacts/`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${piToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28',
      },
      body: JSON.stringify(contactPayload),
    });

    const createResponseText = await createResponse.text();
    let createResponseData;
    
    try {
      createResponseData = JSON.parse(createResponseText);
    } catch {
      createResponseData = { raw: createResponseText };
    }

    if (!createResponse.ok) {
      // Check if the error is due to duplicate contact
      const errorMessage = createResponseData?.message || createResponseData?.error || '';
      const isDuplicateError = 
        errorMessage.toLowerCase().includes('duplicate') || 
        errorMessage.toLowerCase().includes('already exist') ||
        createResponse.status === 409; // Conflict status code
      
      if (isDuplicateError) {
        console.log('Contact already exists, attempting to find and update it...');
        
        // Try to find the existing contact by email or phone
        let existingContactId: string | null = null;
        
        // Try searching by email first
        try {
          const searchResponse = await fetch(`${baseUrl}/contacts/?email=${encodeURIComponent(email)}&locationId=${locationId}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Authorization': `Bearer ${piToken}`,
              'Version': '2021-07-28',
            },
          });
          
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const contacts = searchData.contacts || searchData;
            
            if (Array.isArray(contacts) && contacts.length > 0) {
              // Find exact match by email
              const exactMatch = contacts.find((c: any) => 
                c.email?.toLowerCase() === email.toLowerCase()
              );
              if (exactMatch) {
                existingContactId = exactMatch.id;
              } else if (contacts[0]) {
                existingContactId = contacts[0].id;
              }
            }
          }
        } catch (searchErr) {
          console.warn('Could not search for existing contact by email:', searchErr);
        }
        
        // If not found by email, try phone
        if (!existingContactId) {
          try {
            const searchResponse = await fetch(`${baseUrl}/contacts/?phone=${encodeURIComponent(phone)}&locationId=${locationId}`, {
              method: 'GET',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${piToken}`,
                'Version': '2021-07-28',
              },
            });
            
            if (searchResponse.ok) {
              const searchData = await searchResponse.json();
              const contacts = searchData.contacts || searchData;
              
              if (Array.isArray(contacts) && contacts.length > 0) {
                // Find exact match by phone
                const exactMatch = contacts.find((c: any) => 
                  c.phone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
                );
                if (exactMatch) {
                  existingContactId = exactMatch.id;
                } else if (contacts[0]) {
                  existingContactId = contacts[0].id;
                }
              }
            }
          } catch (searchErr) {
            console.warn('Could not search for existing contact by phone:', searchErr);
          }
        }
        
        if (existingContactId) {
          // Update the existing contact with custom fields
          console.log('Found existing contact, updating with custom fields...');
          
          const updatePayload: any = {};
          if (customFieldsArray.length > 0) {
            updatePayload.customFields = customFieldsArray;
          }
          
          try {
            const updateResponse = await fetch(`${baseUrl}/contacts/${existingContactId}`, {
              method: 'PUT',
              headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${piToken}`,
                'Content-Type': 'application/json',
                'Version': '2021-07-28',
              },
              body: JSON.stringify(updatePayload),
            });
            
            if (updateResponse.ok) {
              console.log('Successfully updated existing contact with custom fields');
              return NextResponse.json({
                success: true,
                message: "Contact updated successfully!",
                contactId: existingContactId,
                isExisting: true,
              });
            } else {
              console.warn('Could not update existing contact, but contact exists');
              // Still return success since contact exists
              return NextResponse.json({
                success: true,
                message: "Contact already exists!",
                contactId: existingContactId,
                isExisting: true,
              });
            }
          } catch (updateErr) {
            console.warn('Error updating existing contact:', updateErr);
            // Still return success since contact exists
            return NextResponse.json({
              success: true,
              message: "Contact already exists!",
              contactId: existingContactId,
              isExisting: true,
            });
          }
        } else {
          // Contact exists but we couldn't find it - still return success to proceed with unlock
          console.log('Contact exists but could not be found, proceeding anyway...');
          return NextResponse.json({
            success: true,
            message: "Contact already exists!",
            isExisting: true,
          });
        }
      }
      
      // For other errors, return the error
      console.error('Failed to create contact:', createResponseData);
      return NextResponse.json({
        success: false,
        error: `Failed to create contact: ${errorMessage || createResponse.statusText}`,
        details: createResponseData,
        status: createResponse.status,
      }, { status: createResponse.status });
    }

    const contactId = createResponseData.contact?.id || createResponseData.id;
    const isNewContact = true; // This is a new contact (we just created it)

    // Helper function to add contact to a workflow
    const addContactToWorkflow = async (workflowId: string, workflowName: string): Promise<void> => {
      if (!workflowId || !contactId) {
        return;
      }

      try {
        // Add contact to workflow
        // LeadConnector API: POST /contacts/{contactId}/workflow/{workflowId}?locationId={locationId}
        // Based on documentation: https://marketplace.gohighlevel.com/docs/ghl/workflows/get-workflow
        const workflowResponse = await fetch(`${baseUrl}/contacts/${contactId}/workflow/${workflowId}?locationId=${locationId}`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${piToken}`,
            'Content-Type': 'application/json',
            'Version': '2021-07-28',
          },
        });

        if (workflowResponse.ok) {
          const workflowData = await workflowResponse.json().catch(() => ({}));
          console.log(`[Workflow] Successfully added contact ${contactId} to ${workflowName} workflow (${workflowId})`);
          if (process.env.NODE_ENV === "development") {
            console.log('[Workflow] Response:', workflowData);
          }
        } else {
          const workflowErrorText = await workflowResponse.text();
          console.warn(`[Workflow] Failed to add contact to ${workflowName} workflow (non-blocking):`, {
            workflowId,
            status: workflowResponse.status,
            statusText: workflowResponse.statusText,
            error: workflowErrorText,
          });
        }
      } catch (workflowError) {
        // Log error but don't fail the request - workflow activation is non-critical
        console.error(`[Workflow] Error activating ${workflowName} workflow (non-blocking):`, workflowError);
      }
    };

    // Step 1: Activate notification workflow FIRST (if configured)
    const notificationWorkflowId = process.env.AGENT_CRM_WORKFLOW_NOTIFICATION;
    if (notificationWorkflowId && contactId) {
      await addContactToWorkflow(notificationWorkflowId, "Notification");
    }

    // Step 2: Activate language-specific workflow (English or Spanish)
    const workflowEnId = process.env.AGENT_CRM_WORKFLOW_EN;
    const workflowEsId = process.env.AGENT_CRM_WORKFLOW_ES;
    const language = iulLeadGenData?.language || 'en'; // Default to English

    // Determine which workflow to use
    const languageWorkflowId = language === 'es' ? workflowEsId : workflowEnId;
    if (languageWorkflowId && contactId) {
      await addContactToWorkflow(languageWorkflowId, language === 'es' ? 'Spanish' : 'English');
    }

    // Send Meta Conversions API event (if configured and metadata provided)
    // ⚠️ IMPORTANT: Only send CAPI for NEW contacts to avoid double-counting
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    const testEventCode = process.env.META_TEST_EVENT_CODE; // Optional, for testing

    if (pixelId && accessToken && meta?.eventId && meta?.eventSourceUrl && isNewContact) {
      try {
        // Get user agent and IP from request headers
        const userAgent = request.headers.get("user-agent") || "";
        const xff = request.headers.get("x-forwarded-for") || "";
        const ip = xff.split(",")[0]?.trim(); // Best effort behind proxies

        // Determine value - IUL lead gen is always 100
        const value = 100;
        const source = "iul_lead_gen";

        await sendMetaCapiEvent({
          pixelId,
          accessToken,
          eventName: "Lead",
          eventId: meta.eventId, // Must match Pixel eventID
          eventSourceUrl: meta.eventSourceUrl,
          userAgent,
          ip,
          fbp: meta.fbp,
          fbc: meta.fbc,
          email,
          phone,
          firstName,
          lastName,
          customData: {
            content_name: "IUL Lead Generation Campaign",
            currency: "USD",
            value: value,
            source: source,
          },
          testEventCode, // Only used during testing
        });
      } catch (capiError) {
        // Log error but don't fail the request - CAPI is a backup
        console.error("[Meta CAPI] Failed to send event (non-blocking):", capiError);
      }
    }

    // Success!
    return NextResponse.json({
      success: true,
      message: "Contact created successfully!",
      contact: createResponseData.contact || createResponseData,
      contactId: contactId,
    });

  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to create contact",
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

