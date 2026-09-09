# REPVIS2 interactive supplementary site

This folder is a self-contained static site for GitHub Pages. It has no build step and no external dependencies.

## Publish with the GitHub website

1. Create a new public repository on GitHub.
2. Use **Add file → Upload files** and upload the contents of this folder (not the enclosing folder).
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**, then select `main` and `/ (root)`.
5. Save. GitHub will show the public address after deployment completes.

The entry file must remain `index.html`. Keep `app.js`, `styles.css`, `data/`, and `assets/` in the same relative locations.

To preview locally, run a simple web server in this folder and open its local address. Opening `index.html` directly also shows the interactive figure, although some browsers restrict embedded local PDFs.
