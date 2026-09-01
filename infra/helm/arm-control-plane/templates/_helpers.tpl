{{- define "arm-control-plane.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Truncated to leave room for the per-component suffixes callers append. */}}
{{- define "arm-control-plane.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 50 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 50 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 50 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "arm-control-plane.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "arm-control-plane.labels" -}}
helm.sh/chart: {{ include "arm-control-plane.chart" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: arm-control-plane
{{- end -}}

{{/*
Selector labels. Minimal on purpose — a Deployment's selector is immutable,
so adding a label here breaks every upgrade.
  {{- include "arm-control-plane.selectorLabels" (dict "ctx" . "component" "web") }}
*/}}
{{- define "arm-control-plane.selectorLabels" -}}
app.kubernetes.io/name: arm-{{ .component }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
{{- end -}}

{{- define "arm-control-plane.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "arm-control-plane.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Database environment, from a Secret this chart never holds.

`required` rather than a silent empty string: an app that starts with no
DATABASE_URL under fixtureMode=false reports healthy and then throws on its
first query, which is a much worse way to find out.
*/}}
{{- define "arm-control-plane.databaseEnv" -}}
{{- if not .Values.fixtureMode }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ required "database.secretName is required when fixtureMode=false — create the Secret first, this chart never holds credentials" .Values.database.secretName }}
      key: {{ .Values.database.postgresUrlKey }}
- name: CLICKHOUSE_URL
  valueFrom:
    secretKeyRef:
      name: {{ required "database.secretName is required when fixtureMode=false" .Values.database.secretName }}
      key: {{ .Values.database.clickhouseUrlKey }}
{{- end }}
{{- end -}}

{{/*
Everything both apps read: data mode, identity, and the two shared secrets.
Kept in one place so the dashboard and the onboarding app cannot drift into
disagreeing about which tenant they serve or which token they trust.
*/}}
{{- define "arm-control-plane.appEnv" -}}
- name: ARM_FIXTURE_MODE
  value: {{ if .Values.fixtureMode }}"1"{{ else }}"0"{{ end }}
{{- if .Values.demoMode }}
- name: ARM_DEMO
  value: "1"
{{- end }}
{{- include "arm-control-plane.databaseEnv" . }}
{{- with .Values.oidc.issuerUrl }}
- name: ARM_OIDC_ISSUER_URL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.oidc.jwksUrl }}
- name: ARM_OIDC_JWKS_URL
  value: {{ . | quote }}
{{- end }}
{{- with .Values.oidc.audience }}
- name: ARM_OIDC_AUDIENCE
  value: {{ . | quote }}
{{- end }}
{{- with .Values.oidc.tenantId }}
- name: ARM_OIDC_TENANT_ID
  value: {{ . | quote }}
{{- end }}
{{- with .Values.oidc.tenantClaim }}
- name: ARM_OIDC_TENANT_CLAIM
  value: {{ . | quote }}
{{- end }}
{{- with .Values.oidc.emailClaim }}
- name: ARM_OIDC_EMAIL_CLAIM
  value: {{ . | quote }}
{{- end }}
{{- with .Values.oidc.groupsClaim }}
- name: ARM_OIDC_GROUPS_CLAIM
  value: {{ . | quote }}
{{- end }}
{{- if .Values.oidc.allowDevIdentity }}
- name: ARM_ALLOW_DEV_IDENTITY
  value: "1"
{{- end }}
{{- if .Values.secrets.setupToken.secretName }}
- name: ARM_SETUP_TOKEN_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.setupToken.secretName }}
      key: {{ .Values.secrets.setupToken.key }}
{{- end }}
{{- if .Values.secrets.ingestToken.secretName }}
- name: ARM_INGEST_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ .Values.secrets.ingestToken.secretName }}
      key: {{ .Values.secrets.ingestToken.key }}
{{- end }}
{{- end -}}
