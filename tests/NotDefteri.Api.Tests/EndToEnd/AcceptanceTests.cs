using NotDefteri.Api.Tests.Features.Notes;
using NotDefteri.Api.Tests.Hosting;

namespace NotDefteri.Api.Tests.EndToEnd;

// Run the existing HTTP/database and real Kestrel probes as one acceptance suite.
public sealed class AcceptanceTests
{
    [Fact]
    public async Task Anonymous_CRUD_and_permanent_deletion() =>
        await new NotesApiTests().Anonymous_client_can_create_list_update_and_permanently_delete();

    [Fact]
    public async Task Conflicting_create_and_rename_preserve_stored_notes() =>
        await new NotesApiTests().Duplicate_create_and_rename_return_distinct_conflict_without_changing_notes();

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    public async Task Real_host_listens_only_on_loopback(string environment) =>
        await new LoopbackTests().Configured_Kestrel_listens_only_on_loopback(environment);

    [Theory]
    [InlineData("Production")]
    [InlineData("Development")]
    public async Task External_interfaces_refuse_connections(string environment) =>
        await new LoopbackTests().Non_loopback_interfaces_cannot_connect(environment);
}
