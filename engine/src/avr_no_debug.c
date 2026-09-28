// The browser engine has no network debugger. CPU tracing is exposed through
// the typed API, without sockets or host threads.
#include "sim_avr.h"
#include "sim_gdb.h"
#include "sim_vcd_file.h"
void avr_vcd_close(avr_vcd_t* vcd) {(void)vcd;}
int avr_vcd_start(avr_vcd_t* vcd) {(void)vcd;return -1;}
int avr_vcd_stop(avr_vcd_t* vcd) {(void)vcd;return -1;}
int avr_gdb_init(avr_t* avr) { (void)avr; return -1; }
void avr_deinit_gdb(avr_t* avr) { (void)avr; }
int avr_gdb_processor(avr_t* avr, int sleep) { (void)avr; (void)sleep; return 0; }
void avr_gdb_handle_watchpoints(avr_t* avr, uint16_t addr, enum avr_gdb_watch_type type) { (void)avr; (void)addr; (void)type; }
