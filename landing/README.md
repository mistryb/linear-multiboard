# Linear MultiBoard — marketing landing page

A single, self-contained static page (`index.html`) that markets the
[Linear MultiBoard](https://github.com/mistryb/linear-multiboard) open-source
project. No build step, no framework, no dependencies — just HTML + inline CSS
and a couple of SVGs.

```
landing/
  index.html     the whole page (inline CSS, no JS needed)
  favicon.svg    browser tab icon
  og.svg         social share image (Open Graph / Twitter card)
  amplify.yml    AWS Amplify Hosting build spec (no-op build, static artifacts)
```

## Preview locally

Just open the file — or serve the folder so relative asset paths resolve:

```bash
cd landing
python3 -m http.server 8080   # then open http://localhost:8080
```

## Deploy to AWS Amplify Hosting

1. Push this repo to GitHub (already at `mistryb/linear-multiboard`).
2. In the [Amplify console](https://console.aws.amazon.com/amplify/), choose
   **Create new app → Deploy from GitHub** and pick this repository/branch.
3. When Amplify detects the repo, set the **app root / monorepo directory** to
   `landing`. It will pick up `landing/amplify.yml`, which does a no-op build and
   publishes the folder as static files.
4. Save & deploy. Amplify gives you a URL and free HTTPS.

### Custom domain (`linearmultiboard.bhavikmistry.com`)

In Amplify go to **Hosting → Custom domains → Add domain**, enter
`bhavikmistry.com`, and map the subdomain `linearmultiboard` to this app's
branch. Amplify issues the TLS cert and prints the DNS records to create.

Since `bhavikmistry.com` is in **Route 53**, add those records to its hosted
zone: typically a `CNAME` (or an **A / ALIAS**) for `linearmultiboard` pointing
at the Amplify target, plus the validation `CNAME` Amplify asks for. Once the
records propagate, the site is live at
**https://linearmultiboard.bhavikmistry.com**.

> Prefer another static host? Because it's plain files, you can also drag the
> `landing/` folder into Netlify Drop, run `npx vercel landing`, or push it to
> GitHub Pages / Cloudflare Pages — no configuration required.

## Editing

Everything lives in `index.html`. The GitHub link (`mistryb/linear-multiboard`)
appears in the nav, hero, and footer — update those if the repo moves. Colors
mirror the app's own palette (`--accent: #5e6ad2`, Linear purple) so the page
and product feel like one thing.
