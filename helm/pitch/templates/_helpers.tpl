{{/*
Expand the name of the chart.
*/}}
{{- define "pitch.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "pitch.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "pitch.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "pitch.labels" -}}
helm.sh/chart: {{ include "pitch.chart" . }}
{{ include "pitch.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "pitch.selectorLabels" -}}
app.kubernetes.io/name: {{ include "pitch.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Service-specific labels
*/}}
{{- define "pitch.serviceLabels" -}}
{{- $serviceName := .serviceName -}}
app.kubernetes.io/name: {{ include "pitch.name" .context }}
app.kubernetes.io/instance: {{ .context.Release.Name }}
app.kubernetes.io/component: {{ $serviceName }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "pitch.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "pitch.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Docker image name
*/}}
{{- define "pitch.image" -}}
{{- $registry := .Values.image.registry -}}
{{- $repository := .Values.image.repository -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion -}}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}

{{/*
Database connection strings
*/}}
{{- define "pitch.postgresql.user.connectionString" -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "pitch.fullname" . }}-postgres-user:5432/{{ .Values.postgresql.user.database }}
{{- end }}

{{- define "pitch.postgresql.simulation.connectionString" -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "pitch.fullname" . }}-postgres-simulation:5432/{{ .Values.postgresql.simulation.database }}
{{- end }}

{{- define "pitch.postgresql.support.connectionString" -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "pitch.fullname" . }}-postgres-support:5432/{{ .Values.postgresql.support.database }}
{{- end }}

{{- define "pitch.postgresql.analytics.connectionString" -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "pitch.fullname" . }}-postgres-analytics:5432/{{ .Values.postgresql.analytics.database }}
{{- end }}

{{- define "pitch.postgresql.lti.connectionString" -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "pitch.fullname" . }}-postgres-lti:5432/{{ .Values.postgresql.lti.database }}
{{- end }}

{{- define "pitch.postgresql.s3.connectionString" -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "pitch.fullname" . }}-postgres-s3:5432/{{ .Values.postgresql.s3.database }}
{{- end }}

{{/*
MongoDB connection string
*/}}
{{- define "pitch.mongodb.connectionString" -}}
mongodb://{{ .Values.mongodb.auth.rootUser }}:{{ .Values.mongodb.auth.rootPassword }}@{{ include "pitch.fullname" . }}-mongodb:27017/{{ .Values.mongodb.auth.database }}?authSource=admin
{{- end }}

{{/*
Redis connection string
*/}}
{{- define "pitch.redis.connectionString" -}}
redis://{{ include "pitch.fullname" . }}-redis:6379
{{- end }}

{{/*
RabbitMQ connection string
*/}}
{{- define "pitch.rabbitmq.connectionString" -}}
amqp://{{ .Values.rabbitmq.auth.username }}:{{ .Values.rabbitmq.auth.password }}@{{ include "pitch.fullname" . }}-rabbitmq:5672/{{ .Values.rabbitmq.auth.vhost }}
{{- end }}
