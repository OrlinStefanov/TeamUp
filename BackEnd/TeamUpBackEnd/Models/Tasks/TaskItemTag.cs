namespace TeamUpBackEnd.Models.Tasks
{
	public class TaskItemTag
	{
		public int TaskItemId { get; set; }
		public TaskItem TaskItem { get; set; } = null!;

		public int TagId { get; set; }
		public Tag Tag { get; set; } = null!;
	}
}
