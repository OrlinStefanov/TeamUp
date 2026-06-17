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
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f0f14 0%, #1a1a2e 100%);
            padding: 20px;
            color: #f0eeff;
        }}

        .email-container {{
            max-width: 600px;
            margin: 0 auto;
            background: linear-gradient(135deg, #17171f 0%, #1f1f2e 100%);
            border: 1px solid #363345;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
        }}

        .header {{
            background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
            padding: 40px 30px;
            text-align: center;
        }}

        .header-icon {{
            font-size: 48px;
            margin-bottom: 16px;
            display: inline-block;
            animation: pulse 2s infinite;
        }}

        @keyframes pulse {{
            0%, 100% {{ opacity: 1; }}
            50% {{ opacity: 0.7; }}
        }}

        .header h1 {{
            font-size: 32px;
            font-weight: 800;
            color: #fff;
            margin: 0;
            letter-spacing: -0.02em;
        }}

        .content {{
            padding: 40px 30px;
        }}

        .greeting {{
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
            color: #f0eeff;
        }}

        .greeting strong {{
            color: #a78bfa;
        }}

        .code-section {{
            background: rgba(124, 58, 237, 0.08);
            border: 2px solid rgba(124, 58, 237, 0.3);
            border-radius: 12px;
            padding: 30px;
            text-align: center;
            margin: 32px 0;
        }}

        .code-label {{
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #9a98a8;
            margin-bottom: 12px;
            display: block;
        }}

        .verification-code {{
            font-size: 48px;
            font-weight: 800;
            letter-spacing: 8px;
            color: #a78bfa;
            font-family: 'Monaco', 'Courier New', monospace;
            margin: 12px 0;
            word-spacing: 16px;
        }}

        .code-info {{
            font-size: 13px;
            color: #b8b6c3;
            margin-top: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        }}

        .timer-icon {{
            font-size: 16px;
        }}

        .info-section {{
            background: rgba(0, 188, 212, 0.06);
            border-left: 4px solid #00bcd4;
            padding: 16px;
            margin: 24px 0;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.6;
            color: #b8b6c3;
        }}

        .info-title {{
            color: #4dd0e1;
            font-weight: 600;
            margin-bottom: 8px;
        }}

        .security-tips {{
            background: rgba(245, 158, 11, 0.06);
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 24px 0;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.6;
            color: #b8b6c3;
        }}

        .security-title {{
            color: #fbbf24;
            font-weight: 600;
            margin-bottom: 8px;
        }}

        .security-list {{
            margin: 8px 0 0 16px;
            padding: 0;
            list-style: none;
        }}

        .security-list li {{
            margin: 4px 0;
            position: relative;
            padding-left: 16px;
        }}

        .security-list li:before {{
            content: '✓';
            position: absolute;
            left: 0;
            color: #fbbf24;
            font-weight: bold;
        }}

        .footer-divider {{
            height: 1px;
            background: linear-gradient(90deg, transparent, #363345, transparent);
            margin: 32px 0;
        }}

        .footer {{
            padding: 24px 30px;
            text-align: center;
            font-size: 12px;
            color: #6b6b8a;
            border-top: 1px solid #363345;
        }}

        .footer p {{
            margin: 4px 0;
            line-height: 1.6;
        }}

        .logo {{
            font-weight: 800;
            color: #a78bfa;
            font-size: 16px;
            margin-bottom: 8px;
        }}

        .social-links {{
            margin-top: 12px;
            display: flex;
            justify-content: center;
            gap: 12px;
        }}

        .social-links a {{
            color: #a78bfa;
            text-decoration: none;
            font-size: 12px;
            opacity: 0.8;
            transition: opacity 0.2s;
        }}

        .social-links a:hover {{
            opacity: 1;
        }}

        @media (max-width: 600px) {{
            .email-container {{
                border-radius: 8px;
            }}

            .header {{
                padding: 30px 20px;
            }}

            .header h1 {{
                font-size: 24px;
            }}

            .header-icon {{
                font-size: 36px;
            }}

            .content {{
                padding: 24px 20px;
            }}

            .code-section {{
                padding: 20px;
            }}

            .verification-code {{
                font-size: 36px;
                letter-spacing: 4px;
                word-spacing: 8px;
            }}

            .footer {{
                padding: 16px 20px;
                font-size: 11px;
            }}
        }}
    </style>
</head>
<body>
    <div class='email-container'>
        <div class='header'>
            <div class='header-icon'>✉️</div>
            <h1>Email Verification</h1>
        </div>

        <div class='content'>
            <div class='greeting'>
                Hey <strong>{userName}</strong>,<br>
                Welcome to <strong>TeamUp</strong>! We're excited to have you on board. To verify your email and complete your registration, use the code below.
            </div>

            <div class='code-section'>
                <span class='code-label'>Your Verification Code</span>
                <div class='verification-code'>{code}</div>
                <div class='code-info'>
                    <span class='timer-icon'>⏱️</span>
                    <span>Expires in 10 minutes</span>
                </div>
            </div>

            <div class='info-section'>
                <div class='info-title'>ℹ️ How to verify your email</div>
                1. Copy the code above<br>
                2. Return to the TeamUp app<br>
                3. Paste the code in the verification field<br>
                4. Complete your account setup
            </div>

            <div class='security-tips'>
                <div class='security-title'>🔒 Keep Your Account Safe</div>
                <ul class='security-list'>
                    <li>Never share this code with anyone</li>
                    <li>TeamUp staff will never ask for this code</li>
                    <li>This code expires in 10 minutes</li>
                    <li>If you didn't request this, ignore this email</li>
                </ul>
            </div>

            <div style='text-align: center; margin-top: 24px; padding-top: 24px; border-top: 1px solid #363345;'>
                <div style='font-size: 12px; color: #6b6b8a; line-height: 1.8;'>
                    <strong>Didn't request this?</strong><br>
                    If you didn't sign up for TeamUp, you can safely ignore this email.
                </div>
            </div>
        </div>

        <div class='footer'>
            <div class='logo'>TeamUp</div>
            <p>Building collaborative workspaces, one team at a time.</p>
            <p style='margin-top: 12px; opacity: 0.6;'>© 2024 TeamUp. All rights reserved.</p>
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
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #0f0f14 0%, #1a1a2e 100%);
            padding: 20px;
            color: #f0eeff;
        }}

        .email-container {{
            max-width: 600px;
            margin: 0 auto;
            background: linear-gradient(135deg, #17171f 0%, #1f1f2e 100%);
            border: 1px solid #363345;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.55);
        }}

        .header {{
            background: linear-gradient(135deg, #ef4444 0%, #f87171 100%);
            padding: 40px 30px;
            text-align: center;
        }}

        .header-icon {{
            font-size: 48px;
            margin-bottom: 16px;
            display: inline-block;
            animation: shake 0.5s;
        }}

        @keyframes shake {{
            0%, 100% {{ transform: rotate(0deg); }}
            25% {{ transform: rotate(-5deg); }}
            75% {{ transform: rotate(5deg); }}
        }}

        .header h1 {{
            font-size: 32px;
            font-weight: 800;
            color: #fff;
            margin: 0;
            letter-spacing: -0.02em;
        }}

        .content {{
            padding: 40px 30px;
        }}

        .greeting {{
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
            color: #f0eeff;
        }}

        .greeting strong {{
            color: #f87171;
        }}

        .warning-box {{
            background: rgba(239, 68, 68, 0.08);
            border: 2px solid rgba(239, 68, 68, 0.3);
            border-radius: 12px;
            padding: 20px;
            margin: 24px 0;
            border-left: 4px solid #ef4444;
        }}

        .warning-title {{
            color: #f87171;
            font-weight: 600;
            margin-bottom: 8px;
            font-size: 14px;
        }}

        .warning-text {{
            color: #b8b6c3;
            font-size: 14px;
            line-height: 1.6;
        }}

        .cta-button {{
            display: inline-block;
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
            color: #fff;
            text-decoration: none;
            padding: 14px 32px;
            border-radius: 8px;
            font-weight: 700;
            font-size: 15px;
            margin: 24px 0;
            text-align: center;
            transition: all 0.3s;
            box-shadow: 0 8px 16px rgba(239, 68, 68, 0.3);
        }}

        .cta-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 12px 24px rgba(239, 68, 68, 0.4);
        }}

        .cta-container {{
            text-align: center;
        }}

        .or-divider {{
            display: flex;
            align-items: center;
            margin: 20px 0;
            color: #6b6b8a;
            font-size: 13px;
        }}

        .or-divider::before,
        .or-divider::after {{
            content: '';
            flex: 1;
            height: 1px;
            background: #363345;
        }}

        .or-divider span {{
            padding: 0 12px;
        }}

        .link-section {{
            background: rgba(124, 58, 237, 0.08);
            border: 1px solid rgba(124, 58, 237, 0.2);
            border-radius: 8px;
            padding: 16px;
            text-align: center;
        }}

        .link-label {{
            font-size: 12px;
            color: #6b6b8a;
            margin-bottom: 8px;
            display: block;
        }}

        .reset-link {{
            color: #a78bfa;
            text-decoration: none;
            font-size: 13px;
            word-break: break-all;
            font-weight: 500;
            transition: color 0.2s;
        }}

        .reset-link:hover {{
            color: #c4b5fd;
        }}

        .info-section {{
            background: rgba(0, 188, 212, 0.06);
            border-left: 4px solid #00bcd4;
            padding: 16px;
            margin: 24px 0;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.6;
            color: #b8b6c3;
        }}

        .info-title {{
            color: #4dd0e1;
            font-weight: 600;
            margin-bottom: 8px;
        }}

        .security-tips {{
            background: rgba(245, 158, 11, 0.06);
            border-left: 4px solid #f59e0b;
            padding: 16px;
            margin: 24px 0;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.6;
            color: #b8b6c3;
        }}

        .security-title {{
            color: #fbbf24;
            font-weight: 600;
            margin-bottom: 8px;
        }}

        .security-list {{
            margin: 8px 0 0 16px;
            padding: 0;
            list-style: none;
        }}

        .security-list li {{
            margin: 4px 0;
            position: relative;
            padding-left: 16px;
        }}

        .security-list li:before {{
            content: '✓';
            position: absolute;
            left: 0;
            color: #fbbf24;
            font-weight: bold;
        }}

        .footer {{
            padding: 24px 30px;
            text-align: center;
            font-size: 12px;
            color: #6b6b8a;
            border-top: 1px solid #363345;
        }}

        .footer p {{
            margin: 4px 0;
            line-height: 1.6;
        }}

        .logo {{
            font-weight: 800;
            color: #a78bfa;
            font-size: 16px;
            margin-bottom: 8px;
        }}

        @media (max-width: 600px) {{
            .email-container {{
                border-radius: 8px;
            }}

            .header {{
                padding: 30px 20px;
            }}

            .header h1 {{
                font-size: 24px;
            }}

            .header-icon {{
                font-size: 36px;
            }}

            .content {{
                padding: 24px 20px;
            }}

            .cta-button {{
                width: 100%;
            }}

            .footer {{
                padding: 16px 20px;
                font-size: 11px;
            }}
        }}
    </style>
</head>
<body>
    <div class='email-container'>
        <div class='header'>
            <div class='header-icon'>🔑</div>
            <h1>Reset Your Password</h1>
        </div>

        <div class='content'>
            <div class='greeting'>
                Hi <strong>{userName}</strong>,<br>
                We received a request to reset your TeamUp account password. Click the button below to create a new password.
            </div>

            <div class='warning-box'>
                <div class='warning-title'>⚠️ Password Reset Request</div>
                <div class='warning-text'>
                    This password reset link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
                </div>
            </div>

            <div class='cta-container'>
                <a href='{resetLink}' class='cta-button'>Reset Your Password</a>
            </div>

            <div class='or-divider'>
                <span>OR</span>
            </div>

            <div class='link-section'>
                <span class='link-label'>Copy this link if the button doesn't work:</span>
                <a href='{resetLink}' class='reset-link'>{resetLink}</a>
            </div>

            <div class='info-section'>
                <div class='info-title'>ℹ️ What happens next</div>
                1. Click the button or copy the link above<br>
                2. You'll be taken to a secure page<br>
                3. Create your new password<br>
                4. Sign in with your new password
            </div>

            <div class='security-tips'>
                <div class='security-title'>🔒 Security Tips</div>
                <ul class='security-list'>
                    <li>Use a strong, unique password</li>
                    <li>Don't share this link with anyone</li>
                    <li>TeamUp staff will never ask for your password</li>
                    <li>Link expires in 24 hours</li>
                </ul>
            </div>
        </div>

        <div class='footer'>
            <div class='logo'>TeamUp</div>
            <p>Building collaborative workspaces, one team at a time.</p>
            <p style='margin-top: 12px; opacity: 0.6;'>© 2024 TeamUp. All rights reserved.</p>
        </div>
    </div>
</body>
</html>";
    }
}
