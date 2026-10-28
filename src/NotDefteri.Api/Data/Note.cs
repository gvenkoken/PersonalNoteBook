namespace NotDefteri.Api.Data;

public sealed class Note
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    internal void PrepareForSave(bool isNew, DateTime utcNow)
    {
        Content = Content.Replace("\r\n", "\n").Replace("\r", "\n");
        if (isNew) CreatedAt = utcNow;
        UpdatedAt = utcNow;
    }
}
