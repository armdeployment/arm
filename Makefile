# ARM — common tasks; tool versions are pinned (per repo working agreement).
# Edit pinned versions in one place: PKG_* below.

PNPM_VERSION = 11.17.0
NODE_VERSION = 22			# enforced via package.json engines; corepack supplies pnpm

.PHONY: install dev dev-data-plane test guardrails typecheck lint format-check clean bootstrap

bootstrap:
	@corepack enable pnpm && corepack prepare pnpm@$(PNPM_VERSION) --activate

install:
	pnpm install --frozen-lockfile

dev:
	pnpm dev

dev-data-plane:
	@echo "data-plane docker-compose target lands in 1.2 (spec §9)"
	@exit 1

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
