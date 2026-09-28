// SPDX-License-Identifier: GPL-3.0-or-later
#pragma once
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
typedef struct ws_context ws_context;
uint32_t ws_api_version(void);
ws_context* ws_create(double step_microseconds);
void ws_destroy(ws_context* context);
// Optional JSON preserveState:true rewires this context transactionally,
// retaining physical time and matching parts' thermal, reactive and MCU state.
int ws_load(ws_context* context, const char* circuit_json);
int ws_control(ws_context* context, const char* controls_json);
int ws_advance(ws_context* context, uint32_t steps);
int ws_load_firmware(ws_context* context, const char* component_id, const char* intel_hex);
int ws_reset(ws_context* context);
int ws_repair(ws_context* context, const char* component_id);
// UTF-8 JSON, valid until the next call on this context; caller never frees it.
const char* ws_snapshot(ws_context* context);
#ifdef __cplusplus
}
#endif
