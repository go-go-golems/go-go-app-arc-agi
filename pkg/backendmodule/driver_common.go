package backendmodule

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type processRuntime struct {
	mu       sync.RWMutex
	cmd      *exec.Cmd
	waitCh   chan error
	baseURL  string
	logPath  string
	tempPath string
}

func (p *processRuntime) setProcess(cmd *exec.Cmd, waitCh chan error, logPath, tempPath string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cmd = cmd
	p.waitCh = waitCh
	p.logPath = logPath
	p.tempPath = tempPath
}

func (p *processRuntime) setBaseURL(baseURL string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.baseURL = strings.TrimSpace(baseURL)
}

func (p *processRuntime) BaseURL() string {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.baseURL
}

func (p *processRuntime) getProcess() (*exec.Cmd, chan error, string, string) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.cmd, p.waitCh, p.logPath, p.tempPath
}

func (p *processRuntime) clear() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.cmd = nil
	p.waitCh = nil
	p.baseURL = ""
	p.logPath = ""
	p.tempPath = ""
}

func (p *processRuntime) stopProcess(ctx context.Context) error {
	cmd, waitCh, _, tempPath := p.getProcess()
	if cmd == nil {
		return nil
	}
	_ = cmd.Process.Signal(os.Interrupt)

	killTimer := time.NewTimer(3 * time.Second)
	defer killTimer.Stop()

	select {
	case <-ctx.Done():
		_ = cmd.Process.Kill()
	case <-killTimer.C:
		_ = cmd.Process.Kill()
	case <-waitCh:
	}

	waitTimer := time.NewTimer(2 * time.Second)
	defer waitTimer.Stop()
	select {
	case <-waitCh:
	case <-ctx.Done():
	case <-waitTimer.C:
		_ = cmd.Process.Kill()
	}

	if tempPath != "" {
		_ = os.RemoveAll(tempPath)
	}
	p.clear()
	return nil
}

func probeHealth(ctx context.Context, baseURL string) error {
	base := strings.TrimSpace(baseURL)
	if base == "" {
		return fmt.Errorf("arc runtime base url is not set")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/api/healthcheck", nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("arc runtime healthcheck status %d", resp.StatusCode)
	}
	return nil
}

func writeBootstrapScript(tempDir, mode, host string, port int) (string, error) {
	modeName := strings.ToUpper(strings.TrimSpace(mode))
	if modeName == "" {
		modeName = "OFFLINE"
	}
	hostValue := strings.TrimSpace(host)
	if hostValue == "" {
		hostValue = "127.0.0.1"
	}
	content := fmt.Sprintf(
		"import arc_agi\nfrom arc_agi import OperationMode\n\narc = arc_agi.Arcade(operation_mode=OperationMode.%s, environments_dir=\"test_environment_files\")\narc.listen_and_serve(host=%q, port=%d)\n",
		modeName,
		hostValue,
		port,
	)
	scriptPath := filepath.Join(tempDir, "run_arc_server.py")
	if err := os.WriteFile(scriptPath, []byte(content), 0o600); err != nil {
		return "", err
	}
	return scriptPath, nil
}

func ensureBinaryAvailable(name string) error {
	_, err := exec.LookPath(strings.TrimSpace(name))
	return err
}
