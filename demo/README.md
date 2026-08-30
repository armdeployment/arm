# Demo videos

| File | What it shows |
|---|---|
| `arm-full-demo.mp4` | **The complete system**, end to end: what ARM is and why it splits into two planes, then three acts — an employee installing an agent with no terminal, a manager reading adoption/spend/approvals, and the server-side library. Linked from the root README. |
| `arm-video-1-tagged.mp4` | D7 work-type classification — the zero-LLM classifier cascade tagging real traffic. |
| `profiles/` | Screenshots of the provisioning wizard and org trees per industry profile, referenced by `docs/guides/04-public-site-demo.md`. |

Two further videos are served by the marketing site rather than stored here,
to avoid keeping two copies of the same bytes:
`apps/public/public/video/arm-enterprise-simulation.mp4` and
`apps/public/public/video/arm-video-2-structures.mp4`.

## Regenerating

All videos are Remotion compositions in `apps/arm-video`. The screenshots
they use are real captures from a live run — never mockups. To re-render:

```bash
cd apps/arm-video
npx remotion render ArmVideo7-FullSystem out/arm-full-demo.mp4
```

If bundling fails with `Cannot read properties of undefined (reading 'readFile')`,
see the pnpm-hoisting workaround in `apps/arm-video/README.md`.
