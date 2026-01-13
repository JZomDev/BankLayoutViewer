# Bank Tags Helper — Basic GitHub Pages site

This repository contains a small static webpage you can publish on GitHub Pages. I will integrate your data later — for now the page uses fallback sample tags.

Files created:

- [index.html](index.html)
- [assets/css/styles.css](assets/css/styles.css)
- [assets/js/script.js](assets/js/script.js)

Quick publish steps:

1. Create a new GitHub repository (or use an existing one).
2. Commit and push these files to the `main` branch.
3. In the repository's Settings → Pages, choose `main` branch and `/ (root)` for the folder, then save.
4. Your site will be available at `https://<username>.github.io/<repo>/` within a minute or two.

Common git commands:

```bash
git init
git add .
git commit -m "Initial site for Bank Tags Helper"
git branch -M main
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

If you prefer automated publishing via GitHub Actions or a `gh-pages` branch, tell me and I can add a workflow.
