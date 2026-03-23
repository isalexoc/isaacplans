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
    const { firstName, lastName, email, phone, iulLeadGenData, shortTermMedicalData, meta } = body;

    // [Workflow Debug] Log incoming lead type - helps trace why IUL workflow may be assigned
    console.log("[create-contact] Incoming request lead type:", {
      hasIulLeadGenData: !!iulLeadGenData,
      hasShortTermMedicalData: !!shortTermMedicalData,
      iulLeadGenDataKeys: iulLeadGenData ? Object.keys(iulLeadGenData) : [],
      shortTermMedicalDataKeys: shortTermMedicalData ? Object.keys(shortTermMedicalData) : [],
      leadSource: shortTermMedicalData ? "short_term_medical" : iulLeadGenData ? "iul_lead_gen" : "other",
    });

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
    
    // First, fetch custom fields to get field IDs for IUL and Short Term Medical
    let iulLeadGenDataFieldId: string | null = null;
    let iulLeadGenDataFieldKey: string | null = null;
    let shortTermMedicalFieldId: string | null = null;
    let shortTermMedicalFieldKey: string | null = null;
    
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
        
        if (Array.isArray(customFields)) {
          for (const field of customFields) {
            const fieldName = field.name?.toLowerCase() || '';
            const fieldKey = field.key?.toLowerCase() || '';
            
            // Look for iul_lead_gen_data field
            if (!iulLeadGenDataFieldId && (
              fieldKey === 'iul_lead_gen_data' || 
              (fieldKey.includes('iul') && fieldKey.includes('lead') && fieldKey.includes('gen')) ||
              (fieldName.includes('iul') && fieldName.includes('lead') && fieldName.includes('gen'))
            )) {
              iulLeadGenDataFieldId = field.id;
              iulLeadGenDataFieldKey = field.key || field.name;
              console.log('Found iul_lead_gen_data field:', { id: field.id, key: field.key, name: field.name });
            }
            
            // Look for short_term_medical_data field only (do NOT use product_interest - it may trigger IUL automation)
            if (!shortTermMedicalFieldId && (
              fieldKey === 'short_term_medical_data' ||
              (fieldKey.includes('short') && fieldKey.includes('term') && fieldKey.includes('medical')) ||
              (fieldName.includes('short') && fieldName.includes('term') && fieldName.includes('medical'))
            )) {
              shortTermMedicalFieldId = field.id;
              shortTermMedicalFieldKey = field.key || field.name;
              console.log('Found short_term_medical field:', { id: field.id, key: field.key, name: field.name });
            }
            
            if (iulLeadGenDataFieldId && shortTermMedicalFieldId) break;
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
    
    // Format Short Term Medical data (rich info for short_term_medical_data custom field)
    if (shortTermMedicalData && shortTermMedicalFieldId) {
      const languageDisplay = shortTermMedicalData.language === 'es' ? 'Spanish (Español)' : 
                              shortTermMedicalData.language === 'en' ? 'English' : 
                              shortTermMedicalData.language || 'Not provided';
      const submittedAt = new Date().toLocaleString() + ' ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '');
      
      const smsConsent = shortTermMedicalData.smsConsent === true ? 'Yes' : 'No';
      const marketingConsent = shortTermMedicalData.marketingConsent === true ? 'Yes' : 'No';
      const stmDataText = [
        'Short Term Medical Lead',
        '======================',
        '',
        'Contact:',
        `  Name: ${firstName} ${lastName}`,
        `  Email: ${email}`,
        `  Phone: ${phone}`,
        '',
        'Lead Details:',
        `  Source: ${shortTermMedicalData.source || 'short_term_medical_page'}`,
        `  Language: ${languageDisplay}`,
        `  SMS Consent: ${smsConsent}`,
        `  Marketing Consent: ${marketingConsent}`,
        `  Source URL: ${meta?.eventSourceUrl || 'Not provided'}`,
        '',
        `Submitted: ${submittedAt}`,
      ].join('\n');
      
      customFieldsArray.push({
        id: shortTermMedicalFieldId,
        key: shortTermMedicalFieldKey || undefined,
        field_value: stmDataText
      });
    }
    
    // Build tags for Short Term Medical leads
    const stmTags: string[] = [];
    if (shortTermMedicalData) {
      stmTags.push('Short Term Medical Lead');
      stmTags.push(shortTermMedicalData.language === 'es' ? 'Spanish' : 'English');
    }

    // Determine lead source for CRM routing (prevents IUL workflow from auto-triggering on STM leads)
    const leadSource = shortTermMedicalData ? "short_term_medical" : iulLeadGenData ? "iul_lead_gen" : "website";

    // Create contact payload with customFields, tags, and source
    const contactPayload: any = {
      firstName,
      lastName,
      email,
      phone,
      locationId,
      source: leadSource,
    };
    
    // Add customFields if we have any
    if (customFieldsArray.length > 0) {
      contactPayload.customFields = customFieldsArray;
    }
    
    // Add tags for STM leads
    if (stmTags.length > 0) {
      contactPayload.tags = stmTags;
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
          // Update the existing contact with custom fields and tags (for STM leads)
          console.log("[create-contact] Found existing contact, updating (no workflow enrollment - early return):", {
            contactId: existingContactId,
            hasShortTermMedicalData: !!shortTermMedicalData,
            hasIulLeadGenData: !!iulLeadGenData,
          });
          
          const updatePayload: any = {};
          if (customFieldsArray.length > 0) {
            updatePayload.customFields = customFieldsArray;
          }
          if (stmTags.length > 0) {
            updatePayload.tags = stmTags;
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

    if (shortTermMedicalData) {
      console.log("[create-contact] STM lead created - will NOT add to IUL/Notification workflows (contactId:", contactId, ")");
    }

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

    // Step 1: Activate notification workflow FIRST (if configured) - skip for STM leads
    const notificationWorkflowId = process.env.AGENT_CRM_WORKFLOW_NOTIFICATION;
    const willAddNotification = !!(notificationWorkflowId && contactId && !shortTermMedicalData);
    console.log("[create-contact] Notification workflow:", {
      workflowId: notificationWorkflowId ?? "not configured",
      willAdd: willAddNotification,
      reason: !notificationWorkflowId ? "no env" : !contactId ? "no contactId" : shortTermMedicalData ? "STM lead - skipped" : "IUL/other lead",
    });
    if (willAddNotification) {
      await addContactToWorkflow(notificationWorkflowId, "Notification");
    }

    // Step 2: Activate language-specific workflow (IUL ONLY - must have iulLeadGenData explicitly)
    // Short Term Medical leads: NEVER add to IUL workflows - require iulLeadGenData to prevent misassignment
    const workflowEnId = process.env.AGENT_CRM_WORKFLOW_EN;
    const workflowEsId = process.env.AGENT_CRM_WORKFLOW_ES;
    const language = iulLeadGenData?.language || shortTermMedicalData?.language || 'en';
    const iulConditionMet = !!(iulLeadGenData && !shortTermMedicalData);
    const languageWorkflowId = language === 'es' ? workflowEsId : workflowEnId;
    const willAddIul = !!(iulConditionMet && languageWorkflowId && contactId);

    console.log("[create-contact] IUL workflow decision:", {
      iulConditionMet,
      hasIulLeadGenData: !!iulLeadGenData,
      hasShortTermMedicalData: !!shortTermMedicalData,
      language,
      workflowEnId: workflowEnId ?? "not configured",
      workflowEsId: workflowEsId ?? "not configured",
      selectedWorkflowId: languageWorkflowId ?? "none",
      willAddIul,
      reason: !iulConditionMet
        ? shortTermMedicalData
          ? "STM lead - iulConditionMet is false (shortTermMedicalData present)"
          : "no iulLeadGenData"
        : !languageWorkflowId
          ? "workflow not configured"
          : "IUL lead - adding to workflow",
    });

    if (willAddIul) {
      await addContactToWorkflow(languageWorkflowId!, language === 'es' ? 'Spanish' : 'English');
    } else if (shortTermMedicalData) {
      console.log("[create-contact] IUL workflow NOT added - STM lead (contactId:", contactId, ")");
    }

    // Send Meta Conversions API event (if configured and metadata provided)
    // ⚠️ IMPORTANT: Only send CAPI for NEW contacts to avoid double-counting
    const pixelId = process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID;
    const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
    const testEventCode = process.env.META_TEST_EVENT_CODE; // Optional, for testing

    // Log CAPI check for debugging
    console.log("[Meta CAPI] Check:", {
      hasPixelId: !!pixelId,
      hasAccessToken: !!accessToken,
      hasEventId: !!meta?.eventId,
      hasEventSourceUrl: !!meta?.eventSourceUrl,
      isNewContact: isNewContact,
      willSend: !!(pixelId && accessToken && meta?.eventId && meta?.eventSourceUrl && isNewContact),
    });

    if (pixelId && accessToken && meta?.eventId && meta?.eventSourceUrl && isNewContact) {
      try {
        // Get user agent and IP from request headers
        const userAgent = request.headers.get("user-agent") || "";
        const xff = request.headers.get("x-forwarded-for") || "";
        const ip = xff.split(",")[0]?.trim(); // Best effort behind proxies

        // Determine value and source based on lead type
        const value = 100;
        const source = shortTermMedicalData ? "short_term_medical" : "iul_lead_gen";
        const contentName = shortTermMedicalData ? "Short Term Medical Lead" : "IUL Lead Generation Campaign";

        console.log("[Meta CAPI] Sending event:", {
          eventId: meta.eventId,
          eventName: "Lead",
          email: email.substring(0, 3) + "***", // Partial for privacy
          hasFbp: !!meta.fbp,
          hasFbc: !!meta.fbc,
        });

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
            content_name: contentName,
            currency: "USD",
            value: value,
            source: source,
          },
          testEventCode, // Only used during testing
        });

        // Log success in production
        console.log("[Meta CAPI] Event sent successfully (production)");
      } catch (capiError) {
        // Log error but don't fail the request - CAPI is a backup
        console.error("[Meta CAPI] Failed to send event (non-blocking):", capiError);
      }
    } else {
      console.log("[Meta CAPI] Skipped - missing requirements or existing contact");
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

