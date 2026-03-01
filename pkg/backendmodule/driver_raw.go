package backendmodule

import (
	"context"
	"fmt"
	"net"
	"os"
	"os/exec"
	"strings"
)

type RawProcessDriver struct {
	config  ModuleConfig
	process processRuntime
}

func NewRawProcessDriver(config ModuleConfig) *RawProcessDriver {
	return &RawProcessDriver{config: config}
}

func (d *RawProcessDriver) Init(context.Context) error {
	if len(d.config.PythonCommand) == 0 {
		return fmt.Errorf("python command is required for raw process driver")
	}
	if err := ensureBinaryAvailable(d.config.PythonCommand[0]); err != nil {
		return fmt.Errorf("python launcher binary is not available: %w", err)
	}
	return nil
}

func (d *RawProcessDriver) Start(ctx context.Context) error {
	if len(d.config.PythonCommand) == 0 {
		return fmt.Errorf("python command is required for raw process driver")
	}
	if err := ensureBinaryAvailable(d.config.PythonCommand[0]); err != nil {
		return fmt.Errorf("python launcher binary is not available: %w", err)
	}

	host, port, err := splitHostPort(d.config.RawListenAddr)
	if err != nil {
		return err
	}

	tempDir, err := os.MkdirTemp("", "arc-agi-raw-*")
	if err != nil {
		return err
	}
	scriptPath, err := writeBootstrapScript(tempDir, d.config.RuntimeMode, host, port)
	if err != nil {
		_ = os.RemoveAll(tempDir)
		return err
	}
	logPath := tempDir + "/raw-runtime.log"
	logFile, err := os.Create(logPath)
	if err != nil {
		_ = os.RemoveAll(tempDir)
		return err
	}
	defer func() { _ = logFile.Close() }()

	args := make([]string, 0, len(d.config.PythonCommand))
	args = append(args, d.config.PythonCommand...)
	args = append(args, scriptPath)
	cmd := exec.CommandContext(ctx, args[0], args[1:]...)
	cmd.Dir = d.config.ArcRepoRoot
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	if err := cmd.Start(); err != nil {
		_ = os.RemoveAll(tempDir)
		return fmt.Errorf("start raw arc runtime: %w", err)
	}
	waitCh := make(chan error, 1)
	go func() {
		waitCh <- cmd.Wait()
	}()
	d.process.setProcess(cmd, waitCh, logPath, tempDir)
	d.process.setBaseURL(fmt.Sprintf("http://%s:%d", host, port))
	return nil
}

func (d *RawProcessDriver) Stop(ctx context.Context) error {
	return d.process.stopProcess(ctx)
}

func (d *RawProcessDriver) Health(ctx context.Context) error {
	return probeHealth(ctx, d.process.BaseURL())
}

func (d *RawProcessDriver) BaseURL() string {
	return d.process.BaseURL()
}

func splitHostPort(raw string) (string, int, error) {
	addr := strings.TrimSpace(raw)
	if addr == "" {
		return "", 0, fmt.Errorf("raw listen address is required")
	}
	host, portText, err := net.SplitHostPort(addr)
	if err != nil {
		return "", 0, fmt.Errorf("invalid raw listen address %q: %w", addr, err)
	}
	port, err := parsePort(portText)
	if err != nil {
		return "", 0, err
	}
	if host == "" {
		host = "127.0.0.1"
	}
	return host, port, nil
}

func parsePort(raw string) (int, error) {
	var port int
	_, err := fmt.Sscanf(strings.TrimSpace(raw), "%d", &port)
	if err != nil || port <= 0 || port > 65535 {
		return 0, fmt.Errorf("invalid port %q", raw)
	}
	return port, nil
}
