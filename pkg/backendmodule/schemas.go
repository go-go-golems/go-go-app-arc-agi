package backendmodule

var schemaDocuments = map[string]map[string]any{
	"arc.health.response.v1": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"type":    "object",
		"properties": map[string]any{
			"status": map[string]any{"type": "string"},
		},
		"required":             []any{"status"},
		"additionalProperties": true,
	},
	"arc.games.list.response.v1": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"type":    "object",
		"properties": map[string]any{
			"games": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "object"},
			},
		},
		"required":             []any{"games"},
		"additionalProperties": true,
	},
	"arc.games.get.response.v1": {
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"type":                 "object",
		"additionalProperties": true,
	},
	"arc.sessions.open.request.v1": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"type":    "object",
		"properties": map[string]any{
			"source_url": map[string]any{"type": "string"},
			"tags": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "string"},
			},
			"opaque": map[string]any{"type": "object"},
		},
		"additionalProperties": true,
	},
	"arc.sessions.open.response.v1": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"type":    "object",
		"properties": map[string]any{
			"session_id": map[string]any{"type": "string"},
		},
		"required":             []any{"session_id"},
		"additionalProperties": true,
	},
	"arc.sessions.get.response.v1": {
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"type":                 "object",
		"additionalProperties": true,
	},
	"arc.sessions.close.response.v1": {
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"type":                 "object",
		"additionalProperties": true,
	},
	"arc.games.reset.response.v1": {
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"type":                 "object",
		"additionalProperties": true,
	},
	"arc.games.action.request.v1": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"type":    "object",
		"properties": map[string]any{
			"action": map[string]any{"type": "string"},
			"data":   map[string]any{"type": "object"},
		},
		"required":             []any{"action"},
		"additionalProperties": true,
	},
	"arc.games.action.response.v1": {
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"type":                 "object",
		"additionalProperties": true,
	},
	"arc.sessions.events.response.v1": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"type":    "object",
		"properties": map[string]any{
			"session_id": map[string]any{"type": "string"},
			"events": map[string]any{
				"type":  "array",
				"items": map[string]any{"type": "object"},
			},
		},
		"required":             []any{"session_id", "events"},
		"additionalProperties": true,
	},
	"arc.sessions.timeline.response.v1": {
		"$schema":              "https://json-schema.org/draft/2020-12/schema",
		"type":                 "object",
		"additionalProperties": true,
	},
	"arc.error.v1": {
		"$schema": "https://json-schema.org/draft/2020-12/schema",
		"type":    "object",
		"properties": map[string]any{
			"error": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"message": map[string]any{"type": "string"},
				},
				"required":             []any{"message"},
				"additionalProperties": true,
			},
		},
		"required":             []any{"error"},
		"additionalProperties": true,
	},
}

func getSchemaByID(schemaID string) (map[string]any, bool) {
	doc, ok := schemaDocuments[schemaID]
	if !ok {
		return nil, false
	}
	return doc, true
}
