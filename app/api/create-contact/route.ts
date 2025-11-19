import { NextRequest, NextResponse } from "next/server";

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
    const { firstName, lastName, email, phone, guideName, leadMagnet } = body;

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
    
    // First, fetch custom fields to get their IDs and keys
    let guideNameFieldId: string | null = null;
    let guideNameFieldKey: string | null = null;
    let leadMagnetFieldId: string | null = null;
    let leadMagnetFieldKey: string | null = null;
    
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
        
        // Log the full structure to understand the format
        console.log('Custom fields response structure:', JSON.stringify(customFields, null, 2));
        
        // Find the custom field IDs and keys by name
        if (Array.isArray(customFields)) {
          for (const field of customFields) {
            // Check if field name matches (could be "guide_name", "contact.guide_name", etc.)
            const fieldName = field.name?.toLowerCase() || '';
            const fieldKey = field.key?.toLowerCase() || '';
            
            if (fieldName.includes('guide') && fieldName.includes('name') || 
                fieldKey.includes('guide') && fieldKey.includes('name')) {
              guideNameFieldId = field.id;
              guideNameFieldKey = field.key || field.name;
              console.log('Found guide_name field:', { id: field.id, key: field.key, name: field.name, fullField: field });
            }
            
            if (fieldName.includes('lead') && fieldName.includes('magnet') || 
                fieldKey.includes('lead') && fieldKey.includes('magnet')) {
              leadMagnetFieldId = field.id;
              leadMagnetFieldKey = field.key || field.name;
              console.log('Found lead_magnet field:', { id: field.id, key: field.key, name: field.name, fullField: field });
            }
          }
        }
        
        console.log('Found custom field IDs and keys:', { 
          guideNameFieldId, 
          guideNameFieldKey,
          leadMagnetFieldId,
          leadMagnetFieldKey
        });
      }
    } catch (err) {
      console.warn('Could not fetch custom fields, will try without IDs:', err);
    }
    
    // Build customFields array according to API documentation
    // Format: { id: string, key?: string, field_value: string | string[] }
    const customFieldsArray: Array<{ id: string; key?: string; field_value: string | string[] }> = [];
    
    if (guideName && guideNameFieldId) {
      customFieldsArray.push({
        id: guideNameFieldId,
        key: guideNameFieldKey || undefined,
        field_value: guideName // Text field - string value
      });
    }
    
    if (leadMagnet !== undefined && leadMagnetFieldId) {
      // Checkbox field - field_value should be an array of selected option values
      // The checkbox has "Yes" and "No" options, so use the exact option values
      customFieldsArray.push({
        id: leadMagnetFieldId,
        key: leadMagnetFieldKey || undefined,
        field_value: leadMagnet ? ['Yes'] : ['No'] // Checkbox - array with exact option values ("Yes" or "No")
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

