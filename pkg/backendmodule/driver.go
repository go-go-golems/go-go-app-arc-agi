package backendmodule

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type ArcRuntimeDriver interface {
	Init(ctx context.Context) error
	Start(ctx context.Context) error
	Stop(ctx context.Context) error
	Health(ctx context.Context) error
	BaseURL() string
}

func newRuntimeDriver(config ModuleConfig) (ArcRuntimeDriver, error) {
	switch strings.ToLower(strings.TrimSpace(config.Driver)) {
	case "", "dagger":
		return NewDaggerDriver(config), nil
	case "raw":
		return NewRawProcessDriver(config), nil
	default:
		return nil, fmt.Errorf("unsupported arc runtime driver: %q", config.Driver)
	}
}

func waitForDriverHealthy(ctx context.Context, driver ArcRuntimeDriver) error {
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()
	for {
		if err := driver.Health(ctx); err == nil {
			return nil
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("arc runtime did not become healthy before timeout: %w", ctx.Err())
		case <-ticker.C:
		}
	}
}
