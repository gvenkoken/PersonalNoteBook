namespace NotDefteri.Api.Infrastructure;

// Field errors collected by validators and returned as a 400 validation problem.
public sealed class ValidationErrors
{
    private readonly Dictionary<string, List<string>> errors = new(StringComparer.Ordinal);
    public bool IsValid => errors.Count == 0;
    public void Add(string field, string message)
    {
        if (!errors.TryGetValue(field, out var list)) errors[field] = list = [];
        list.Add(message);
    }
    public IResult ToProblem() => Results.ValidationProblem(errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));
}
