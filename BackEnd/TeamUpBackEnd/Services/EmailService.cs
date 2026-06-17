using Microsoft.AspNetCore.Identity;
using System.Net;
using System.Net.Mail;
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
			var smtpServer = Environment.GetEnvironmentVariable("SMTP_SERVER") ?? _config["Email:SmtpServer"];
			var smtpPort = int.Parse(Environment.GetEnvironmentVariable("SMTP_PORT") ?? _config["Email:Port"] ?? "587");
			var username = Environment.GetEnvironmentVariable("EMAIL_USERNAME") ?? _config["Email:Username"];
			var password = Environment.GetEnvironmentVariable("EMAIL_PASSWORD") ?? _config["Email:Password"];
			var from = Environment.GetEnvironmentVariable("EMAIL_FROM") ?? _config["Email:From"];

			var smtpClient = new SmtpClient(smtpServer)
			{
				Port = smtpPort,
				Credentials = new NetworkCredential(username, password),
				EnableSsl = true
			};

			using var message = new MailMessage
			{
				From = new MailAddress(from),
				Subject = subject,
				Body = body,
				IsBodyHtml = true
			};

			message.To.Add(toEmail);

			await smtpClient.SendMailAsync(message);
		}
	}
}
