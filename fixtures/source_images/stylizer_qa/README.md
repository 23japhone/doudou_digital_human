# Stylizer QA Source Corpus

The deterministic stylizer QA corpus is generated from project-owned synthetic geometric images in `src/generation/stylizer-qa.ts`.

Run:

```sh
npm run qa:stylizer -- <output-dir>
```

The command writes synthetic source images, generated pet bundles, preview copies, atlas copies, `contact-sheet.png`, and `stylizer-qa-report.json` into the chosen output directory. Do not replace this corpus with personal photos, external images, prompts, raw provider responses, tokens, or secrets.
