# Docker Desktop WSL Integration Setup

## Quick Setup for Docker Desktop with WSL

Since you have Docker Desktop installed on Windows, follow these steps:

### 1. Enable WSL Integration in Docker Desktop

1. **Open Docker Desktop** on Windows
2. Go to **Settings** (gear icon)
3. Navigate to **Resources** → **WSL Integration**
4. Enable integration with your WSL distro:
   - Turn on "Enable integration with my default WSL distro"
   - Toggle on your specific WSL distribution

### 2. Restart Docker Desktop and WSL

```bash
# In Windows PowerShell (as admin):
wsl --shutdown

# Then restart Docker Desktop and open WSL again
```

### 3. Test Docker Access from WSL

```bash
# In WSL terminal:
docker --version
docker-compose --version
```

### 4. If Docker Commands Still Not Found

Add these aliases to your `.bashrc`:

```bash
echo 'alias docker="docker.exe"' >> ~/.bashrc
echo 'alias docker-compose="docker-compose.exe"' >> ~/.bashrc
source ~/.bashrc
```

### 5. Start Your Development Environment

Once Docker is accessible:

```bash
# Navigate to your project
cd /home/locklearwyatt/projects/medcontracthub

# Start development environment
./docker-scripts.sh start dev
```

## Alternative: Direct Docker Commands

If the script doesn't work initially, use these commands directly:

```bash
# For development environment
docker-compose -f docker-compose.multi-env.yml up -d dev-app dev-redis dev-db

# Check if containers are running
docker ps

# View logs
docker-compose -f docker-compose.multi-env.yml logs -f dev-app
```

## Troubleshooting

### "Cannot connect to Docker daemon"
- Ensure Docker Desktop is running on Windows
- Check WSL integration is enabled
- Restart both Docker Desktop and WSL

### Permission Issues
```bash
# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

### Port Already in Use
- Check if ports 3000, 5432, or 6379 are already used
- Stop conflicting services or change ports in docker-compose.multi-env.yml

## Next Steps

After Docker is working:

1. Copy environment variables:
   ```bash
   cp .env.docker.example .env
   # Edit .env with your actual API keys
   ```

2. Start your three environments:
   ```bash
   ./docker-scripts.sh start dev      # Development on port 3000
   ./docker-scripts.sh start staging  # Staging on port 3001
   ./docker-scripts.sh start prod     # Production on port 3002
   ```

3. Access your environments:
   - Dev: http://localhost:3000
   - Staging: http://localhost:3001
   - Prod: http://localhost:3002