{{/*
Naming and labels.

This file did not exist, which is why the chart rendered nothing at all rather
than the single Deployment it appeared to contain: deployment-proxy.yaml called
`arm-data-plane.fullname` and `arm-data-plane.labels`, and `helm template`
failed on the first line that referenced one.
*/}}

{{- define "arm-data-plane.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/*
Fully qualified name. Truncated to 63 chars for the DNS label limit; note the
per-component suffixes ("-proxy", "-gateway") are appended by callers, so leave
headroom rather than filling all 63 here.
*/}}
{{- define "arm-data-plane.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 55 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 55 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 55 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "arm-data-plane.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{/* Common labels — on every object. */}}
{{- define "arm-data-plane.labels" -}}
helm.sh/chart: {{ include "arm-data-plane.chart" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: arm-data-plane
{{- end -}}

{{/*
Selector labels for one component. Call as:
  {{- include "arm-data-plane.selectorLabels" (dict "ctx" . "component" "proxy") }}

Selectors are immutable on a Deployment, so these are deliberately minimal —
adding a label here on an upgrade makes the upgrade fail.
*/}}
{{- define "arm-data-plane.selectorLabels" -}}
app.kubernetes.io/name: arm-{{ .component }}
app.kubernetes.io/instance: {{ .ctx.Release.Name }}
{{- end -}}

{{- define "arm-data-plane.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "arm-data-plane.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{/*
Environment every data-plane container needs to reach the control plane.
`required` is used rather than a silent empty string: a proxy that starts with
CONTROL_PLANE_URL="" reports healthy and meters nothing, which is the worst
possible failure for a metering boundary.
*/}}
{{- define "arm-data-plane.controlPlaneEnv" -}}
- name: CONTROL_PLANE_URL
  value: {{ required "controlPlane.url is required — the data plane cannot meter without it" .Values.controlPlane.url | quote }}
- name: TENANT_ID
  value: {{ required "controlPlane.tenantId is required — every event is tenant-scoped (Invariant 6)" .Values.controlPlane.tenantId | quote }}
{{- end -}}
