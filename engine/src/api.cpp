// SPDX-License-Identifier: GPL-3.0-or-later
#include "wiresnaps.h"
#include "engine.h"
struct ws_context {double step;std::unique_ptr<ws::Engine> engine;std::string result;explicit ws_context(double dt):step(dt),engine(std::make_unique<ws::Engine>(dt)){}};
template<class F> static int call(ws_context* c,F f){if(!c)return 0;try{f();return c->engine->valid();}catch(const std::exception& e){c->engine->fail(e.what());return 0;}catch(...){c->engine->fail("INTERNAL_ERROR");return 0;}}
extern "C" {
uint32_t ws_api_version(){return 1;}
ws_context* ws_create(double dt){try{return new ws_context(dt);}catch(...){return nullptr;}}
void ws_destroy(ws_context* c){delete c;}
int ws_load(ws_context* c,const char* json){return call(c,[&]{if(!json)throw std::invalid_argument("NULL_DOCUMENT");auto document=ws::Json::parse(json);auto next=std::make_unique<ws::Engine>(c->step);next->load(document,document.value("preserveState",false)?c->engine.get():nullptr);if(!next->valid())throw std::runtime_error(next->snapshot()["diagnostics"][0]["code"].get<std::string>());c->engine=std::move(next);});}
int ws_control(ws_context* c,const char* json){return call(c,[&]{if(!json)throw std::invalid_argument("NULL_CONTROL");c->engine->controls(ws::Json::parse(json));});}
int ws_advance(ws_context* c,uint32_t steps){bool advanced=false;return call(c,[&]{advanced=c->engine->advance(steps);})&&advanced;}
int ws_load_firmware(ws_context* c,const char* id,const char* hex){return call(c,[&]{if(!id||!hex)throw std::invalid_argument("NULL_FIRMWARE");c->engine->firmware(id,hex);});}
int ws_reset(ws_context* c){return call(c,[&]{c->engine->reset();});}
int ws_repair(ws_context* c,const char* id){return call(c,[&]{if(!id)throw std::invalid_argument("NULL_ID");c->engine->repair(id);});}
const char* ws_snapshot(ws_context* c){if(!c)return "{\"diagnostics\":[{\"code\":\"INVALID_HANDLE\"}]}";try{c->result=c->engine->snapshot().dump();return c->result.c_str();}catch(...){return "{\"diagnostics\":[{\"code\":\"SNAPSHOT_ERROR\",\"severity\":\"error\"}]}";}}
}
