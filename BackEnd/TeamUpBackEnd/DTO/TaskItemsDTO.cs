using TeamUpBackEnd.Models.Tasks;

using System.Text.Json.Serialization;

namespace TeamUpBackEnd.DTO
{
	public class TaskItemsDTO
	{	
		public record CreateTaskItemDTO
		{
			public string? Title { get; init; }
			public string? Description { get; init; }
			public DateTime? DueDate { get; init; }
			public DateTime? StartDate { get; init; }
			public TasksStatus Status { get; init; }
			public TaskDifficulty? Difficulty { get; init; }
			[JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
			public int? Points { get; init; }
			public List<string>? AssignedUserIds { get; init; }
			public List<int>? TagIds { get; init; }
			public List<string>? NewTags { get; init; }
			public int WorkspaceId { get; init; }
		}

		public record EditTaskDTO 
		{
			public string? Title { get; init; }
			public string? Description { get; init; }
			public DateTime StartDate { get; init; }
			public DateTime DueDate { get; init; }
			public TasksStatus? Status { get; init; }
			public TaskDifficulty? Difficulty { get; init; }
			public int Points { get; init; }
			public List<string>? AssignedUsers { get; init; } = new List<string>();
		}
	}
}
