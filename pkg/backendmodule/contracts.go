package backendmodule

import "time"

const AppID = "arc-agi"

type Manifest struct {
	AppID        string   `json:"app_id"`
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	Required     bool     `json:"required,omitempty"`
	Capabilities []string `json:"capabilities,omitempty"`
}

type ReflectionDocument struct {
	AppID        string                 `json:"app_id"`
	Name         string                 `json:"name"`
	Version      string                 `json:"version,omitempty"`
	Summary      string                 `json:"summary,omitempty"`
	Capabilities []ReflectionCapability `json:"capabilities,omitempty"`
	Docs         []ReflectionDocLink    `json:"docs,omitempty"`
	APIs         []ReflectionAPI        `json:"apis,omitempty"`
	Schemas      []ReflectionSchemaRef  `json:"schemas,omitempty"`
}

type ReflectionCapability struct {
	ID          string `json:"id"`
	Stability   string `json:"stability,omitempty"`
	Description string `json:"description,omitempty"`
}

type ReflectionDocLink struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	URL         string `json:"url,omitempty"`
	Path        string `json:"path,omitempty"`
	Description string `json:"description,omitempty"`
}

type ReflectionAPI struct {
	ID             string   `json:"id"`
	Method         string   `json:"method"`
	Path           string   `json:"path"`
	Summary        string   `json:"summary,omitempty"`
	RequestSchema  string   `json:"request_schema,omitempty"`
	ResponseSchema string   `json:"response_schema,omitempty"`
	ErrorSchema    string   `json:"error_schema,omitempty"`
	Tags           []string `json:"tags,omitempty"`
}

type ReflectionSchemaRef struct {
	ID       string `json:"id"`
	Format   string `json:"format"`
	URI      string `json:"uri,omitempty"`
	Embedded any    `json:"embedded,omitempty"`
}

type ModuleConfig struct {
	EnableReflection bool
	Driver           string
	RuntimeMode      string
	ArcRepoRoot      string
	StartupTimeout   time.Duration
	RequestTimeout   time.Duration
	APIKey           string
	MaxSessionEvents int

	DaggerBinary        string
	DaggerImage         string
	DaggerContainerPort int
	DaggerProgress      string

	RawListenAddr string
	PythonCommand []string
}
