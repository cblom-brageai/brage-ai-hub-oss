# Field Device Deployment via Tailscale

Deploy and update software on field-deployed hardware (Raspberry Pi and similar Linux ARM devices) accessible over Tailscale, using the same GitHub Actions architecture as cloud deployments.

## Architecture overview
```
GitHub Actions runner
    └─ tailscale/github-action  (joins Tailscale network)
         └─ SSH → device Tailscale IP / hostname
               └─ docker compose pull && docker compose up -d
```

The device runs Docker. The GitHub Actions workflow:
1. Joins the Tailscale network using an OAuth client key
2. SSHes into the device using its Tailscale hostname (e.g. `raspberry-pi-01`)
3. Pulls the new image from the registry
4. Restarts the service with zero-downtime compose restart

## Outputs
- `.github/workflows/deploy-field-<device>.yml`
- `docker-compose.yml` for the device
- `/etc/systemd/system/docker-compose-<service>.service` snippet (for auto-start on boot)
- Deployment runbook (saved via `store_result`)

## Required secrets (GitHub Actions)
| Secret | Description |
|--------|-------------|
| `TAILSCALE_OAUTH_CLIENT_ID` | Tailscale OAuth client ID (from admin console) |
| `TAILSCALE_OAUTH_CLIENT_SECRET` | Tailscale OAuth client secret |
| `FIELD_DEVICE_USER` | SSH user on the device (e.g. `pi`) |
| `FIELD_DEVICE_HOST` | Tailscale hostname of the device (e.g. `raspberry-pi-01`) |
| `FIELD_SSH_KEY` | Private SSH key for the deploy user |
| `REGISTRY_TOKEN` | Read token for the container registry (if private) |

## Standard workflow
```yaml
name: Deploy to Field Device
on:
  push:
    branches: [main]
    paths: ['<service-dir>/**']

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Connect to Tailscale
        uses: tailscale/github-action@v3
        with:
          oauth-client-id: ${{ secrets.TAILSCALE_OAUTH_CLIENT_ID }}
          oauth-secret: ${{ secrets.TAILSCALE_OAUTH_CLIENT_SECRET }}
          tags: tag:ci

      - name: Set up SSH
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.FIELD_SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          ssh-keyscan -H ${{ secrets.FIELD_DEVICE_HOST }} >> ~/.ssh/known_hosts 2>/dev/null || true

      - name: Dry-run connectivity check
        run: |
          ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no \
            ${{ secrets.FIELD_DEVICE_USER }}@${{ secrets.FIELD_DEVICE_HOST }} \
            "echo OK && docker --version"

      - name: Deploy
        run: |
          ssh -i ~/.ssh/deploy_key \
            ${{ secrets.FIELD_DEVICE_USER }}@${{ secrets.FIELD_DEVICE_HOST }} \
            "cd /opt/<service> && \
             docker compose pull && \
             docker compose up -d --remove-orphans"
```

## Device setup requirements (one-time, manual)
1. Tailscale installed and authenticated on the device
2. Docker and Docker Compose installed
3. Deploy SSH key added to `~/.ssh/authorized_keys` for the deploy user
4. Service directory at `/opt/<service>/` with a `docker-compose.yml` and `.env`
5. `.env` file pre-populated with secrets (never committed; applied once manually)

## New device checklist
- [ ] Device has a stable Tailscale hostname (set in Tailscale admin console under Machines → edit name)
- [ ] Device Tailscale hostname added to GitHub Actions secret `FIELD_DEVICE_HOST`
- [ ] Deploy SSH key pair generated; public key on device, private key in GitHub secret
- [ ] `docker-compose.yml` committed to the repo under `<service-dir>/`
- [ ] Tailscale OAuth client created with `tag:ci` permission in Tailscale ACLs
- [ ] Dry-run SSH connectivity test passes in a test workflow run before merging deploy workflow

## Dry-run API testing (for services with external APIs)
If the service integrates with an external API (e.g. weather, SCADA, billing):
```yaml
- name: Dry-run external API check
  run: |
    ssh -i ~/.ssh/deploy_key \
      ${{ secrets.FIELD_DEVICE_USER }}@${{ secrets.FIELD_DEVICE_HOST }} \
      "curl -s -o /dev/null -w '%{http_code}' \
        -H 'Authorization: Bearer ${{ secrets.EXTERNAL_API_KEY }}' \
        https://api.example.com/health"
```
Block the deploy if the check does not return `200`.

## Rollback
```bash
ssh pi@raspberry-pi-01 "cd /opt/<service> && docker compose down && docker compose up -d --scale app=1"
```
Or tag the previous image SHA and re-deploy via GitHub Actions with the old tag.

## Guidelines
- Every device follows this identical pattern — no bespoke shell scripts per device
- The `.env` on the device is the only place secrets live; rotate by updating the file and restarting the container
- Use `restart: unless-stopped` in docker-compose so services survive reboots
- Always call `store_result` with the workflow file, docker-compose.yml, and device setup runbook
