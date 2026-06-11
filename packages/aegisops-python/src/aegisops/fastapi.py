from typing import Optional

from .client import AegisOpsClient, AegisOpsConfig, create_aegisops_client
from .middleware import AegisOpsMiddleware


def add_aegisops_middleware(app, config: Optional[AegisOpsConfig] = None, client: Optional[AegisOpsClient] = None):
    aegisops = client or create_aegisops_client(config)
    app.add_middleware(AegisOpsMiddleware, client=aegisops)
    return aegisops
