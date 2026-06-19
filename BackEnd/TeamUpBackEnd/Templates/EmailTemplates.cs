namespace TeamUpBackEnd.Templates;

public static class EmailTemplates
{
    public static string VerificationCodeEmail(string code, string userName = "User")
    {
        return $@"
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Email Verification - TeamUp</title>
</head>
<body style='margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif; background-color: #f8f9fa;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;'>
        <!-- Header -->
        <div style='background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); padding: 40px 30px; text-align: center;'>
            <div style='font-size: 48px; margin-bottom: 16px;'>✉️</div>
            <h1 style='margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;'>Email Verification</h1>
        </div>

        <!-- Content -->
        <div style='padding: 40px 30px; color: #1f2937;'>
            <p style='font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>
                Hey <strong>{userName}</strong>,<br><br>
                Welcome to <strong>TeamUp</strong>! We're excited to have you on board. To verify your email and complete your registration, use the code below.
            </p>

            <!-- Code Box -->
            <div style='background: #f3f0ff; border: 2px solid #ddd6fe; border-radius: 12px; padding: 30px; text-align: center; margin: 32px 0;'>
                <p style='font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #7c3aed; margin: 0 0 12px 0;'>Your Verification Code</p>
                <div style='font-size: 48px; font-weight: 800; letter-spacing: 8px; color: #7c3aed; font-family: Monaco, Courier New, monospace; margin: 12px 0; word-spacing: 16px;'>{code}</div>
                <p style='font-size: 13px; color: #6b7280; margin: 12px 0 0 0;'>⏱️ Expires in 10 minutes</p>
            </div>

            <!-- Instructions -->
            <div style='background: #ecf9ff; border-left: 4px solid #06b6d4; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #374151;'>
                <p style='margin: 0 0 8px 0; color: #0891b2; font-weight: 600;'>ℹ️ How to verify your email</p>
                <p style='margin: 0;'>1. Copy the code above<br>2. Return to the TeamUp app<br>3. Paste the code in the verification field<br>4. Complete your account setup</p>
            </div>

            <!-- Security -->
            <div style='background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #374151;'>
                <p style='margin: 0 0 8px 0; color: #d97706; font-weight: 600;'>🔒 Keep Your Account Safe</p>
                <ul style='margin: 8px 0 0 16px; padding: 0; list-style: none;'>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> Never share this code with anyone</li>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> TeamUp staff will never ask for this code</li>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> This code expires in 10 minutes</li>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> If you didn't request this, ignore this email</li>
                </ul>
            </div>

            <!-- Footer text -->
            <div style='text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e7eb;'>
                <p style='font-size: 13px; color: #6b7280; line-height: 1.6; margin: 0;'>
                    <strong>Didn't request this?</strong><br>
                    If you didn't sign up for TeamUp, you can safely ignore this email.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div style='padding: 24px 30px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; background-color: #f9fafb;'>
            <p style='margin: 0 0 8px 0; font-weight: 800; color: #7c3aed; font-size: 16px;'>TeamUp</p>
            <p style='margin: 4px 0; line-height: 1.6;'>Building collaborative workspaces, one team at a time.</p>
            <p style='margin: 8px 0 0 0; opacity: 0.6;'>© 2024 TeamUp. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";
    }

    public static string ResetPasswordEmail(string resetLink, string userName = "User")
    {
        return $@"
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Reset Your Password - TeamUp</title>
</head>
<body style='margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif; background-color: #f8f9fa;'>
    <div style='max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden;'>
        <!-- Header -->
        <div style='background: linear-gradient(135deg, #ef4444 0%, #f87171 100%); padding: 40px 30px; text-align: center;'>
            <div style='font-size: 48px; margin-bottom: 16px;'>🔑</div>
            <h1 style='margin: 0; font-size: 32px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;'>Reset Your Password</h1>
        </div>

        <!-- Content -->
        <div style='padding: 40px 30px; color: #1f2937;'>
            <p style='font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;'>
                Hi <strong>{userName}</strong>,<br><br>
                We received a request to reset your TeamUp account password. Click the button below to create a new password.
            </p>

            <!-- Warning -->
            <div style='background: #fee2e2; border-left: 4px solid #ef4444; padding: 16px; margin: 24px 0; border-radius: 4px;'>
                <p style='margin: 0 0 8px 0; color: #dc2626; font-weight: 600; font-size: 14px;'>⚠️ Password Reset Request</p>
                <p style='margin: 0; font-size: 14px; color: #374151; line-height: 1.6;'>This password reset link will expire in 24 hours. If you didn't request this, you can safely ignore this email.</p>
            </div>

            <!-- CTA Button -->
            <div style='text-align: center; margin: 32px 0;'>
                <a href='{resetLink}' style='display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);'>Reset Your Password</a>
            </div>

            <!-- Divider -->
            <div style='text-align: center; margin: 20px 0; color: #9ca3af; font-size: 13px;'>
                ─────── OR ───────
            </div>

            <!-- Link Section -->
            <div style='background: #f3f0ff; border: 1px solid #ddd6fe; border-radius: 4px; padding: 16px; text-align: center;'>
                <p style='margin: 0 0 8px 0; font-size: 12px; color: #6b7280;'>Copy this link if the button doesn't work:</p>
                <a href='{resetLink}' style='color: #7c3aed; text-decoration: none; font-size: 13px; word-break: break-all; font-weight: 500;'>{resetLink}</a>
            </div>

            <!-- Instructions -->
            <div style='background: #ecf9ff; border-left: 4px solid #06b6d4; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #374151;'>
                <p style='margin: 0 0 8px 0; color: #0891b2; font-weight: 600;'>ℹ️ What happens next</p>
                <p style='margin: 0;'>1. Click the button or copy the link above<br>2. You'll be taken to a secure page<br>3. Create your new password<br>4. Sign in with your new password</p>
            </div>

            <!-- Security -->
            <div style='background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #374151;'>
                <p style='margin: 0 0 8px 0; color: #d97706; font-weight: 600;'>🔒 Security Tips</p>
                <ul style='margin: 8px 0 0 16px; padding: 0; list-style: none;'>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> Use a strong, unique password</li>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> Don't share this link with anyone</li>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> TeamUp staff will never ask for your password</li>
                    <li style='margin: 4px 0; padding-left: 16px; position: relative;'><span style='position: absolute; left: 0;'>✓</span> Link expires in 24 hours</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div style='padding: 24px 30px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; background-color: #f9fafb;'>
            <p style='margin: 0 0 8px 0; font-weight: 800; color: #ef4444; font-size: 16px;'>TeamUp</p>
            <p style='margin: 4px 0; line-height: 1.6;'>Building collaborative workspaces, one team at a time.</p>
            <p style='margin: 8px 0 0 0; opacity: 0.6;'>© 2024 TeamUp. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";
    }
}
