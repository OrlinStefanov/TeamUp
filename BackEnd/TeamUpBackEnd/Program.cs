using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using System.Text;
using DotNetEnv;
using TeamUpBackEnd.DbContext;
using TeamUpBackEnd.Extensions;
using TeamUpBackEnd.Helpers;
using TeamUpBackEnd.Interfaces;
using TeamUpBackEnd.Models;
using TeamUpBackEnd.Services;

var envPath = FindEnvFile();
if (!string.IsNullOrEmpty(envPath)) Env.Load(envPath);

static string? FindEnvFile()
{
	var currentDir = new DirectoryInfo(Directory.GetCurrentDirectory());
	while (currentDir != null)
	{
		var envFile = Path.Combine(currentDir.FullName, ".env");
		if (File.Exists(envFile)) return envFile;
		currentDir = currentDir.Parent;
	}
	return null;
}

var builder = WebApplication.CreateBuilder(args);

var backendUrl = Environment.GetEnvironmentVariable("BACKEND_URL")
	?? Environment.GetEnvironmentVariable("API_URL")
	?? "https://localhost:7094";
var frontendUrl = Environment.GetEnvironmentVariable("FRONTEND_URL")
	?? "http://localhost:4200";

builder.Services.AddControllers();

var connectionString = Environment.GetEnvironmentVariable("DATABASE_CONNECTION_STRING")
	?? throw new InvalidOperationException("DATABASE_CONNECTION_STRING environment variable is not set");

builder.Services.AddDbContext<AppDbContext>(options =>
	options.UseNpgsql(connectionString));

builder.Services.AddIdentity<ApplicationUser, IdentityRole>()
	.AddEntityFrameworkStores<AppDbContext>()
	.AddDefaultTokenProviders();

builder.Services.Configure<IdentityOptions>(options =>
{
	options.Password.RequiredLength = 8;
	options.Password.RequireDigit = true;
	options.Password.RequireUppercase = true;
	options.Password.RequireLowercase = true;
	options.Password.RequireNonAlphanumeric = true;
});

builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<CloudinaryService>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddHttpClient();

builder.Services.AddAuthentication(options =>
{
	options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
	options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})

.AddJwtBearer(options =>
{
	var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY") ?? builder.Configuration["Jwt:Key"];
	var jwtIssuer = Environment.GetEnvironmentVariable("JWT_ISSUER") ?? builder.Configuration["Jwt:Issuer"];
	var jwtAudience = Environment.GetEnvironmentVariable("JWT_AUDIENCE") ?? builder.Configuration["Jwt:Audience"];

	var key = Encoding.ASCII.GetBytes(jwtKey!);
	options.TokenValidationParameters = new TokenValidationParameters
	{
		ValidateIssuer = true,
		ValidateAudience = true,
		ValidateLifetime = true,
		ValidateIssuerSigningKey = true,
		ValidIssuer = jwtIssuer,
		ValidAudience = jwtAudience,
		IssuerSigningKey = new SymmetricSecurityKey(key)
	};

	options.Events = new JwtBearerEvents
	{
		OnMessageReceived = context =>
		{
			var accessToken = context.Request.Query["access_token"];
			var path = context.HttpContext.Request.Path;

			if (!string.IsNullOrEmpty(accessToken) &&
				(path.StartsWithSegments("/chathub") ||
				 path.StartsWithSegments("/dmhub") ||
				 path.StartsWithSegments("/taskhub")))
			{
				context.Token = accessToken;
			}
			return Task.CompletedTask;
		}
	};
});

builder.Services.AddCors(options =>
{
	options.AddPolicy("AllowAll", builder =>
	{
		builder.WithOrigins(frontendUrl)
				.AllowAnyHeader()
				.AllowAnyMethod()
				.AllowCredentials();
	});
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
	options.SwaggerDoc("v1", new() { Title = "TeamUp API", Version = "v1" });
	options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
	{
		Name = "Authorization",
		Type = SecuritySchemeType.ApiKey,
		Scheme = "Bearer",
		BearerFormat = "JWT",
		In = ParameterLocation.Header,
		Description = "Enter 'Bearer' followed by a space and your JWT token."
	});

	options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
	{
		[new OpenApiSecuritySchemeReference("Bearer", document)] = []
	});
});

builder.Services.AddRateLimiter(options =>
{
	options.AddFixedWindowLimiter("auth", config =>
	{
		config.PermitLimit = 5;
		config.Window = TimeSpan.FromMinutes(3);
	});
});

builder.Services.AddSignalR();
builder.Services.AddSingleton<IUserIdProvider, CustomUserIdProvider>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
	app.UseSwagger();
	app.UseSwaggerUI(c =>
	{
		c.SwaggerEndpoint("/swagger/v1/swagger.json", "MyWebApi v1");
		c.RoutePrefix = string.Empty; 
	});
}

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapFallbackToFile("index.html");
	
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.UseRateLimiter();

app.MapHub<ChatHub>("/chathub");
app.MapHub<TaskHub>("/taskhub");

app.MapHub<DmHub>("/dmhub").RequireAuthorization();

EndpointsGenerator.MapEndpoints(app);
DirectMessagesEndpoints.MapDirectMessages(app);
InboxEndpoints.MapInboxEndpoints(app);

app.UseHttpsRedirection();

app.MapControllers();

app.Run();
