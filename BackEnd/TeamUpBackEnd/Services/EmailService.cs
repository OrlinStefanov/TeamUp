using System.Net.Mail;
using System.Text;
using System.Text.Json;
using System.Net.Http;
using System.Net;
using TeamUpBackEnd.Interfaces;

namespace TeamUpBackEnd.Services
{
	public class EmailService : IEmailService
	{
		private readonly IConfiguration _config;
		private readonly IHttpClientFactory _httpClientFactory;
		private string _accessToken;
		private DateTime _tokenExpiry;

		public EmailService(IConfiguration config, IHttpClientFactory httpClientFactory)
		{
			_config = config;
			_httpClientFactory = httpClientFactory;
		}

		private async Task<string> GetAccessTokenAsync()
		{
			// Check if token is still valid
			if (!string.IsNullOrEmpty(_accessToken) && DateTime.UtcNow < _tokenExpiry)
			{
				return _accessToken;
			}

			var clientId = Environment.GetEnvironmentVariable("GMAIL_CLIENT_ID") ?? _config["Gmail:ClientId"];
			var clientSecret = Environment.GetEnvironmentVariable("GMAIL_CLIENT_SECRET") ?? _config["Gmail:ClientSecret"];
			var refreshToken = Environment.GetEnvironmentVariable("GMAIL_REFRESH_TOKEN") ?? _config["Gmail:RefreshToken"];

			if (string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret) || string.IsNullOrEmpty(refreshToken))
			{
				throw new InvalidOperationException("Gmail API credentials (client id, client secret and refresh token) are required for OAuth2 flow.");
			}

			var httpClient = _httpClientFactory.CreateClient();
			var tokenRequest = new Dictionary<string, string>
			{
				{ "client_id", clientId },
				{ "client_secret", clientSecret },
				{ "refresh_token", refreshToken },
				{ "grant_type", "refresh_token" }
			};

			var response = await httpClient.PostAsync(
				"https://oauth2.googleapis.com/token",
				new FormUrlEncodedContent(tokenRequest)
			);

			if (!response.IsSuccessStatusCode)
			{
				var err = await response.Content.ReadAsStringAsync();
				throw new Exception($"Failed to obtain access token: {response.StatusCode} - {err}");
			}

			var responseContent = await response.Content.ReadAsStringAsync();
			var jsonResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);

			_accessToken = jsonResponse.GetProperty("access_token").GetString();
			var expiresIn = jsonResponse.GetProperty("expires_in").GetInt32();
			_tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn - 60); // Refresh 60 seconds before expiry

			return _accessToken;
		}

		public async Task SendEmailAsync(string toEmail, string subject, string body)
		{
			var fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM") ?? _config["Gmail:FromEmail"];

			// Create the email message
			var message = new MailMessage
			{
				From = new MailAddress(fromEmail),
				Subject = subject,
				Body = body,
				IsBodyHtml = true
			};
			message.To.Add(toEmail);

			// Determine if we should use Gmail API (OAuth2) or SMTP fallback
			var refreshToken = Environment.GetEnvironmentVariable("GMAIL_REFRESH_TOKEN") ?? _config["Gmail:RefreshToken"];
			var clientId = Environment.GetEnvironmentVariable("GMAIL_CLIENT_ID") ?? _config["Gmail:ClientId"];
			var clientSecret = Environment.GetEnvironmentVariable("GMAIL_CLIENT_SECRET") ?? _config["Gmail:ClientSecret"];

			// SMTP configuration (fallback) - can be set via environment variables or configuration
			var smtpHost = Environment.GetEnvironmentVariable("SMTP_HOST") ?? _config["Smtp:Host"] ?? "smtp.gmail.com";
			var smtpPortStr = Environment.GetEnvironmentVariable("SMTP_PORT") ?? _config["Smtp:Port"];
			int smtpPort = 587;
			if (!string.IsNullOrEmpty(smtpPortStr) && int.TryParse(smtpPortStr, out var parsedPort)) smtpPort = parsedPort;
			var smtpUser = Environment.GetEnvironmentVariable("SMTP_USER") ?? _config["Smtp:User"] ?? fromEmail;
			var smtpPass = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? Environment.GetEnvironmentVariable("EMAIL_PASSWORD") ?? _config["Smtp:Password"];

			if (string.IsNullOrEmpty(refreshToken) || string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(clientSecret))
			{
				// No refresh token/client credentials available -> use SMTP fallback if password is configured
				if (string.IsNullOrEmpty(smtpPass))
				{
					throw new InvalidOperationException("No Gmail refresh token found and no SMTP password configured. Set GMAIL_REFRESH_TOKEN (plus client id/secret) or SMTP_PASSWORD/EMAIL_PASSWORD.");
				}

				using (var smtp = new SmtpClient(smtpHost, smtpPort))
				{
					smtp.EnableSsl = true;
					smtp.Credentials = new NetworkCredential(smtpUser, smtpPass);
					await smtp.SendMailAsync(message);
					return;
				}
			}

			// Use Gmail API with OAuth2
			var accessToken = await GetAccessTokenAsync();

			// Convert to MIME format
			var mimeMessage = ConvertMailMessageToMimeString(message);

			// Encode for Gmail API
			var base64Message = Base64UrlEncode(Encoding.UTF8.GetBytes(mimeMessage));

			var httpClient = _httpClientFactory.CreateClient();
			httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {accessToken}");

			var payload = JsonSerializer.Serialize(new { raw = base64Message });
			var content = new StringContent(payload, Encoding.UTF8, "application/json");

			var response = await httpClient.PostAsync(
				"https://www.googleapis.com/gmail/v1/users/me/messages/send",
				content
			);

			if (!response.IsSuccessStatusCode)
			{
				var errorContent = await response.Content.ReadAsStringAsync();
				throw new Exception($"Failed to send email: {response.StatusCode} - {errorContent}");
			}
		}

		private string ConvertMailMessageToMimeString(MailMessage message)
		{
			var sb = new StringBuilder();

			// Headers
			sb.AppendLine($"From: {message.From.Address}");
			sb.AppendLine($"To: {string.Join(", ", message.To)}");
			sb.AppendLine($"Subject: {message.Subject}");
			sb.AppendLine("MIME-Version: 1.0");
			sb.AppendLine("Content-Type: text/html; charset=\"utf-8\"");
			sb.AppendLine("Content-Transfer-Encoding: quoted-printable");
			sb.AppendLine();

			// Body
			sb.AppendLine(message.Body);

			return sb.ToString();
		}

		private string Base64UrlEncode(byte[] buffer)
		{
			var base64 = Convert.ToBase64String(buffer);
			// Convert Base64 to Base64Url by replacing characters
			return base64.Replace("+", "-").Replace("/", "_").TrimEnd('=');
		}
	}
}
