/* Inert ABI prerequisite only. No task right, transport or readiness. */
#define _DARWIN_C_SOURCE 1
#define NAPI_VERSION 8
#include <node_api.h>
#include <pthread.h>
#include <signal.h>
#include <stdlib.h>

static napi_value initializer_refuse(napi_env env, napi_callback_info info) {
    (void)info;
    /* SF_FINITE_GUARD_BEGIN */
    /* Acquisition-free diagnostic, never a retained-owner exit path. */
    int saved, previous;
    sigset_t original_mask;
    if (pthread_setcancelstate(PTHREAD_CANCEL_DISABLE, &saved) != 0) _Exit(72);
    if (saved != PTHREAD_CANCEL_ENABLE && saved != PTHREAD_CANCEL_DISABLE) _Exit(72);
    int mask_result = pthread_sigmask(SIG_SETMASK, NULL, &original_mask);
    if (pthread_setcancelstate(saved, &previous) != 0 ||
        previous != PTHREAD_CANCEL_DISABLE) _Exit(72);
    if (mask_result != 0) _Exit(72);
    /* SF_FINITE_GUARD_END */
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
