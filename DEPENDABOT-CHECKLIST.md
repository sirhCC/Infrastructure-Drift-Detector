# Dependabot Activation Checklist

Use this checklist after pushing the Dependabot configuration to GitHub.

## Pre-Push Checklist ✅

- [x] Created `.github/dependabot.yml` configuration
- [x] Created `.github/workflows/dependabot.yml` CI workflow
- [x] Created `.github/DEPENDABOT.md` documentation
- [x] Updated main README.md with Dependabot reference
- [x] Created setup summary docs

## Push to GitHub

```bash
git add .github/
git add README.md
git add DEPENDABOT-SETUP.md
git commit -m "chore: add Dependabot configuration for automated dependency updates"
git push origin main
```

## Post-Push Activation (on GitHub.com)

### Step 1: Verify Files
- [ ] Navigate to: `https://github.com/sirhCC/Infrastructure-Drift-Detector`
- [ ] Check `.github/dependabot.yml` exists
- [ ] Check `.github/workflows/dependabot.yml` exists

### Step 2: Enable Dependabot (if not auto-enabled)
- [ ] Go to: **Settings** → **Security** → **Code security and analysis**
- [ ] Under "Dependabot":
  - [ ] Enable **Dependabot alerts**
  - [ ] Enable **Dependabot security updates**
  - [ ] Enable **Dependabot version updates** (should auto-enable with config file)

### Step 3: Initial Scan
- [ ] Wait 5-10 minutes for first scan
- [ ] Navigate to: **Security** → **Dependabot**
- [ ] Check for alerts and PRs

### Step 4: Review First PRs
- [ ] Check **Pull Requests** tab
- [ ] Look for PRs labeled `dependencies`
- [ ] Review CI test results
- [ ] Merge safe updates (patch/minor versions)

## Expected Results

After 10-15 minutes, you should see:

### In Pull Requests Tab
- ✅ Multiple PRs from `dependabot[bot]`
- ✅ Labeled with `dependencies` and `npm`
- ✅ CI workflow running/completed
- ✅ Auto-approval on patch/minor updates

### In Security Tab
- ✅ Dependabot section showing alerts (if any)
- ✅ List of vulnerable dependencies (if any)
- ✅ PRs linked to security alerts

### In Actions Tab
- ✅ "CI - Dependabot" workflow runs for each PR
- ✅ Green checkmarks for successful builds
- ✅ Tests running on Node.js 18.x and 20.x

## First Week Actions

### Day 1 (Today)
- [ ] Push configuration to GitHub
- [ ] Enable Dependabot
- [ ] Review initial PRs
- [ ] Merge 2-3 safe updates to test

### Day 2-3
- [ ] Merge remaining patch/minor updates
- [ ] Review any major version updates
- [ ] Check for breaking changes in major updates

### Day 4-7
- [ ] Test major updates locally before merging
- [ ] Monitor for new security alerts
- [ ] Verify weekly schedule works (Monday 9 AM)

## Verification Commands

### Check Dependabot Status
```bash
# List Dependabot PRs
gh pr list --label dependencies

# Check specific PR
gh pr view <PR_NUMBER>

# View security alerts
gh api repos/sirhCC/Infrastructure-Drift-Detector/dependabot/alerts
```

### Check CI Status
```bash
# View workflow runs
gh run list --workflow="CI - Dependabot"

# View specific run
gh run view <RUN_ID>
```

## Troubleshooting

### No PRs After 15 Minutes
- Check: Settings → Security → Dependabot is enabled
- Check: `.github/dependabot.yml` syntax is valid
- Try: Go to Dependabot settings and click "Check for updates"

### CI Workflow Not Running
- Check: `.github/workflows/dependabot.yml` exists
- Check: Actions are enabled (Settings → Actions)
- Check: Workflow file syntax is valid

### Auto-Approval Not Working
- Requires: `GITHUB_TOKEN` permissions (should be automatic)
- Check: Workflow has `pull-requests: write` permission
- Check: Tests are passing (auto-approval only on success)

## Success Indicators

You'll know it's working when:

✅ **PRs Created**: Dependabot creates PRs weekly (or immediately for security)  
✅ **CI Runs**: Tests run automatically on each PR  
✅ **Auto-Approval**: Safe updates show "Approved by github-actions"  
✅ **Security Alerts**: Vulnerabilities appear in Security tab  
✅ **Comments**: Bot adds helpful comments to PRs  

## Maintenance

### Weekly (Monday)
- [ ] Review new Dependabot PRs
- [ ] Merge safe updates
- [ ] Test and merge major updates

### Monthly
- [ ] Review ignored dependencies
- [ ] Update `.github/dependabot.yml` if needed
- [ ] Check for new Dependabot features

### As Needed
- [ ] Respond to security alerts immediately
- [ ] Update ignore list for problematic packages
- [ ] Adjust PR limits if too many/few

## Contact & Support

- **Documentation**: `.github/DEPENDABOT.md`
- **GitHub Docs**: https://docs.github.com/en/code-security/dependabot
- **Issues**: Create issue in this repo if problems persist

---

**Created**: November 13, 2025  
**Next Review**: Check status after first push to GitHub
