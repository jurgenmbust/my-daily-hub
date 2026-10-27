using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
namespace Hub;

public class DesignFactory : IDesignTimeDbContextFactory<HubDb>
{
    public HubDb CreateDbContext(string[] args) => new(new DbContextOptionsBuilder<HubDb>().UseNpgsql("Host=localhost;Database=dailyhub;Username=dailyhub").Options);
}
