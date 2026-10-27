FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/Hub.csproj backend/
RUN dotnet restore backend/Hub.csproj
COPY backend/ backend/
RUN dotnet publish backend/Hub.csproj -c Release -o /out --no-restore /p:UseAppHost=false
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
USER root
RUN mkdir /app/keys && chown app:app /app/keys
USER app
ENV ASPNETCORE_HTTP_PORTS=8080 DOTNET_gcServer=0
ENTRYPOINT ["dotnet","Hub.dll"]
