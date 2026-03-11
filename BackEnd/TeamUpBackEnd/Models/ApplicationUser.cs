using Microsoft.AspNetCore.Identity;
using TeamUpBackEnd.Models.Chat;
using TeamUpBackEnd.Models.Tasks;
using TeamUpBackEnd.Models.WorkspaceRelated;

namespace TeamUpBackEnd.Models
{
	public class ApplicationUser : IdentityUser
	{
		public string? FirstName { get; set; }
		public string? LastName { get; set; }
		public string? ProfilePictureUrl { get; set; }
		public DateOnly? BirthDate { get; set; }

		public ICollection<Message>? SentMessages { get; set; }
		public ICollection<ConversationMember>? Conversations { get; set; }
		public ICollection<ChannelMember>? Channels { get; set; }
		public ICollection<TaskAssignment>? Tasks { get; set; }
		public ICollection<WorkSpaceMember>? Workspaces { get; set; }
	}
}
