# Attendance management API (Express + Lambda + MySQL)

## Deploy through Git (GitHub Actions)

On every push to **main**, the workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs `serverless deploy`.

### 1. Add repository secrets

GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret | Example |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret |
| `AWS_REGION` | `us-east-1` |
| `DB_HOST` | RDS endpoint |
| `DB_PORT` | `3306` |
| `DB_USER` | `admin` |
| `DB_PASSWORD` | RDS master password (no `@`, `/`, `"`, spaces) |
| `DB_NAME` | `attendance_db` |

### 2. IAM permissions for deploy

The IAM user needs permissions for CloudFormation, Lambda, API Gateway, S3 (Serverless deployment bucket), CloudWatch Logs, and IAM role creation for Lambda. Managed policy **AdministratorAccess** works for learning; use a tighter custom policy in production.

### 3. Push to deploy

```bash
git add .
git commit -m "your message"
git push origin main
```

Watch **Actions** in GitHub for the deploy log. After success, copy the **HTTP API** URL from the workflow output or AWS Console.

### Lambda → RDS

If RDS is only reachable inside a VPC, add `provider.vpc` in `serverless.yml` (subnets + security group). For a **public** RDS instance, allow inbound MySQL from Lambda (often requires VPC + NAT, or restricted SG rules—avoid `0.0.0.0/0` in production).

## Local run

```bash
cp .env.example .env
npm run dev
```
