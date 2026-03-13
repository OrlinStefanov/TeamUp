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

		public ICollection<Message> SentMessages { get; set; } = new List<Message>();
		public ICollection<ConversationMember> Conversations { get; set; } = new List<ConversationMember>();
		public ICollection<ChannelMember> Channels { get; set; } = new List<ChannelMember>();
		public ICollection<TaskAssignment> Tasks { get; set; } = new List<TaskAssignment>();
		public ICollection<WorkSpaceMember> Workspaces { get; set; } = new List<WorkSpaceMember>();
	}
}
