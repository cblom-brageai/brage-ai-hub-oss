# Example employees

Six ready-to-run employees used by Brage AI. Each folder is bind-mounted into its own container by `docker/docker-compose.local.yml`; the frontend lists every folder here as an employee.

| Folder | Role | Slack channel |
|---|---|---|
| `marketing-manager` | External communications, campaigns, publishing calendar | `#marketing`, `#general` |
| `bid-manager` | Tender triage and bid documents for PV / BESS projects | `#tenders` |
| `project-manager` | PRINCE2 delivery of construction projects | `#projects` |
| `quality-manager` | ISO 9001/14001/45001 integrated management system | `#quality` |
| `omengineer` | Operations and maintenance of solar and storage assets | `#operations` |
| `developer` | MCP servers, CI/CD, field device deployment (uses the GitHub MCP container) | `#dev`, `#software` |

Use them as examples of how to write a strategy, a personality and skills, then replace them with your own; see `docs/employees.md` and `docs/employee-template/`.
