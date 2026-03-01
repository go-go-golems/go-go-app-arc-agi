import json

import arc_agi
from arc_agi import OperationMode

arc = arc_agi.Arcade(
    operation_mode=OperationMode.NORMAL,
    environments_dir="/tmp/arc_normal_envs",
)

envs = arc.get_environments()

out = {
    "mode": "NORMAL",
    "count": len(envs),
    "first_ids": [getattr(e, "game_id", None) for e in envs[:5]],
}
print(json.dumps(out, indent=2))
