package backendmodule

import (
	"encoding/json"
	"math"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestCoerceInt_ClampsLargeUnsignedValues(t *testing.T) {
	require.Equal(t, maxIntValue, coerceInt(^uint(0)))
	require.Equal(t, maxIntValue, coerceInt(uint64(math.MaxUint64)))
}

func TestCoerceInt_ClampsLargeSignedAndFloatValues(t *testing.T) {
	require.Equal(t, maxIntValue, coerceInt(int64(math.MaxInt64)))
	require.Equal(t, minIntValue, coerceInt(int64(math.MinInt64)))
	require.Equal(t, maxIntValue, coerceInt(math.Inf(1)))
	require.Equal(t, minIntValue, coerceInt(math.Inf(-1)))
	require.Equal(t, 0, coerceInt(math.NaN()))
}

func TestCoerceInt_ClampsJSONNumbers(t *testing.T) {
	require.Equal(t, maxIntValue, coerceInt(json.Number("18446744073709551615")))
	require.Equal(t, minIntValue, coerceInt(json.Number("-18446744073709551616")))
}
