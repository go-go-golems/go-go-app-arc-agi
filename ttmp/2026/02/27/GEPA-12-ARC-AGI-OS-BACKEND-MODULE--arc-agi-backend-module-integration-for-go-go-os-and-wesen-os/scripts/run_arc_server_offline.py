import arc_agi
from arc_agi import OperationMode

arc = arc_agi.Arcade(
    operation_mode=OperationMode.OFFLINE,
    environments_dir="test_environment_files",
)
arc.listen_and_serve(host="0.0.0.0", port=18081)
