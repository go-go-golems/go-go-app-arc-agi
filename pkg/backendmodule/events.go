package backendmodule

import (
	"sync"
	"time"
)

type SessionEvent struct {
	Seq       int64          `json:"seq"`
	Timestamp time.Time      `json:"ts"`
	SessionID string         `json:"session_id"`
	GameID    string         `json:"game_id,omitempty"`
	Type      string         `json:"type"`
	Summary   string         `json:"summary,omitempty"`
	Payload   map[string]any `json:"payload,omitempty"`
}

type SessionEventStore struct {
	mu      sync.RWMutex
	limit   int
	byID    map[string][]SessionEvent
	nextSeq map[string]int64
}

func NewSessionEventStore(limit int) *SessionEventStore {
	if limit <= 0 {
		limit = 200
	}
	return &SessionEventStore{
		limit:   limit,
		byID:    map[string][]SessionEvent{},
		nextSeq: map[string]int64{},
	}
}

func (s *SessionEventStore) Append(sessionID, gameID, eventType, summary string, payload map[string]any) SessionEvent {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.nextSeq[sessionID]++
	event := SessionEvent{
		Seq:       s.nextSeq[sessionID],
		Timestamp: time.Now().UTC(),
		SessionID: sessionID,
		GameID:    gameID,
		Type:      eventType,
		Summary:   summary,
		Payload:   cloneMap(payload),
	}
	events := append(s.byID[sessionID], event)
	if len(events) > s.limit {
		events = append([]SessionEvent(nil), events[len(events)-s.limit:]...)
	}
	s.byID[sessionID] = events
	return event
}

func (s *SessionEventStore) ListAfter(sessionID string, afterSeq int64) []SessionEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	events := s.byID[sessionID]
	if len(events) == 0 {
		return nil
	}
	out := make([]SessionEvent, 0, len(events))
	for _, event := range events {
		if event.Seq > afterSeq {
			out = append(out, event)
		}
	}
	return out
}

func (s *SessionEventStore) Timeline(sessionID string) map[string]any {
	events := s.ListAfter(sessionID, 0)
	counts := map[string]int{}
	items := make([]map[string]any, 0, len(events))
	status := "active"
	for _, event := range events {
		counts[event.Type]++
		items = append(items, map[string]any{
			"seq":     event.Seq,
			"type":    event.Type,
			"summary": event.Summary,
		})
		if event.Type == "arc.session.closed" {
			status = "closed"
		}
	}
	return map[string]any{
		"session_id": sessionID,
		"status":     status,
		"counts":     counts,
		"items":      items,
	}
}

func cloneMap(src map[string]any) map[string]any {
	if len(src) == 0 {
		return nil
	}
	out := make(map[string]any, len(src))
	for k, v := range src {
		out[k] = v
	}
	return out
}
