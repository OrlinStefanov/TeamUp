namespace TeamUpBackEnd.Models.Tasks
{
	public class TaskAssignment
	{
		public int TaskItemId { get; set; }
		public TaskItem? TaskItem { get; set; }
		public string? UserId { get; set; }
		public ApplicationUser? User { get; set; }
	}
}
