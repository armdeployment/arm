/**
 * OCI registry StorageBackend — STUB, out of scope (guide 01 §2.1, §10).
 *
 * Every method throws `NotImplementedError`. This exists only so `kind: "oci"`
 * is a valid, type-checked `StorageBackend`/`storageBackendEnum` value end to
 * end (the DB enum already has it — `packages/db/src/schema/enums.ts`) without
 * a real backend being buildable yet. Do not build this — see guide 01 §10
 * "Out of scope".
 */

import type { StorageBackend } from "./backend.js";
import { NotImplementedError } from "./backend.js";

export class OciStorageBackend implements StorageBackend {
  readonly kind = "oci" as const;

  async put(_digest: string, _body: Uint8Array, _mediaType: string): Promise<void> {
    throw new NotImplementedError("oci", "put");
  }

  async get(_digest: string): Promise<Uint8Array> {
    throw new NotImplementedError("oci", "get");
  }

  async head(_digest: string): Promise<{ size: number; mediaType: string } | null> {
    throw new NotImplementedError("oci", "head");
  }

  async presignGet(_digest: string, _ttlSeconds: number): Promise<string> {
    throw new NotImplementedError("oci", "presignGet");
  }
}
