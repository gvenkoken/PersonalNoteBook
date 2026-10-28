using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Hosting.Server;
using Microsoft.AspNetCore.Hosting.Server.Features;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

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
    [InlineData("Production")]
    [InlineData("Development")]
    public async Task Configured_Kestrel_listens_only_on_loopback(string environment)
    {
        await VerifyConfiguredHost(environment, []);
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

        await VerifyConfiguredHost(environment, externalAddresses);
    }

    private static async Task VerifyConfiguredHost(
        string environment, IPAddress[] externalAddresses)
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

        if (!Socket.OSSupportsIPv6)
            Assert.Skip("The configured dual-stack application requires IPv6 sockets.");

        // Exercise Program's complete endpoint configuration, changing only ports.
        var portOverrides = endpoints.ToDictionary(
            endpoint => $"Kestrel:Endpoints:{endpoint.Key}:Url",
            endpoint => (string?)new UriBuilder(endpoint["Url"]!) { Port = 0 }.Uri.AbsoluteUri);
        using var factory = new KestrelApplicationFactory(environment, portOverrides);
        var host = factory.StartApplication();
        try
        {
            var addresses = host.Services.GetRequiredService<IServer>()
                .Features.Get<IServerAddressesFeature>()!.Addresses;
            Assert.Equal(endpoints.Length, addresses.Count);
            using var client = new HttpClient(new SocketsHttpHandler { UseProxy = false });
            foreach (var address in addresses)
            {
                var uri = new Uri(address);
                var boundIp = IPAddress.Parse(uri.Host.Trim('[', ']'));
                Assert.True(IPAddress.IsLoopback(boundIp));
                Assert.Equal("Healthy", await client.GetStringAsync(
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

    private sealed class KestrelApplicationFactory(
        string environment, Dictionary<string, string?> portOverrides) : WebApplicationFactory<Program>
    {
        private IHost? applicationHost;

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(environment);
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(portOverrides));
        }

        protected override IHost CreateHost(IHostBuilder builder)
        {
            // The factory requires a TestServer host for its own bookkeeping.
            // Replay the same application entry point with real Kestrel as well.
            var testHost = builder.Build();
            try
            {
                builder.ConfigureWebHost(web =>
                {
                    web.ConfigureServices(services => services.RemoveAll<IServer>());
                    web.UseKestrel();
                });
                applicationHost = builder.Build();
                applicationHost.Start();
                testHost.Start();
                return testHost;
            }
            catch
            {
                applicationHost?.Dispose();
                applicationHost = null;
                testHost.Dispose();
                throw;
            }
        }

        public IHost StartApplication()
        {
            _ = Server;
            return applicationHost ?? throw new InvalidOperationException("Kestrel did not start.");
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
                applicationHost?.Dispose();
            base.Dispose(disposing);
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
                // A port may come from the environment with a default ("${APP_PORT:-8080}"); the default is what is checked.
                var resolved = System.Text.RegularExpressions.Regex.Replace(entry.Trim().Trim('"', '\''), @"\$\{[A-Z_][A-Z0-9_]*:-(\d+)\}", "$1");
                var mapping = resolved.Split(':');
                Assert.Equal(3, mapping.Length);
                Assert.Equal("127.0.0.1", mapping[0]);
                Assert.InRange(int.Parse(mapping[1]), 1, 65535);
                Assert.InRange(int.Parse(mapping[2]), 1, 65535);
            }
        }
    }
}
