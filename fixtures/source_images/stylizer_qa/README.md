# Stylizer QA Source Corpus

The deterministic stylizer QA corpus is generated from project-owned synthetic geometric images in `src/generation/stylizer-qa.ts`.

Run:

```sh
npm run qa:stylizer -- <output-dir>
```

The command writes synthetic source images, generated pet bundles, preview copies, atlas copies, `contact-sheet.png`, `stylizer-qa-report.json`, `manual-scoring-checklist.md`, and `manual-scoring-template.json` into the chosen output directory. Do not replace this corpus with personal photos, external images, prompts, raw provider responses, tokens, or secrets.

Default deterministic stylizer parameter changes require completed manual scoring evidence across crop fit, mask silhouette, color preservation, edge clarity, and pet cuteness. The current default is `bold_edges`; `balanced` remains in the corpus as the legacy baseline. After filling the scoring JSON, check the candidate preset with:

```sh
npm run qa:stylizer:check -- <manual-scoring-template.json> <candidate-preset>
```

Use the change-aware repository gate when checking a diff:

```sh
npm run qa:stylizer:default-gate -- --staged <manual-scoring-template.json> <candidate-preset>
```

For a one-off local source image comparison without creating a pet bundle, run:

```sh
npm run qa:stylizer:compare -- <source-image-path> <output-dir>
```
