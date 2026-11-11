from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared by the text and voice routers so ``app.state.limiter`` and the
# ``@limiter.limit(...)`` decorators all use the same limiter instance.
limiter = Limiter(key_func=get_remote_address)
