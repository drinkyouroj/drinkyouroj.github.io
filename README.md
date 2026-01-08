# drinkyouroj.github.io

Personal site for **Justin Hearn** (Support Engineer & Sysadmin), hosted on GitHub Pages.

## Local preview

From the repo root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Blog posts (Substack)

The homepage loads recent posts from `assets/substack.json`.

- Update locally:

```bash
python3 scripts/update_substack_feed.py
```

- Update automatically:
  - GitHub Action: `.github/workflows/update-substack.yml` (daily + on demand)

