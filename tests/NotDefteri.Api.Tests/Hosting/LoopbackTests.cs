using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace NotDefteri.Api.Tests.Hosting;

public sealed class LoopbackTests
{
    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory);
             directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, "NotDefteri.sln")))
                return directory.FullName;
        }

        throw new InvalidOperationException("Repository root was not found.");
    }

    [Theory]
    [InlineData("Production", "HttpIPv4")]
    [InlineData("Production", "HttpIPv6")]
    [InlineData("Development", "HttpIPv4")]
    [InlineData("Development", "HttpIPv6")]
    public async Task Configured_Kestrel_listens_only_on_loopback(string environment, string endpointName)
    {
        await VerifyConfiguredHost(environment, endpointName, []);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    public async Task Non_loopback_interfaces_cannot_connect(string environment)
    {
        var externalAddresses = NetworkInterface.GetAllNetworkInterfaces()
            .Where(adapter => adapter.OperationalStatus == OperationalStatus.Up)
            .SelectMany(adapter => adapter.GetIPProperties().UnicastAddresses)
            .Select(info => info.Address)
            .Where(ip => !IPAddress.IsLoopback(ip) && ip.AddressFamily == AddressFamily.InterNetwork)
            .Distinct().ToArray();
        if (externalAddresses.Length == 0)
            Assert.Skip("The refusal check requires an active non-loopback IPv4 interface.");

        await VerifyConfiguredHost(environment, "HttpIPv4", externalAddresses);
    }

    private static async Task VerifyConfiguredHost(
        string environment, string endpointName, IPAddress[] externalAddresses)
    {
        var root = RepositoryRoot();
        // Read repository defaults independently of the runner's host configuration.
        var configuration = new ConfigurationBuilder()
            .SetBasePath(Path.Combine(root, "src", "NotDefteri.Api"))
            .AddJsonFile("appsettings.json")
            .AddJsonFile($"appsettings.{environment}.json", optional: true)
            .Build();
        using var configurationLifetime = (IDisposable)configuration;

        var endpoints = configuration.GetSection("Kestrel:Endpoints").GetChildren().ToArray();
        Assert.Equal(2, endpoints.Length);
        foreach (var endpoint in endpoints)
        {
            var uri = new Uri(endpoint["Url"]!);
            Assert.Equal("http", uri.Scheme);
            Assert.True(IPAddress.IsLoopback(IPAddress.Parse(uri.Host.Trim('[', ']'))));
        }

        var endpointUrl = new Uri(configuration[$"Kestrel:Endpoints:{endpointName}:Url"]!);
        var endpointIp = IPAddress.Parse(endpointUrl.Host.Trim('[', ']'));
        if (endpointIp.AddressFamily == AddressFamily.InterNetworkV6 && !Socket.OSSupportsIPv6)
            Assert.Skip("This host does not support IPv6 sockets.");

        // Exercise each configured interface on an ephemeral port, independently
        // of the test runner's application configuration and URL settings.
        using var host = new WebHostBuilder()
            .UseEnvironment(environment)
            .UseKestrel(options => options.Listen(endpointIp, 0))
            .Configure(app => app.Run(context => context.Response.WriteAsync("healthy")))
            .Build();
        try
        {
            await host.StartAsync(TestContext.Current.CancellationToken);
        }
        catch (SocketException error) when (error.SocketErrorCode == SocketError.AccessDenied)
        {
            Assert.Skip("The execution environment denies socket binding; real-host verification requires socket permission.");
        }
        try
        {
            var addresses = host.Services.GetRequiredService<IServer>()
                .Features.Get<IServerAddressesFeature>()!.Addresses;
            Assert.Single(addresses);
            using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false });
            foreach (var address in addresses)
            {
                var uri = new Uri(address);
                var boundIp = IPAddress.Parse(uri.Host.Trim('[', ']'));
                Assert.True(IPAddress.IsLoopback(boundIp));
                Assert.Equal(endpointIp, boundIp);
                Assert.Equal("healthy", await client.GetStringAsync(
                    new Uri(uri, "/health"), TestContext.Current.CancellationToken));

                // Use IPv4 for the external-interface probe. IPv6 interfaces may
                // expose link-local addresses without a usable route to probe.
                if (boundIp.AddressFamily != AddressFamily.InterNetwork)
                    continue;

                foreach (var externalIp in externalAddresses)
                {
                    using var socket = new TcpClient(externalIp.AddressFamily);
                    using var timeout = CancellationTokenSource.CreateLinkedTokenSource(
                        TestContext.Current.CancellationToken);
                    timeout.CancelAfter(TimeSpan.FromSeconds(2));
                    var error = await Record.ExceptionAsync((Func<Task>)(async () =>
                        await socket.ConnectAsync(externalIp, uri.Port, timeout.Token)));
                    // A timeout is not evidence of a refused connection.
                    var socketError = Assert.IsType<SocketException>(error);
                    if (socketError.SocketErrorCode == SocketError.AccessDenied)
                        Assert.Skip("The execution environment denies the interface connection probe; refusal could not be verified.");
                    Assert.Equal(SocketError.ConnectionRefused, socketError.SocketErrorCode);
                }
            }
        }
        finally
        {
            await host.StopAsync(CancellationToken.None);
        }
    }

    [Fact]
    public void Launch_profile_and_compose_ports_are_loopback_only()
    {
        var root = RepositoryRoot();
        using var launch = JsonDocument.Parse(File.ReadAllText(Path.Combine(root,
            "src/NotDefteri.Api/Properties/launchSettings.json")));
        foreach (var profile in launch.RootElement.GetProperty("profiles").EnumerateObject())
        {
            foreach (var address in profile.Value.GetProperty("applicationUrl").GetString()!.Split(';'))
                Assert.True(IPAddress.IsLoopback(IPAddress.Parse(new Uri(address).Host.Trim('[', ']'))));
        }

        var compose = File.ReadAllText(Path.Combine(root, "compose.yaml"));
        var portLines = compose.Split('\n').Where(line => line.TrimStart().StartsWith("ports:")).ToArray();
        Assert.NotEmpty(portLines);
        foreach (var line in portLines)
        {
            // The repository uses inline short-form Compose port lists. Check every entry.
            var entries = line[(line.IndexOf('[') + 1)..line.LastIndexOf(']')].Split(',');
            foreach (var entry in entries)
            {
                var mapping = entry.Trim().Trim('"', '\'').Split(':');
                Assert.Equal(3, mapping.Length);
                Assert.Equal("127.0.0.1", mapping[0]);
                Assert.InRange(int.Parse(mapping[1]), 1, 65535);
                Assert.InRange(int.Parse(mapping[2]), 1, 65535);
            }
        }
    }
}
