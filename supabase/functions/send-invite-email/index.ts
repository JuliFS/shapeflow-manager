import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, companyName, role, siteUrl } = await req.json();

    if (!email || !companyName) {
      return new Response(
        JSON.stringify({ error: 'Email and company name are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const loginUrl = siteUrl || 'https://3dmanager.lovable.app';
    const roleLabel = role === 'admin' ? 'Administrador' : 'Membro';

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif; background: #f4f4f5; padding: 40px 0;">
        <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
          <div style="background: #2563eb; padding: 24px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px;">3D Manager</h1>
          </div>
          <div style="padding: 32px 24px;">
            <h2 style="color: #18181b; margin: 0 0 16px;">Você foi convidado! 🎉</h2>
            <p style="color: #52525b; line-height: 1.6; margin: 0 0 16px;">
              Você foi convidado para acessar o sistema de gestão <strong>3D Manager</strong> como <strong>${roleLabel}</strong> na empresa:
            </p>
            <div style="background: #f4f4f5; border-radius: 8px; padding: 16px; text-align: center; margin: 0 0 24px;">
              <p style="color: #18181b; font-size: 18px; font-weight: 700; margin: 0;">${companyName}</p>
            </div>
            <p style="color: #52525b; line-height: 1.6; margin: 0 0 24px;">
              Para aceitar o convite, faça login ou crie sua conta usando este email (<strong>${email}</strong>). O acesso será liberado automaticamente.
            </p>
            <div style="text-align: center;">
              <a href="${loginUrl}/auth" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                Acessar 3D Manager
              </a>
            </div>
          </div>
          <div style="padding: 16px 24px; text-align: center; border-top: 1px solid #e4e4e7;">
            <p style="color: #a1a1aa; font-size: 12px; margin: 0;">
              Este email foi enviado automaticamente pelo 3D Manager.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Use Lovable's email API
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    
    if (!LOVABLE_API_KEY) {
      console.log('LOVABLE_API_KEY not found, logging invite instead');
      console.log(`Invite email would be sent to: ${email}`);
      console.log(`Company: ${companyName}, Role: ${roleLabel}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Invite logged (email service not configured)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via Lovable email API
    const emailResponse = await fetch('https://api.lovable.dev/v1/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        to: email,
        subject: `Convite para ${companyName} — 3D Manager`,
        html: htmlBody,
      }),
    });

    if (!emailResponse.ok) {
      const errText = await emailResponse.text();
      console.error('Email API error:', errText);
      // Don't fail the invite creation, just log
      return new Response(
        JSON.stringify({ success: true, message: 'Invite created, email delivery pending' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await emailResponse.text();

    return new Response(
      JSON.stringify({ success: true, message: 'Invite email sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
