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

			var httpClient = _httpClientFactory.CreateClient();
			var tokenRequest = new Dictionary<string, string>
			{
				{ "client_id", clientId },
				{ "client_secret", clientSecret },
				{ "refresh_token", refreshToken ?? "" },
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
			_tokenExpiry = DateTime.UtcNow.AddSeconds(expiresIn - 60);

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
			return base64.Replace("+", "-").Replace("/", "_").TrimEnd('=');
		}
	}
}
