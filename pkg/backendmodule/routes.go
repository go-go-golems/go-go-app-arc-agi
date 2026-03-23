package backendmodule

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
)

func (m *Module) handleHealth(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}
	if err := m.Health(req.Context()); err != nil {
		writeJSONError(w, http.StatusServiceUnavailable, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"status": "ok"})
}

func (m *Module) handleGames(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}
	games, err := m.client.ListGames(req.Context())
	if err != nil {
		writeArcError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"games": games})
}

func (m *Module) handleGamesSubresource(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}
	gameID := strings.Trim(strings.TrimPrefix(req.URL.Path, "/games/"), "/")
	if gameID == "" {
		http.NotFound(w, req)
		return
	}
	game, err := m.client.GetGame(req.Context(), gameID)
	if err != nil {
		writeArcError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, game)
}

func (m *Module) handleSessions(w http.ResponseWriter, req *http.Request) {
	switch req.Method {
	case http.MethodPost:
		payload, err := decodeOptionalObject(req)
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, "invalid request body")
			return
		}
		sessionID, err := m.client.OpenSession(req.Context(), payload)
		if err != nil {
			writeArcError(w, err)
			return
		}
		m.sessions.Ensure(sessionID)
		m.events.Append(sessionID, "", "arc.session.opened", "Session opened", map[string]any{
			"source_url": payload["source_url"],
		})
		writeJSON(w, http.StatusCreated, map[string]any{
			"session_id": sessionID,
		})
	default:
		writeMethodNotAllowed(w)
	}
}

func (m *Module) handleSessionsSubresource(w http.ResponseWriter, req *http.Request) {
	trimmed := strings.Trim(strings.TrimPrefix(req.URL.Path, "/sessions/"), "/")
	if trimmed == "" {
		http.NotFound(w, req)
		return
	}
	parts := strings.Split(trimmed, "/")
	sessionID := parts[0]
	if sessionID == "" {
		http.NotFound(w, req)
		return
	}

	if len(parts) == 1 {
		switch req.Method {
		case http.MethodGet:
			sessionPayload, err := m.client.GetSession(req.Context(), sessionID)
			if err != nil {
				writeArcError(w, err)
				return
			}
			if sessionPayload == nil {
				sessionPayload = map[string]any{}
			}
			sessionPayload["session_id"] = sessionID
			sessionPayload["status"] = m.sessions.Status(sessionID)
			writeJSON(w, http.StatusOK, sessionPayload)
		case http.MethodDelete:
			sessionPayload, err := m.client.CloseSession(req.Context(), sessionID)
			if err != nil {
				writeArcError(w, err)
				return
			}
			m.sessions.MarkClosed(sessionID)
			m.events.Append(sessionID, "", "arc.session.closed", "Session closed", nil)
			if sessionPayload == nil {
				sessionPayload = map[string]any{}
			}
			sessionPayload["session_id"] = sessionID
			writeJSON(w, http.StatusOK, sessionPayload)
		default:
			writeMethodNotAllowed(w)
		}
		return
	}

	if len(parts) == 2 && parts[1] == "events" && req.Method == http.MethodGet {
		afterSeq, err := parseAfterSeq(req.URL.Query().Get("after_seq"))
		if err != nil {
			writeJSONError(w, http.StatusBadRequest, err.Error())
			return
		}
		events := m.events.ListAfter(sessionID, afterSeq)
		writeJSON(w, http.StatusOK, map[string]any{"session_id": sessionID, "events": events})
		return
	}

	if len(parts) == 2 && parts[1] == "timeline" && req.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, m.events.Timeline(sessionID))
		return
	}

	if len(parts) == 4 && parts[1] == "games" && parts[3] == "reset" && req.Method == http.MethodPost {
		gameID := strings.TrimSpace(parts[2])
		if gameID == "" {
			http.NotFound(w, req)
			return
		}
		m.handleSessionReset(w, req, sessionID, gameID)
		return
	}
	if len(parts) == 4 && parts[1] == "games" && parts[3] == "actions" && req.Method == http.MethodPost {
		gameID := strings.TrimSpace(parts[2])
		if gameID == "" {
			http.NotFound(w, req)
			return
		}
		m.handleSessionAction(w, req, sessionID, gameID)
		return
	}

	http.NotFound(w, req)
}

func parseAfterSeq(raw string) (int64, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(value, 10, 64)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("invalid after_seq query value")
	}
	return n, nil
}

func (m *Module) handleSchemaByID(w http.ResponseWriter, req *http.Request) {
	if req.Method != http.MethodGet {
		writeMethodNotAllowed(w)
		return
	}
	schemaID := strings.Trim(strings.TrimPrefix(req.URL.Path, "/schemas/"), "/")
	if schemaID == "" {
		http.NotFound(w, req)
		return
	}
	schema, ok := getSchemaByID(schemaID)
	if !ok {
		http.NotFound(w, req)
		return
	}
	writeJSON(w, http.StatusOK, schema)
}

func (m *Module) handleSessionReset(w http.ResponseWriter, req *http.Request, sessionID, gameID string) {
	frame, err := m.client.Reset(req.Context(), sessionID, gameID)
	if err != nil {
		writeArcError(w, err)
		return
	}
	frame = normalizeFrameEnvelope(frame, sessionID, gameID, "")
	if guid := strings.TrimSpace(asString(frame["guid"])); guid != "" {
		m.sessions.UpsertGUID(sessionID, gameID, guid)
	}
	m.events.Append(sessionID, gameID, "arc.game.reset", fmt.Sprintf("Game %s reset", gameID), nil)
	writeJSON(w, http.StatusOK, frame)
}

type sessionActionRequest struct {
	Action    string         `json:"action"`
	Data      map[string]any `json:"data"`
	Reasoning any            `json:"reasoning,omitempty"`
}

func (m *Module) handleSessionAction(w http.ResponseWriter, req *http.Request, sessionID, gameID string) {
	var actionReq sessionActionRequest
	decoder := json.NewDecoder(req.Body)
	if err := decoder.Decode(&actionReq); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	action := normalizeActionName(actionReq.Action)
	if !isSupportedAction(action) {
		writeJSONError(w, http.StatusBadRequest, "action must be one of ACTION1..ACTION7")
		return
	}
	payload := cloneMap(actionReq.Data)
	if payload == nil {
		payload = map[string]any{}
	}
	guid, hasGUID := m.sessions.LookupGUID(sessionID, gameID)
	if hasGUID && strings.TrimSpace(guid) != "" {
		payload["guid"] = guid
	}
	if !hasGUID || strings.TrimSpace(guid) == "" {
		writeJSONError(w, http.StatusBadRequest, "missing game guid for session/game; call reset first")
		return
	}
	if actionReq.Reasoning != nil {
		payload["reasoning"] = actionReq.Reasoning
	}

	m.events.Append(sessionID, gameID, "arc.action.requested", action, map[string]any{"action": action})
	frame, err := m.client.Action(req.Context(), sessionID, gameID, action, payload)
	if err != nil {
		m.events.Append(sessionID, gameID, "arc.action.failed", action, map[string]any{"action": action, "error": err.Error()})
		writeArcError(w, err)
		return
	}
	frame = normalizeFrameEnvelope(frame, sessionID, gameID, action)
	if newGUID := strings.TrimSpace(asString(frame["guid"])); newGUID != "" {
		m.sessions.UpsertGUID(sessionID, gameID, newGUID)
	}
	m.events.Append(sessionID, gameID, "arc.action.completed", action, map[string]any{"action": action})
	writeJSON(w, http.StatusOK, frame)
}

func normalizeFrameEnvelope(frame map[string]any, sessionID, gameID, action string) map[string]any {
	out := cloneMap(frame)
	if out == nil {
		out = map[string]any{}
	}
	out["session_id"] = strings.TrimSpace(sessionID)
	out["game_id"] = strings.TrimSpace(gameID)
	out["guid"] = strings.TrimSpace(asString(out["guid"]))
	out["state"] = normalizeGameState(out["state"])
	out["levels_completed"] = coerceInt(out["levels_completed"])
	out["win_levels"] = normalizeIntSlice(out["win_levels"])
	out["available_actions"] = normalizeStringSlice(out["available_actions"])
	out["frame"] = normalizeFrameGrid(out["frame"])
	if strings.TrimSpace(action) != "" {
		out["action"] = strings.TrimSpace(action)
	}
	return out
}

func normalizeGameState(value any) string {
	state := strings.ToUpper(strings.TrimSpace(asString(value)))
	if state == "" {
		switch coerceInt(value) {
		case 1:
			return "RUNNING"
		case 2:
			return "WON"
		case 3:
			return "LOST"
		case 0:
			return "IDLE"
		}
	}
	switch state {
	case "RUNNING", "ACTIVE", "PLAYING", "IN_PROGRESS":
		return "RUNNING"
	case "NOT_FINISHED":
		return "RUNNING"
	case "WON", "WIN", "COMPLETED", "SUCCESS":
		return "WON"
	case "LOST", "LOSS", "FAILED", "FAILURE", "DONE":
		return "LOST"
	case "IDLE", "READY", "NOT_STARTED":
		return "IDLE"
	default:
		return "IDLE"
	}
}

func normalizeStringSlice(value any) []string {
	items, ok := value.([]any)
	if !ok {
		if typed, ok := value.([]string); ok {
			ret := make([]string, 0, len(typed))
			for _, item := range typed {
				if action, ok := normalizeActionToken(item); ok {
					ret = append(ret, action)
				}
			}
			return ret
		}
		return []string{}
	}
	ret := make([]string, 0, len(items))
	for _, item := range items {
		if action, ok := normalizeActionToken(item); ok {
			ret = append(ret, action)
		}
	}
	return ret
}

func normalizeActionToken(value any) (string, bool) {
	switch v := value.(type) {
	case string:
		action := normalizeActionName(v)
		if isSupportedAction(action) {
			return action, true
		}
	case map[string]any:
		if action, ok := normalizeActionToken(v["id"]); ok {
			return action, true
		}
	case float64:
		action := normalizeActionName(strconv.Itoa(int(v)))
		if isSupportedAction(action) {
			return action, true
		}
	case int:
		action := normalizeActionName(strconv.Itoa(v))
		if isSupportedAction(action) {
			return action, true
		}
	case int64:
		action := normalizeActionName(strconv.FormatInt(v, 10))
		if isSupportedAction(action) {
			return action, true
		}
	case json.Number:
		if i, err := v.Int64(); err == nil {
			action := normalizeActionName(strconv.FormatInt(i, 10))
			if isSupportedAction(action) {
				return action, true
			}
		}
	}
	return "", false
}

func isSupportedAction(action string) bool {
	switch strings.TrimSpace(action) {
	case "ACTION1", "ACTION2", "ACTION3", "ACTION4", "ACTION5", "ACTION6", "ACTION7":
		return true
	default:
		return false
	}
}

func normalizeIntSlice(value any) []int {
	items, ok := value.([]any)
	if !ok {
		if typed, ok := value.([]int); ok {
			return append([]int(nil), typed...)
		}
		if typed, ok := value.([]float64); ok {
			ret := make([]int, 0, len(typed))
			for _, item := range typed {
				ret = append(ret, int(item))
			}
			return ret
		}
		return []int{}
	}
	ret := make([]int, 0, len(items))
	for _, item := range items {
		ret = append(ret, coerceInt(item))
	}
	return ret
}

func normalizeFrameGrid(value any) [][]int {
	if matrix, ok := value.([][]int); ok {
		out := make([][]int, 0, len(matrix))
		for _, row := range matrix {
			out = append(out, append([]int(nil), row...))
		}
		return out
	}

	rows, ok := value.([]any)
	if !ok {
		return [][]int{}
	}

	// ARC runtime commonly returns 3D frame payloads with one plane:
	// frame[plane][row][col]. Collapse to the first matrix plane.
	if len(rows) > 0 {
		if planeRows, ok := rows[0].([]any); ok && len(planeRows) > 0 {
			if _, nested := planeRows[0].([]any); nested {
				rows = planeRows
			}
		}
	}

	ret := make([][]int, 0, len(rows))
	for _, rowValue := range rows {
		cells, ok := rowValue.([]any)
		if !ok {
			if typed, ok := rowValue.([]int); ok {
				ret = append(ret, append([]int(nil), typed...))
				continue
			}
			ret = append(ret, []int{})
			continue
		}
		row := make([]int, 0, len(cells))
		for _, cell := range cells {
			row = append(row, coerceInt(cell))
		}
		ret = append(ret, row)
	}
	return ret
}

func coerceInt(value any) int {
	switch v := value.(type) {
	case int:
		return v
	case int8:
		return int(v)
	case int16:
		return int(v)
	case int32:
		return int(v)
	case int64:
		return clampInt64ToInt(v)
	case uint:
		return clampUint64ToInt(uint64(v))
	case uint8:
		return int(v)
	case uint16:
		return int(v)
	case uint32:
		return int(v)
	case uint64:
		return clampUint64ToInt(v)
	case float32:
		return clampFloat64ToInt(float64(v))
	case float64:
		return clampFloat64ToInt(v)
	case json.Number:
		i, err := v.Int64()
		if err == nil {
			return clampInt64ToInt(i)
		}
		f, err := v.Float64()
		if err == nil {
			return clampFloat64ToInt(f)
		}
	}
	return 0
}

const (
	maxIntValue = int(^uint(0) >> 1)
	minIntValue = -maxIntValue - 1
)

func clampInt64ToInt(v int64) int {
	if v > int64(maxIntValue) {
		return maxIntValue
	}
	if v < int64(minIntValue) {
		return minIntValue
	}
	return int(v)
}

func clampUint64ToInt(v uint64) int {
	if v > uint64(maxIntValue) {
		return maxIntValue
	}
	return int(v)
}

func clampFloat64ToInt(v float64) int {
	if math.IsNaN(v) {
		return 0
	}
	if v > float64(maxIntValue) || math.IsInf(v, 1) {
		return maxIntValue
	}
	if v < float64(minIntValue) || math.IsInf(v, -1) {
		return minIntValue
	}
	return int(v)
}

func asString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case json.Number:
		return v.String()
	default:
		return ""
	}
}

func decodeOptionalObject(req *http.Request) (map[string]any, error) {
	if req == nil || req.Body == nil {
		return map[string]any{}, nil
	}
	var payload map[string]any
	decoder := json.NewDecoder(req.Body)
	if err := decoder.Decode(&payload); err != nil {
		if errors.Is(err, io.EOF) {
			return map[string]any{}, nil
		}
		return nil, err
	}
	if payload == nil {
		payload = map[string]any{}
	}
	return payload, nil
}

func writeArcError(w http.ResponseWriter, err error) {
	var apiErr *ArcAPIError
	if errors.As(err, &apiErr) {
		writeJSONError(w, apiErr.StatusCode, apiErr.Error())
		return
	}
	writeJSONError(w, http.StatusBadGateway, err.Error())
}

func writeMethodNotAllowed(w http.ResponseWriter) {
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]any{
			"message": strings.TrimSpace(message),
		},
	})
}
