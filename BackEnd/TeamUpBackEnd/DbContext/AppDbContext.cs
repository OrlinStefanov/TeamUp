using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using TeamUpBackEnd.Models;
using TeamUpBackEnd.Models.Chat;
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
		public DbSet<TaskItem> Tasks { get; set; }
		public DbSet<TaskAssignment> TaskAssignments { get; set; }

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			base.OnModelCreating(modelBuilder);

			modelBuilder.Entity<WorkSpaceMember>()
				.HasKey(wm => new { wm.WorkSpaceId, wm.UserId });

			modelBuilder.Entity<WorkSpace>()
				.HasOne(w => w.Owner)
				.WithMany()
				.HasForeignKey(w => w.OwnerId)
				.OnDelete(DeleteBehavior.Restrict);

			modelBuilder.Entity<WorkSpace>()
				.HasIndex(w => w.JoinCode)
				.IsUnique();

			modelBuilder.Entity<WorkSpaceMember>()
				.HasOne(wm => wm.WorkSpace)
				.WithMany(w => w.Members)
				.HasForeignKey(wm => wm.WorkSpaceId);

			modelBuilder.Entity<WorkSpaceMember>()
				.HasOne(wm => wm.User)
				.WithMany(u => u.Workspaces)
				.HasForeignKey(wm => wm.UserId);

			modelBuilder.Entity<WorkspaceInvitation>()
				.HasKey(wi => new { wi.WorkspaceId, wi.UserId });

			modelBuilder.Entity<WorkspaceInvitation>()
				.HasOne(wi => wi.WorkSpace)
				.WithMany(w => w.Invitations)
				.HasForeignKey(wi => wi.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<WorkspaceInvitation>()
				.HasOne<WorkSpace>()
				.WithMany(w => w.Invitations)
				.HasForeignKey(i => i.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			modelBuilder.Entity<WorkspaceInvitation>()
				.HasOne(wi => wi.User)
				.WithMany(u => u.WorkspaceInvitations)
				.HasForeignKey(wi => wi.UserId)
				.OnDelete(DeleteBehavior.Cascade);

			// TaskAssignment composite key
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

			// ChannelMember composite key
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

			// ConversationMember composite key
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

			// Channel → Workspace
			modelBuilder.Entity<Channel>()
				.HasOne(c => c.Workspace)
				.WithMany(w => w.Channels)
				.HasForeignKey(c => c.WorkspaceId)
				.OnDelete(DeleteBehavior.Cascade);

			// Message → Sender
			modelBuilder.Entity<Message>()
				.HasOne(m => m.Sender)
				.WithMany(u => u.SentMessages)
				.HasForeignKey(m => m.SenderId)
				.OnDelete(DeleteBehavior.Restrict);

			// Message → Channel
			modelBuilder.Entity<Message>()
				.HasOne(m => m.Channel)
				.WithMany(c => c.Messages)
				.HasForeignKey(m => m.ChannelId)
				.OnDelete(DeleteBehavior.Cascade);

			// Message → Conversation
			modelBuilder.Entity<Message>()
				.HasOne(m => m.Conversation)
				.WithMany(c => c.Messages)
				.HasForeignKey(m => m.ConversationId)
				.OnDelete(DeleteBehavior.Cascade);

			// PublicId indexes
			modelBuilder.Entity<Channel>()
				.HasIndex(c => c.PublicId)
				.IsUnique();

			modelBuilder.Entity<Conversation>()
				.HasIndex(c => c.PublicId)
				.IsUnique();

			modelBuilder.Entity<Message>()
				.HasIndex(m => m.PublicId)
				.IsUnique();

			modelBuilder.Entity<Message>()
				.HasIndex(m => m.ChannelId);

			modelBuilder.Entity<Message>()
				.HasIndex(m => m.ConversationId);
		}
	}
}
