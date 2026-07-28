/**
 * ARM Data-Plane Connectors (spec §6.2, §9 1.3–1.4).
 *
 * Strategy: mint (S3, GCS, SharePoint), proxy (DB), mint+sync (SharePoint/OneDrive).
 * All connectors emit access_audit_event records and enforce classification gates.
 */

export { mintS3Credential, validateS3Access, type S3ScopeRequest, type S3Credential } from "./s3.js";
export { mintGCSCredential, type GCSScopeRequest, type GCSCredential } from "./gcs.js";
export { proxyDBQuery, type DBQueryRequest, type DBQueryResult, type DBType } from "./db.js";
export {
  mintSharePointToken,
  syncSharePointPermissions,
  type SharePointScopeRequest,
  type SharePointToken,
  type PermissionSyncResult,
} from "./sharepoint.js";
