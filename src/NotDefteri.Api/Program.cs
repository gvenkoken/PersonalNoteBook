using NotDefteri.Api.Data;
using NotDefteri.Api.Features.Notes;
using NotDefteri.Api.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;

var builder = WebApplication.CreateBuilder(args);

// Errors are RFC 7807 problem details everywhere (exceptions, status codes, validation).
builder.Services.AddProblemDetails();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddAppData(builder.Configuration);
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
// JWT access tokens from the identity provider chosen by the architecture; Authority and ValidAudiences come from the
// configuration section Authentication:Schemes:Bearer:*. Without it no token validates, so protected endpoints answer 401.
builder.Services.AddAuthentication().AddJwtBearer();
builder.Services.AddAuthorization();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Liveness never touches dependencies; readiness checks the database.
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains("ready") });

// Every feature registers its own endpoints (see IEndpointModule); generated slices need no edit here.
app.MapEndpointModules(typeof(Program).Assembly);
app.MapNotes();

app.Run();

public partial class Program;
