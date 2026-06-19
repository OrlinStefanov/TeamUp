using System.Net.Mail;
using System.Net;
using TeamUpBackEnd.Interfaces;

namespace TeamUpBackEnd.Services
{
	public class EmailService : IEmailService
	{
		private readonly IConfiguration _config;

		public EmailService(IConfiguration config)
		{
			_config = config;
		}


		public async Task SendEmailAsync(string toEmail, string subject, string body)
		{
			var fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM") ?? _config["Email:From"];

			// Create the email message
			var message = new MailMessage
			{
				From = new MailAddress(fromEmail),
				Subject = subject,
				Body = body,
				IsBodyHtml = true
			};
			message.To.Add(toEmail);

			// SMTP configuration
			var smtpHost = Environment.GetEnvironmentVariable("SMTP_HOST") ?? _config["Smtp:Host"];
			var smtpPortStr = Environment.GetEnvironmentVariable("SMTP_PORT") ?? _config["Smtp:Port"];
			var smtpUser = Environment.GetEnvironmentVariable("SMTP_USER") ?? _config["Smtp:User"];
			var smtpPass = Environment.GetEnvironmentVariable("SMTP_PASSWORD") ?? _config["Smtp:Password"];

			if (string.IsNullOrEmpty(smtpHost) || string.IsNullOrEmpty(smtpPass))
			{
				throw new InvalidOperationException("SMTP configuration is required. Set SMTP_HOST and SMTP_PASSWORD environment variables.");
			}

			int smtpPort = 465;
			if (!string.IsNullOrEmpty(smtpPortStr) && int.TryParse(smtpPortStr, out var parsedPort))
			{
				smtpPort = parsedPort;
			}

			using (var smtp = new SmtpClient(smtpHost, smtpPort))
			{
				smtp.EnableSsl = true;
				smtp.Credentials = new NetworkCredential(smtpUser, smtpPass);
				await smtp.SendMailAsync(message);
			}
		}

	}
}
