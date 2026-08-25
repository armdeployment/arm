# Remotion video

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

Welcome to your Remotion project!

## Commands

**Install Dependencies**

```console
npm i
```

**Start Preview**

```console
npm run dev
```

**Render video**

```console
npx remotion render
```

If bundling crashes with `Cannot read properties of undefined (reading 'readFile')`
inside `esbuild-loader`, it's a pnpm hoisting ambiguity — this monorepo has three
coexisting `typescript` majors (5.9.3 here, 7.0.2 in `apps/public`/`apps/control-plane/web`/
`apps/onboarding`), and `require('typescript')` from deep inside the pnpm store
occasionally resolves to the wrong one, which lacks `ts.sys`. Work around it without
touching the shared dependency graph:

```console
NODE_OPTIONS="--require $(pwd)/fix-ts-resolution.cjs" npx remotion render <id> <out>
```

**Upgrade Remotion**

```console
npx remotion upgrade
```

## Docs

Get started with Remotion by reading the [fundamentals page](https://www.remotion.dev/docs/the-fundamentals).

## Help

We provide help on our [Discord server](https://discord.gg/6VzzNDwUwV).

## Issues

Found an issue with Remotion? [File an issue here](https://github.com/remotion-dev/remotion/issues/new).

## License

Note that for some entities a company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
