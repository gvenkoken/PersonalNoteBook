# API image (build context: repository root). The web client has its own image (web/Dockerfile); compose.yaml runs
# both with PostgreSQL.
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY Directory.Build.props NotDefteri.sln ./
COPY src/NotDefteri.Api/NotDefteri.Api.csproj src/NotDefteri.Api/
RUN dotnet restore src/NotDefteri.Api/NotDefteri.Api.csproj
COPY src/ src/
RUN dotnet publish src/NotDefteri.Api/NotDefteri.Api.csproj -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app .
USER app
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "NotDefteri.Api.dll"]
