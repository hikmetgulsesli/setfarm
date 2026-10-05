/* Inert ABI prerequisite only. No task right, transport or readiness. */
#define NAPI_VERSION 8
#include <node_api.h>
#include <stdlib.h>

static napi_value initializer_refuse(napi_env env, napi_callback_info info) {
    (void)info;
    if (napi_throw_error(env, "ORIGIN_COOPERATIVE_TRANSPORT_UNAVAILABLE",
                         "cooperative transport unavailable") != napi_ok)
        _Exit(72);
    return NULL;
}

NAPI_MODULE_INIT() {
    napi_value fn = NULL;
    if (napi_create_function(env, "initialize", 10, initializer_refuse,
                             NULL, &fn) != napi_ok)
        _Exit(72);
    if (napi_set_named_property(env, exports, "initialize", fn) != napi_ok)
        _Exit(72);
    return exports;
}
