package backendmodule

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type ArcAPIClient interface {
	Health(ctx context.Context) error
	ListGames(ctx context.Context) ([]map[string]any, error)
	GetGame(ctx context.Context, gameID string) (map[string]any, error)
	OpenSession(ctx context.Context, payload map[string]any) (string, error)
	GetSession(ctx context.Context, sessionID string) (map[string]any, error)
	CloseSession(ctx context.Context, sessionID string) (map[string]any, error)
	Reset(ctx context.Context, sessionID, gameID string) (map[string]any, error)
	Action(ctx context.Context, sessionID, gameID, action string, payload map[string]any) (map[string]any, error)
}

type HTTPArcAPIClient struct {
	driver  ArcRuntimeDriver
	client  *http.Client
	apiKey  string
	baseURL func() string
}

func NewHTTPArcAPIClient(driver ArcRuntimeDriver, timeout time.Duration, apiKey string) *HTTPArcAPIClient {
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &HTTPArcAPIClient{
		driver: driver,
		client: &http.Client{Timeout: timeout},
		apiKey: strings.TrimSpace(apiKey),
		baseURL: func() string {
			return strings.TrimRight(strings.TrimSpace(driver.BaseURL()), "/")
		},
	}
}

func (c *HTTPArcAPIClient) Health(ctx context.Context) error {
	return c.driver.Health(ctx)
}

func (c *HTTPArcAPIClient) ListGames(ctx context.Context) ([]map[string]any, error) {
	var payload []map[string]any
	if err := c.requestJSON(ctx, http.MethodGet, "/api/games", nil, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (c *HTTPArcAPIClient) GetGame(ctx context.Context, gameID string) (map[string]any, error) {
	var payload map[string]any
	escaped := url.PathEscape(strings.TrimSpace(gameID))
	if err := c.requestJSON(ctx, http.MethodGet, "/api/games/"+escaped, nil, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (c *HTTPArcAPIClient) OpenSession(ctx context.Context, payload map[string]any) (string, error) {
	var response map[string]any
	if err := c.requestJSON(ctx, http.MethodPost, "/api/scorecard/open", payload, &response); err != nil {
		return "", err
	}
	cardID, _ := response["card_id"].(string)
	cardID = strings.TrimSpace(cardID)
	if cardID == "" {
		return "", fmt.Errorf("arc api did not return card_id")
	}
	return cardID, nil
}

func (c *HTTPArcAPIClient) GetSession(ctx context.Context, sessionID string) (map[string]any, error) {
	var payload map[string]any
	escaped := url.PathEscape(strings.TrimSpace(sessionID))
	if err := c.requestJSON(ctx, http.MethodGet, "/api/scorecard/"+escaped, nil, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (c *HTTPArcAPIClient) CloseSession(ctx context.Context, sessionID string) (map[string]any, error) {
	var payload map[string]any
	body := map[string]any{"card_id": strings.TrimSpace(sessionID)}
	if err := c.requestJSON(ctx, http.MethodPost, "/api/scorecard/close", body, &payload); err != nil {
		return nil, err
	}
	return payload, nil
}

func (c *HTTPArcAPIClient) Reset(ctx context.Context, sessionID, gameID string) (map[string]any, error) {
	body := map[string]any{
		"game_id": strings.TrimSpace(gameID),
		"card_id": strings.TrimSpace(sessionID),
	}
	var payload map[string]any
	if err := c.requestJSON(ctx, http.MethodPost, "/api/cmd/RESET", body, &payload); err != nil {
		return nil, err
	}
	if !needsSecondReset(payload) {
		return payload, nil
	}
	guid, ok := payload["guid"].(string)
	guid = strings.TrimSpace(guid)
	if !ok || guid == "" {
		return payload, nil
	}

	body["guid"] = guid
	var activated map[string]any
	if err := c.requestJSON(ctx, http.MethodPost, "/api/cmd/RESET", body, &activated); err != nil {
		return nil, err
	}
	if activated == nil {
		activated = map[string]any{}
	}
	if _, hasGuid := activated["guid"]; !hasGuid {
		activated["guid"] = guid
	}
	return activated, nil
}

func (c *HTTPArcAPIClient) Action(ctx context.Context, sessionID, gameID, action string, payload map[string]any) (map[string]any, error) {
	actionName := normalizeActionName(action)
	if actionName == "" || actionName == "RESET" {
		return nil, fmt.Errorf("invalid action %q", action)
	}
	body := cloneMap(payload)
	if body == nil {
		body = map[string]any{}
	}
	body["game_id"] = strings.TrimSpace(gameID)
	body["card_id"] = strings.TrimSpace(sessionID)
	var response map[string]any
	if err := c.requestJSON(ctx, http.MethodPost, "/api/cmd/"+actionName, body, &response); err != nil {
		return nil, err
	}
	return response, nil
}

func (c *HTTPArcAPIClient) requestJSON(ctx context.Context, method, path string, body any, out any) error {
	base := c.baseURL()
	if base == "" {
		return fmt.Errorf("arc runtime base url is empty")
	}
	target := base + path
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, target, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.apiKey != "" {
		req.Header.Set("X-API-Key", c.apiKey)
	}
	resp, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return &ArcAPIError{
			StatusCode: resp.StatusCode,
			Body:       strings.TrimSpace(string(data)),
			Endpoint:   path,
		}
	}
	if out == nil || len(data) == 0 {
		return nil
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("decode %s %s response: %w", method, path, err)
	}
	return nil
}

type ArcAPIError struct {
	StatusCode int
	Body       string
	Endpoint   string
}

func (e *ArcAPIError) Error() string {
	return fmt.Sprintf("arc api %s failed with status %d: %s", e.Endpoint, e.StatusCode, e.Body)
}

func normalizeActionName(raw string) string {
	action := strings.ToUpper(strings.TrimSpace(raw))
	if strings.HasPrefix(action, "ACTION") {
		return action
	}
	switch action {
	case "1", "2", "3", "4", "5", "6", "7":
		return "ACTION" + action
	case "UP":
		return "ACTION1"
	case "DOWN":
		return "ACTION2"
	case "LEFT":
		return "ACTION3"
	case "RIGHT":
		return "ACTION4"
	default:
		return action
	}
}

func needsSecondReset(payload map[string]any) bool {
	if payload == nil {
		return false
	}
	state, _ := payload["state"].(string)
	state = strings.ToUpper(strings.TrimSpace(state))
	actions := payload["available_actions"]
	if list, ok := actions.([]any); ok && len(list) > 0 {
		return false
	}
	if list, ok := actions.([]string); ok && len(list) > 0 {
		return false
	}
	return state == "" || state == "IDLE"
}
