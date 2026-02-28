package backendmodule

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Module struct {
	config ModuleConfig
	driver ArcRuntimeDriver
	client ArcAPIClient
	events *SessionEventStore
}

func NewModule(config ModuleConfig) (*Module, error) {
	driver, err := newRuntimeDriver(config)
	if err != nil {
		return nil, err
	}
	return NewModuleWithRuntime(config, driver)
}

func NewModuleWithRuntime(config ModuleConfig, driver ArcRuntimeDriver) (*Module, error) {
	if driver == nil {
		return nil, fmt.Errorf("arc runtime driver is nil")
	}
	config = normalizeConfig(config)
	return &Module{
		config: config,
		driver: driver,
		client: NewHTTPArcAPIClient(driver, config.RequestTimeout),
		events: NewSessionEventStore(config.MaxSessionEvents),
	}, nil
}

func normalizeConfig(config ModuleConfig) ModuleConfig {
	config.Driver = strings.TrimSpace(config.Driver)
	if config.Driver == "" {
		config.Driver = "dagger"
	}
	config.ArcRepoRoot = strings.TrimSpace(config.ArcRepoRoot)
	if config.ArcRepoRoot == "" {
		config.ArcRepoRoot = "./2026-02-27--arc-agi/ARC-AGI"
	}
	config.RuntimeMode = strings.ToLower(strings.TrimSpace(config.RuntimeMode))
	if config.RuntimeMode == "" {
		config.RuntimeMode = "offline"
	}
	if config.StartupTimeout <= 0 {
		config.StartupTimeout = 45 * time.Second
	}
	if config.RequestTimeout <= 0 {
		config.RequestTimeout = 30 * time.Second
	}
	config.APIKey = strings.TrimSpace(config.APIKey)
	if config.APIKey == "" {
		config.APIKey = "1234"
	}
	if config.MaxSessionEvents <= 0 {
		config.MaxSessionEvents = 200
	}
	config.DaggerBinary = strings.TrimSpace(config.DaggerBinary)
	if config.DaggerBinary == "" {
		config.DaggerBinary = "dagger"
	}
	config.DaggerImage = strings.TrimSpace(config.DaggerImage)
	if config.DaggerImage == "" {
		config.DaggerImage = "python:3.12-slim"
	}
	if config.DaggerContainerPort <= 0 {
		config.DaggerContainerPort = 18081
	}
	config.DaggerProgress = strings.TrimSpace(config.DaggerProgress)
	if config.DaggerProgress == "" {
		config.DaggerProgress = "plain"
	}
	config.RawListenAddr = strings.TrimSpace(config.RawListenAddr)
	if config.RawListenAddr == "" {
		config.RawListenAddr = "127.0.0.1:18081"
	}
	if len(config.PythonCommand) == 0 {
		config.PythonCommand = []string{"uv", "run", "python"}
	}
	return config
}

func (m *Module) Manifest() Manifest {
	return Manifest{
		AppID:       AppID,
		Name:        "ARC-AGI",
		Description: "ARC gameplay backend module with Go-managed runtime proxy",
		Required:    false,
		Capabilities: []string{
			"games",
			"sessions",
			"actions",
			"timeline",
			"reflection",
		},
	}
}

func (m *Module) MountRoutes(mux *http.ServeMux) error {
	if mux == nil {
		return fmt.Errorf("arc module mount mux is nil")
	}
	mux.HandleFunc("/health", m.handleHealth)
	mux.HandleFunc("/health/", m.handleHealth)
	mux.HandleFunc("/games", m.handleGames)
	mux.HandleFunc("/games/", m.handleGamesSubresource)
	mux.HandleFunc("/sessions", m.handleSessions)
	mux.HandleFunc("/sessions/", m.handleSessionsSubresource)
	mux.HandleFunc("/schemas/", m.handleSchemaByID)
	return nil
}

func (m *Module) Init(ctx context.Context) error {
	if m == nil {
		return fmt.Errorf("arc module is nil")
	}
	return m.driver.Init(ctx)
}

func (m *Module) Start(ctx context.Context) error {
	if m == nil {
		return fmt.Errorf("arc module is nil")
	}
	if err := m.driver.Start(ctx); err != nil {
		return err
	}
	healthCtx, cancel := context.WithTimeout(ctx, m.config.StartupTimeout)
	defer cancel()
	return waitForDriverHealthy(healthCtx, m.driver)
}

func (m *Module) Stop(ctx context.Context) error {
	if m == nil {
		return nil
	}
	return m.driver.Stop(ctx)
}

func (m *Module) Health(ctx context.Context) error {
	if m == nil {
		return fmt.Errorf("arc module is nil")
	}
	return m.driver.Health(ctx)
}

func (m *Module) Reflection(context.Context) (*ReflectionDocument, error) {
	if !m.config.EnableReflection {
		return nil, fmt.Errorf("reflection is disabled for module %q", AppID)
	}
	return m.buildReflectionDocument(), nil
}
