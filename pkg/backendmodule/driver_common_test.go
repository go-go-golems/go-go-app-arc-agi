package backendmodule

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHealthcheckURL_AllowsLoopbackHosts(t *testing.T) {
	t.Run("localhost", func(t *testing.T) {
		target, err := healthcheckURL("http://localhost:18081")
		require.NoError(t, err)
		require.Equal(t, "http://localhost:18081/api/healthcheck", target)
	})

	t.Run("ipv4 loopback", func(t *testing.T) {
		target, err := healthcheckURL("http://127.0.0.1:18081")
		require.NoError(t, err)
		require.Equal(t, "http://127.0.0.1:18081/api/healthcheck", target)
	})
}

func TestHealthcheckURL_RejectsNonLoopbackHosts(t *testing.T) {
	_, err := healthcheckURL("http://example.com:18081")
	require.Error(t, err)
	require.Contains(t, err.Error(), "must be loopback")
}

func TestProbeHealth_HitsValidatedLoopbackEndpoint(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodGet, r.Method)
		require.Equal(t, "/api/healthcheck", r.URL.Path)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	require.NoError(t, probeHealth(context.Background(), srv.URL))
}
