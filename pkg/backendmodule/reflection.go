package backendmodule

import "net/http"

func (m *Module) buildReflectionDocument() *ReflectionDocument {
	basePath := "/api/apps/" + AppID
	return &ReflectionDocument{
		AppID:   AppID,
		Name:    "ARC-AGI",
		Version: "v1",
		Summary: "ARC gameplay module with Go runtime lifecycle and proxied endpoints",
		Capabilities: []ReflectionCapability{
			{ID: "games", Stability: "beta", Description: "List and inspect games"},
			{ID: "sessions", Stability: "beta", Description: "Open, inspect, and close ARC sessions"},
			{ID: "actions", Stability: "beta", Description: "Reset and act on a game session"},
			{ID: "timeline", Stability: "beta", Description: "Structured session events and timeline projection"},
			{ID: "reflection", Stability: "stable", Description: "Discover APIs and schemas"},
		},
		Docs: []ReflectionDocLink{
			{
				ID:          "arc-module-architecture",
				Title:       "ARC-AGI backend module architecture guide",
				Path:        "go-go-gepa/ttmp/2026/02/27/GEPA-12-ARC-AGI-OS-BACKEND-MODULE--arc-agi-backend-module-integration-for-go-go-os-and-wesen-os/design-doc/01-arc-agi-backend-module-architecture-and-implementation-guide.md",
				Description: "Intern onboarding and implementation design reference",
			},
		},
		APIs: []ReflectionAPI{
			{ID: "health", Method: http.MethodGet, Path: basePath + "/health", ResponseSchema: "arc.health.response.v1"},
			{ID: "games-list", Method: http.MethodGet, Path: basePath + "/games", ResponseSchema: "arc.games.list.response.v1"},
			{ID: "games-get", Method: http.MethodGet, Path: basePath + "/games/{game_id}", ResponseSchema: "arc.games.get.response.v1"},
			{ID: "sessions-open", Method: http.MethodPost, Path: basePath + "/sessions", RequestSchema: "arc.sessions.open.request.v1", ResponseSchema: "arc.sessions.open.response.v1"},
			{ID: "sessions-get", Method: http.MethodGet, Path: basePath + "/sessions/{session_id}", ResponseSchema: "arc.sessions.get.response.v1"},
			{ID: "sessions-close", Method: http.MethodDelete, Path: basePath + "/sessions/{session_id}", ResponseSchema: "arc.sessions.close.response.v1"},
			{ID: "sessions-reset", Method: http.MethodPost, Path: basePath + "/sessions/{session_id}/games/{game_id}/reset", ResponseSchema: "arc.games.reset.response.v1"},
			{ID: "sessions-action", Method: http.MethodPost, Path: basePath + "/sessions/{session_id}/games/{game_id}/actions", RequestSchema: "arc.games.action.request.v1", ResponseSchema: "arc.games.action.response.v1"},
			{ID: "sessions-events", Method: http.MethodGet, Path: basePath + "/sessions/{session_id}/events", ResponseSchema: "arc.sessions.events.response.v1"},
			{ID: "sessions-timeline", Method: http.MethodGet, Path: basePath + "/sessions/{session_id}/timeline", ResponseSchema: "arc.sessions.timeline.response.v1"},
			{ID: "schema-get", Method: http.MethodGet, Path: basePath + "/schemas/{schema_id}", ResponseSchema: "json-schema"},
		},
		Schemas: []ReflectionSchemaRef{
			{ID: "arc.health.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.health.response.v1"},
			{ID: "arc.games.list.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.games.list.response.v1"},
			{ID: "arc.games.get.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.games.get.response.v1"},
			{ID: "arc.sessions.open.request.v1", Format: "json-schema", URI: basePath + "/schemas/arc.sessions.open.request.v1"},
			{ID: "arc.sessions.open.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.sessions.open.response.v1"},
			{ID: "arc.sessions.get.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.sessions.get.response.v1"},
			{ID: "arc.sessions.close.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.sessions.close.response.v1"},
			{ID: "arc.games.reset.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.games.reset.response.v1"},
			{ID: "arc.games.action.request.v1", Format: "json-schema", URI: basePath + "/schemas/arc.games.action.request.v1"},
			{ID: "arc.games.action.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.games.action.response.v1"},
			{ID: "arc.sessions.events.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.sessions.events.response.v1"},
			{ID: "arc.sessions.timeline.response.v1", Format: "json-schema", URI: basePath + "/schemas/arc.sessions.timeline.response.v1"},
			{ID: "arc.error.v1", Format: "json-schema", URI: basePath + "/schemas/arc.error.v1"},
		},
	}
}
