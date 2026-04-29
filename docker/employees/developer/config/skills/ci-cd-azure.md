# CI/CD — Azure Container Apps & App Service

Build and deploy containerised services to Azure Container Apps (preferred) or Azure App Service via GitHub Actions.

## Outputs
- `.github/workflows/deploy-azure.yml`
- `Dockerfile`
- Deployment runbook (saved via `store_result`)

## Required secrets (GitHub Actions)
| Secret | Description |
|--------|-------------|
| `AZURE_CLIENT_ID` | Service principal / managed identity client ID |
| `AZURE_TENANT_ID` | Azure Active Directory tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `AZURE_RESOURCE_GROUP` | Target resource group name |
| `AZURE_REGISTRY` | Azure Container Registry login server (e.g. `myacr.azurecr.io`) |

## Standard workflow — Azure Container Apps
```yaml
name: Deploy to Azure Container Apps
on:
  push:
    branches: [main]
    paths: ['<service-dir>/**']

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v2
        with:
          client-id: ${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          subscription-id: ${{ secrets.AZURE_SUBSCRIPTION_ID }}
      - name: Build and push to ACR
        run: |
          az acr build \
            --registry ${{ secrets.AZURE_REGISTRY }} \
            --image <service>:${{ github.sha }} \
            ./<service-dir>
      - name: Deploy to Container App
        run: |
          az containerapp update \
            --name <app-name> \
            --resource-group ${{ secrets.AZURE_RESOURCE_GROUP }} \
            --image ${{ secrets.AZURE_REGISTRY }}/<service>:${{ github.sha }}
```

## Dry-run step (mandatory before first deploy)
```yaml
- name: Dry-run API check
  run: |
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $(az account get-access-token --query accessToken -o tsv)" \
      https://management.azure.com/subscriptions/${{ secrets.AZURE_SUBSCRIPTION_ID }}?api-version=2020-01-01)
    if [ "$STATUS" != "200" ]; then echo "Azure API dry-run FAILED: $STATUS"; exit 1; fi
```

## Guidelines
- Use OIDC / Workload Identity Federation (`id-token: write`) instead of long-lived client secrets where possible
- Tag images with the git SHA
- Inject secrets via Azure Key Vault references in Container App environment config, not hardcoded in the workflow
- Always call `store_result` with the workflow file content and runbook
