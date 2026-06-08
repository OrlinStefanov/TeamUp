using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using TeamUpBackEnd.Models;
using TeamUpBackEnd.Models.Auth;
using TeamUpBackEnd.Models.Chat;
using TeamUpBackEnd.Models.Inbox;
using TeamUpBackEnd.Models.Tasks;
using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.DbContext
{
	public class AppDbContext : IdentityDbContext<ApplicationUser>
	{
		public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

		//chat related
		public DbSet<Channel> Channels { get; set; }
		public DbSet<Conversation> Conversations { get; set; }
		public DbSet<Message> Messages { get; set; }
		public DbSet<ChannelMember> ChannelMembers { get; set; }
		public DbSet<ConversationMember> ConversationMembers { get; set; }

		//workspace related
		public DbSet<WorkSpace> Workspaces { get; set; }

		public DbSet<WorkSpaceMember> WorkspaceMembers { get; set; }
		public DbSet<WorkspaceInvitation> WorkspaceInvitations { get; set; }

		//tasks related
		public DbSet<TaskItem> Tasks { get; set; }
		public DbSet<TaskAssignment> TaskAssignments { get; set; }
		public DbSet<Tag> Tags { get; set; }
		public DbSet<TaskItemTag> TaskItemTags { get; set; }

		//auth verification
		public DbSet<EmailVerification> EmailVerifications { get; set; }

		// Add these two DbSets alongside the other workspace-related ones
		public DbSet<WorkspaceInboxMessage> WorkspaceInboxMessages { get; set; }
		public DbSet<WorkspaceInboxLastSeen> WorkspaceInboxLastSeen { get; set; }

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);

			var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
				v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
				v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
			);

			var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
				v => v.HasValue
					? (v.Value.Kind == DateTimeKind.Utc
						? v.Value
						: DateTime.SpecifyKind(v.Value, DateTimeKind.Utc))
					: v,
				v => v.HasValue
					? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc)
					: v
			);

			foreach (var entityType in modelBuilder.Model.GetEntityTypes())
			{
				foreach (var property in entityType.GetProperties())
				{
					if (property.ClrType == typeof(DateTime))
					{
						property.SetValueConverter(dateTimeConverter);
					}

					if (property.ClrType == typeof(DateTime?))
					{
						property.SetValueConverter(nullableDateTimeConverter);
					}
				}
			}

			modelBuilder.Entity<WorkSpaceMember>()
				.HasKey(wm => new { wm.WorkspaceId, wm.UserId });

			modelBuilder.Entity<WorkSpaceMember>()
				.HasOne(wm => wm.WorkSpace)
				.WithMany(w => w.Members)
				.HasForeignKey(wm => wm.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<WorkSpaceMember>()
				.HasOne(wm => wm.User)
				.WithMany(u => u.Workspaces)
				.HasForeignKey(wm => wm.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			// ------------------------
			// Workspace
			// ------------------------
			modelBuilder.Entity<WorkSpace>()
				.HasOne(w => w.Owner)
				.WithMany()
				.HasForeignKey(w => w.OwnerId)
				.OnDelete(DeleteBehavior.Restrict);

			modelBuilder.Entity<WorkSpace>()
				.HasIndex(w => w.JoinCode)
				.IsUnique();

			// ------------------------
			// WorkspaceInvitation
			// ------------------------
			modelBuilder.Entity<WorkspaceInvitation>()
				.HasKey(wi => new { wi.WorkspaceId, wi.UserId });

			modelBuilder.Entity<WorkspaceInvitation>()
				.HasOne(wi => wi.WorkSpace)
				.WithMany(w => w.Invitations)
				.HasForeignKey(wi => wi.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<WorkspaceInvitation>()
				.HasOne(wi => wi.User)
				.WithMany(u => u.WorkspaceInvitations)
				.HasForeignKey(wi => wi.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			// ------------------------
			// ChannelMember
			// ------------------------
			modelBuilder.Entity<ChannelMember>()
				.HasKey(cm => new { cm.ChannelId, cm.UserId });

			modelBuilder.Entity<ChannelMember>()
				.HasOne(cm => cm.Channel)
				.WithMany(c => c.Members)
				.HasForeignKey(cm => cm.ChannelId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<ChannelMember>()
				.HasOne(cm => cm.User)
				.WithMany(u => u.Channels)
				.HasForeignKey(cm => cm.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			// ------------------------
			// ConversationMember
			// ------------------------
			modelBuilder.Entity<ConversationMember>()
				.HasKey(cm => new { cm.ConversationId, cm.UserId });

			modelBuilder.Entity<ConversationMember>()
				.HasOne(cm => cm.Conversation)
				.WithMany(c => c.Members)
				.HasForeignKey(cm => cm.ConversationId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<ConversationMember>()
				.HasOne(cm => cm.User)
				.WithMany(u => u.Conversations)
				.HasForeignKey(cm => cm.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			// ------------------------
			// Channel → Workspace
			// ------------------------
			modelBuilder.Entity<Channel>()
				.HasOne(c => c.Workspace)
				.WithMany(w => w.Channels)
				.HasForeignKey(c => c.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			// ------------------------
			// Message relationships
			// ------------------------
			modelBuilder.Entity<Message>()
				.HasOne(m => m.Sender)
				.WithMany(u => u.SentMessages)
				.HasForeignKey(m => m.SenderId)
				.OnDelete(DeleteBehavior.Restrict);

			modelBuilder.Entity<Message>()
				.HasOne(m => m.Channel)
				.WithMany(c => c.Messages)
				.HasForeignKey(m => m.ChannelId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<Message>()
				.HasOne(m => m.Conversation)
				.WithMany(c => c.Messages)
				.HasForeignKey(m => m.ConversationId)
				.OnDelete(DeleteBehavior.Cascade);

			// ------------------------
			// TaskAssignment
			// ------------------------
			modelBuilder.Entity<TaskAssignment>()
				.HasKey(ta => new { ta.TaskItemId, ta.UserId });

			modelBuilder.Entity<TaskAssignment>()
				.HasOne(ta => ta.TaskItem)
				.WithMany(t => t.Assignments)
				.HasForeignKey(ta => ta.TaskItemId);

			modelBuilder.Entity<TaskAssignment>()
				.HasOne(ta => ta.User)
				.WithMany(u => u.Tasks)
				.HasForeignKey(ta => ta.UserId);

			modelBuilder.Entity<TaskItemTag>()
				.HasKey(tt => new { tt.TaskItemId, tt.TagId });

			modelBuilder.Entity<TaskItemTag>()
				.HasOne(tt => tt.TaskItem)
				.WithMany(t => t.TaskItemTags)
				.HasForeignKey(tt => tt.TaskItemId);

			modelBuilder.Entity<TaskItemTag>()
				.HasOne(tt => tt.Tag)
				.WithMany(t => t.TaskItemTags)
				.HasForeignKey(tt => tt.TagId);

			// ------------------------
			// Indexes
			// ------------------------
			modelBuilder.Entity<Channel>().HasIndex(c => c.PublicId).IsUnique();
			modelBuilder.Entity<Conversation>().HasIndex(c => c.PublicId).IsUnique();
			modelBuilder.Entity<Message>().HasIndex(m => m.PublicId).IsUnique();
			modelBuilder.Entity<Message>().HasIndex(m => m.ChannelId);
			modelBuilder.Entity<Message>().HasIndex(m => m.ConversationId);

			// ------------------------
			// Inbox related
			//------------------------
			// WorkspaceInboxMessage
			modelBuilder.Entity<WorkspaceInboxMessage>()
				.HasOne(m => m.WorkSpace)
				.WithMany(w => w.InboxMessages)
				.HasForeignKey(m => m.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<WorkspaceInboxMessage>()
				.HasIndex(m => m.PublicId)
				.IsUnique();

			modelBuilder.Entity<WorkspaceInboxMessage>()
				.HasIndex(m => m.WorkspaceId);

			modelBuilder.Entity<WorkspaceInboxMessage>()
				.HasIndex(m => m.ExpiresAt);

			// WorkspaceInboxLastSeen
			modelBuilder.Entity<WorkspaceInboxLastSeen>()
				.HasKey(ls => new { ls.WorkspaceId, ls.UserId });

			modelBuilder.Entity<WorkspaceInboxLastSeen>()
				.HasOne(ls => ls.WorkSpace)
				.WithMany(w => w.InboxLastSeen)
				.HasForeignKey(ls => ls.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<WorkspaceInboxLastSeen>()
				.HasOne(ls => ls.User)
				.WithMany()
				.HasForeignKey(ls => ls.UserId)
				.OnDelete(DeleteBehavior.Cascade);
		}
	}
}
