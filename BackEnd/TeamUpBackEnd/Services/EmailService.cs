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
			var smtpClient = new SmtpClient(_config["Email:SmtpServer"])
			{
				Port = int.Parse(_config["Email:Port"]),
				Credentials = new NetworkCredential(
					_config["Email:Username"],
					_config["Email:Password"]),
				EnableSsl = true
			};

			using var message = new MailMessage
			{
				From = new MailAddress(_config["Email:From"]),
				Subject = subject,
				Body = body,
				IsBodyHtml = true
			};

			message.To.Add(toEmail);

			await smtpClient.SendMailAsync(message);
		}
	}
}
