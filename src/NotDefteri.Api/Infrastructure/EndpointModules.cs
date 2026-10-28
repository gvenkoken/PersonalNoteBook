using System.Reflection;

namespace NotDefteri.Api.Infrastructure;

// A feature's HTTP surface. Implementations are discovered once at startup in a stable (type name) order.
public interface IEndpointModule
{
    void Map(IEndpointRouteBuilder endpoints);
}

public static class EndpointModules
{
    public static IEndpointRouteBuilder MapEndpointModules(this IEndpointRouteBuilder endpoints, Assembly assembly)
    {
        var modules = assembly.GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IEndpointModule).IsAssignableFrom(t))
            .OrderBy(t => t.FullName, StringComparer.Ordinal);
        foreach (var type in modules) ((IEndpointModule)Activator.CreateInstance(type)!).Map(endpoints);
        return endpoints;
    }
}
