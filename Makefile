# ARM — common tasks; tool versions are pinned (per repo working agreement).
# Edit pinned versions in one place: PKG_* below.

PNPM_VERSION = 11.17.0
NODE_VERSION = 22			# enforced via package.json engines; corepack supplies pnpm

.PHONY: install dev dev-data-plane mock-idp test guardrails typecheck lint format-check clean bootstrap

bootstrap:
	@corepack enable pnpm && corepack prepare pnpm@$(PNPM_VERSION) --activate

install:
	pnpm install --frozen-lockfile

dev: ## Start control-plane web in production mode (fixes Turbopack dev hang)
	pnpm dev

dev-data-plane: ## Start the data-plane services: proxy (8787) + artifact cache (8788)
	pnpm --parallel --filter @arm-app/proxy --filter @arm-app/artifact-cache run dev

mock-idp: ## Local OIDC issuer (9999) for testing SSO without an IdP tenant — docs/sso-setup.md
	pnpm --filter @arm/auth mock-idp

test:
	pnpm test

guardrails:
	@pnpm guardrails

typecheck:
	pnpm typecheck

lint:
	pnpm lint

format-check:
	pnpm format:check

clean:
	rm -rf node_modules apps/*/*/node_modules packages/*/node_modules packages/*/dist apps/*/*/.next .turbo
