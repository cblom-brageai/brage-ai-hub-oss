# CI/CD — Google Cloud Run

Build and deploy containerised services to Google Cloud Run via GitHub Actions.

## Outputs
- `.github/workflows/deploy-cloud-run.yml`
- `Dockerfile`
- Deployment runbook (saved via `store_result`)

## Required secrets (GitHub Actions)
| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_SA_KEY` | Service account JSON key (base64 or raw) |
| `GCP_REGION` | e.g. `europe-west1` |

## Standard workflow structure
```yaml
name: Deploy to Cloud Run
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
      - uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}
      - uses: google-github-actions/setup-gcloud@v2
      - name: Build and push image
        run: |
          gcloud builds submit --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/<service>:<sha>
      - name: Deploy
        run: |
          gcloud run deploy <service> \
            --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/<service>:<sha> \
            --region ${{ secrets.GCP_REGION }} \
            --platform managed \
            --allow-unauthenticated
```

## Dry-run step (mandatory before first deploy)
Add this step before the deploy step when external APIs are involved:
```yaml
- name: Dry-run API check
  run: |
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer ${{ secrets.API_KEY }}" \
      https://api.example.com/health)
    if [ "$STATUS" != "200" ]; then echo "API dry-run FAILED: $STATUS"; exit 1; fi
```

## Guidelines
- Tag images with the git SHA, not `latest`
- Use Cloud Run's `--min-instances 0` for cost efficiency unless latency is critical
- All environment variables injected at deploy time via `--set-env-vars` or Secret Manager
- Always call `store_result` with the workflow file content and runbook
