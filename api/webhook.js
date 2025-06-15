// api/webhook.js
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get form data
    const { name, email, phone, company, message, form_type } = req.body;

    // Log the received data
    console.log('Form submission received:', {
      name, email, phone, company, message, form_type
    });

    // Get Zoho credentials from environment variables
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
    const domain = process.env.ZOHO_DOMAIN;

    // Check if all required environment variables are present
    if (!clientId || !clientSecret || !refreshToken || !domain) {
      console.error('Missing environment variables');
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

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      return res.status(500).json({ error: 'Authentication failed' });
    }

    const accessToken = tokenData.access_token;

    // Prepare lead data for Zoho CRM
    const leadData = {
      data: [
        {
          Last_Name: name || 'Unknown',
          Email: email,
          Phone: phone,
          Company: company,
          Description: message,
          Lead_Source: form_type === 'newsletter' ? 'Newsletter' : 'Website Contact Form',
        }
      ]
    };

    // Send lead to Zoho CRM
    const crmResponse = await fetch(`${domain}/crm/v2/Leads`, {
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(leadData),
    });

    const crmData = await crmResponse.json();

    if (!crmResponse.ok) {
      console.error('CRM error:', crmData);
      return res.status(500).json({ error: 'Failed to create lead' });
    }

    console.log('Lead created successfully:', crmData);

    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: 'Form submitted successfully',
      leadId: crmData.data?.[0]?.details?.id 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
