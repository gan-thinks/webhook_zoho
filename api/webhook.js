// api/webhook.js
export default async function handler(req, res) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get form data
    const { name, email, phone, company, message, form_type } = req.body;
    
    // Validate required fields
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Log the received data (remove in production)
    console.log('Form submission received:', {
      name, email, phone, company, message, form_type
    });

    // Get Zoho credentials from environment variables
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const domain = process.env.ZOHO_DOMAIN || 'https://accounts.zoho.com';

    // Check if all required environment variables are present
    if (!clientId || !clientSecret || !refreshToken) {
      console.error('Missing Zoho environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Get access token from Zoho
    const tokenResponse = await fetch(`${domain}/oauth/v2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token response error:', errorText);
      return res.status(500).json({ error: 'Authentication failed' });
    }

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      console.error('No access token received:', tokenData);
      return res.status(500).json({ error: 'Authentication failed' });
    }

    const accessToken = tokenData.access_token;

    // Determine the correct CRM domain (usually different from auth domain)
    const crmDomain = domain.replace('accounts.zoho.com', 'www.zohoapis.com');

    // Prepare lead data for Zoho CRM
    const leadData = {
      data: [
        {
          Last_Name: name || 'Website Lead',
          Email: email,
          Phone: phone || '',
          Company: company || '',
          Description: message || '',
          Lead_Source: form_type === 'newsletter' ? 'Newsletter' : 'Website Contact Form',
        }
      ]
    };

    // Send lead to Zoho CRM
    const crmResponse = await fetch(`${crmDomain}/crm/v2/Leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leadData),
    });

    if (!crmResponse.ok) {
      const errorText = await crmResponse.text();
      console.error('CRM response error:', errorText);
      return res.status(500).json({ error: 'Failed to create lead' });
    }

    const crmData = await crmResponse.json();
    
    console.log('Lead created successfully:', crmData);

    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: 'Form submitted successfully',
      leadId: crmData.data?.[0]?.details?.id 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
