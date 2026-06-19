using Resend;
using TeamUpBackEnd.Interfaces;

namespace TeamUpBackEnd.Services
{
	public class EmailService : IEmailService
	{
		private readonly IResend _resend;
		private readonly IConfiguration _config;

		public EmailService(IResend resend, IConfiguration config)
		{
			_resend = resend;
			_config = config;
		}

		public async Task SendEmailAsync(string toEmail, string subject, string body)
		{
			var from = Environment.GetEnvironmentVariable("EMAIL_FROM")
				?? _config["Email:From"]
				?? throw new InvalidOperationException("EMAIL_FROM environment variable is not set");

			var message = new EmailMessage
			{
				From = from,
				Subject = subject,
				HtmlBody = body
			};
			message.To.Add(toEmail);

			await _resend.EmailSendAsync(message);
		}
	}
}
