---
name: Deployment Issue
about: Report a problem with automated deployment
title: "[DEPLOY] "
labels: deployment
assignees: ""
---

## Deployment Information

**Date/Time of deployment**:
**GitHub Actions Run**: [Link to workflow run]
**Branch**: main
**Commit SHA**:

## Issue Description

A clear description of what went wrong during deployment.

## Error Messages

```
Paste any error messages from GitHub Actions or VPS logs here
```

## GitHub Actions Logs

[Attach or paste relevant GitHub Actions logs]

## VPS Logs (if applicable)

```bash
# Output of: pm2 logs kakamalem --lines 50
```

## Steps Already Taken

- [ ] Checked GitHub Actions logs
- [ ] Checked PM2 logs on VPS
- [ ] Verified environment variables exist
- [ ] Tested SSH connection manually
- [ ] Attempted manual deployment with `bash scripts/deploy.sh`

## Environment

- Node version on VPS:
- PM2 version:
- Disk space available:
- Last successful deployment:

## Additional Context

Any other relevant information about the issue.
