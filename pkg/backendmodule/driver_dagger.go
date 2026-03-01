package backendmodule

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

var httpURLPattern = regexp.MustCompile(`http_url=(http://localhost:[0-9]+)`)

type DaggerDriver struct {
	config  ModuleConfig
	process processRuntime
}

func NewDaggerDriver(config ModuleConfig) *DaggerDriver {
	return &DaggerDriver{config: config}
}

func (d *DaggerDriver) Init(context.Context) error {
	if err := ensureBinaryAvailable(d.config.DaggerBinary); err != nil {
		return fmt.Errorf("dagger binary is not available: %w", err)
	}
	return nil
}

func (d *DaggerDriver) Start(ctx context.Context) error {
	if err := ensureBinaryAvailable(d.config.DaggerBinary); err != nil {
		return fmt.Errorf("dagger binary is not available: %w", err)
	}
	if strings.TrimSpace(d.config.ArcRepoRoot) == "" {
		return fmt.Errorf("arc repo root is required for dagger driver")
	}

	tempDir, err := os.MkdirTemp("", "arc-agi-dagger-*")
	if err != nil {
		return err
	}
	scriptPath, err := writeBootstrapScript(tempDir, d.config.RuntimeMode, "0.0.0.0", d.config.DaggerContainerPort)
	if err != nil {
		_ = os.RemoveAll(tempDir)
		return err
	}
	logPath := tempDir + "/dagger-up.log"
	logFile, err := os.Create(logPath)
	if err != nil {
		_ = os.RemoveAll(tempDir)
		return err
	}
	defer func() { _ = logFile.Close() }()

	args := []string{
		"--progress=" + d.config.DaggerProgress,
		"core", "container",
		"from", "--address", d.config.DaggerImage,
		"with-mounted-directory", "--path", "/src", "--source", d.config.ArcRepoRoot,
		"with-mounted-file", "--path", "/tmp/run_arc_server.py", "--source", scriptPath,
		"with-workdir", "--path", "/src",
		"with-exec", "--args", "pip", "--args", "install", "--args", "uv",
		"with-exec", "--args", "uv", "--args", "sync", "--args", "--frozen",
		"with-exposed-port", "--port", fmt.Sprintf("%d", d.config.DaggerContainerPort),
		"up", "--random",
		"--args", "uv", "--args", "run", "--args", "python", "--args", "/tmp/run_arc_server.py",
	}

	cmd := exec.CommandContext(ctx, d.config.DaggerBinary, args...)
	cmd.Stdout = logFile
	cmd.Stderr = logFile
	if err := cmd.Start(); err != nil {
		_ = os.RemoveAll(tempDir)
		return fmt.Errorf("start dagger runtime: %w", err)
	}
	waitCh := make(chan error, 1)
	go func() {
		waitCh <- cmd.Wait()
	}()
	d.process.setProcess(cmd, waitCh, logPath, tempDir)

	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()
	for {
		content, _ := os.ReadFile(logPath)
		match := httpURLPattern.FindStringSubmatch(string(content))
		if len(match) == 2 {
			d.process.setBaseURL(match[1])
			return nil
		}
		select {
		case err := <-waitCh:
			return fmt.Errorf("dagger runtime exited before tunnel url was discovered: %w; logs: %s", err, tailLog(string(content), 1200))
		case <-ctx.Done():
			_ = d.Stop(context.Background())
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (d *DaggerDriver) Stop(ctx context.Context) error {
	return d.process.stopProcess(ctx)
}

func (d *DaggerDriver) Health(ctx context.Context) error {
	return probeHealth(ctx, d.process.BaseURL())
}

func (d *DaggerDriver) BaseURL() string {
	return d.process.BaseURL()
}

func tailLog(content string, maxChars int) string {
	if len(content) <= maxChars {
		return content
	}
	return content[len(content)-maxChars:]
}
