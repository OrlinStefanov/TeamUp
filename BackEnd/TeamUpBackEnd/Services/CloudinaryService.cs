using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Npgsql.BackendMessages;
using System.Security.Principal;

namespace TeamUpBackEnd.Services
{
	public class CloudinaryService
	{
		private readonly Cloudinary _cloudinary;

		public CloudinaryService(IConfiguration config)
		{
			var account = new Account(
				config["Cloudinary:CloudName"],
				config["Cloudinary:ApiKey"],
				config["Cloudinary:ApiSecret"]
			);

			_cloudinary = new Cloudinary(account);
		}

		public async Task<string> UploadProfileImage(IFormFile file)
		{
			await using var stream = file.OpenReadStream();

			var uploadParams = new ImageUploadParams
			{
				File = new FileDescription(file.FileName, stream),

				Folder = "profile_pictures",

				Transformation = new Transformation()
					.Width(256)
					.Height(256)
					.Crop("fill")
					.Gravity("face")
					.FetchFormat("auto")
					.Quality("auto")
			};

			var result = await _cloudinary.UploadAsync(uploadParams);

			return result.SecureUrl.ToString();
		}
	}
}
