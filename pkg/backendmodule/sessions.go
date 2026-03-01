package backendmodule

import "sync"

type SessionStore struct {
	mu    sync.RWMutex
	byID  map[string]map[string]string
	state map[string]string
}

func NewSessionStore() *SessionStore {
	return &SessionStore{
		byID:  map[string]map[string]string{},
		state: map[string]string{},
	}
}

func (s *SessionStore) Ensure(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[sessionID]; !ok {
		s.byID[sessionID] = map[string]string{}
	}
	if s.state[sessionID] == "" {
		s.state[sessionID] = "active"
	}
}

func (s *SessionStore) UpsertGUID(sessionID, gameID, guid string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[sessionID]; !ok {
		s.byID[sessionID] = map[string]string{}
	}
	if guid != "" {
		s.byID[sessionID][gameID] = guid
	}
	if s.state[sessionID] == "" {
		s.state[sessionID] = "active"
	}
}

func (s *SessionStore) LookupGUID(sessionID, gameID string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	byGame, ok := s.byID[sessionID]
	if !ok {
		return "", false
	}
	guid, ok := byGame[gameID]
	return guid, ok
}

func (s *SessionStore) MarkClosed(sessionID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.byID[sessionID]; !ok {
		s.byID[sessionID] = map[string]string{}
	}
	s.state[sessionID] = "closed"
}

func (s *SessionStore) Status(sessionID string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if status := s.state[sessionID]; status != "" {
		return status
	}
	return "active"
}
