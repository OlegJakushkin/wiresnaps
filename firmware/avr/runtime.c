// SPDX-License-Identifier: GPL-3.0-or-later
// WireSnaps bytecode v1. All execution happens on the emulated AVR CPU.
#include <avr/io.h>
#include <avr/pgmspace.h>
#include <util/delay.h>
#include <stdint.h>
volatile uint16_t ws_trace;
volatile uint8_t ws_error;
static uint16_t pc;
static uint8_t stack[32],sp,variables[16];
static void fault(uint8_t code){ws_error=code;DDRB=DDRC=DDRD=0;for(;;){}}
static uint8_t read8(void){if(pc>=4096)fault(1);return pgm_read_byte((const void*)(0x6000+pc++));}
static uint16_t read16(void){uint16_t v=read8();return v|((uint16_t)read8()<<8);}
static void push(uint8_t v){if(sp==32)fault(2);stack[sp++]=v;}
static uint8_t pop(void){if(!sp)fault(3);return stack[--sp];}
static volatile uint8_t* port(uint8_t p){if(p>19)fault(4);return p<8?&PORTD:p<14?&PORTB:&PORTC;}
static uint8_t bit(uint8_t p){return 1<<(p<8?p:p<14?p-8:p-14);}
int main(void){
    UBRR0=103;UCSR0B=_BV(TXEN0);UCSR0C=_BV(UCSZ01)|_BV(UCSZ00);
    for(;;){uint8_t op=read8(),a,b,p;uint16_t target;
        switch(op){
        case 1:push(read8());break;
        case 2:p=read8();if(p>=16)fault(5);push(variables[p]);break;
        case 3:p=read8();if(p>=16)fault(5);variables[p]=pop();break;
        case 4:b=pop();a=pop();push(a+b);break;
        case 5:b=pop();a=pop();push(a-b);break;
        case 6:b=pop();a=pop();push(a*b);break;
        case 7:b=pop();a=pop();if(!b)fault(6);push(a/b);break;
        case 8:b=pop();a=pop();push(a<b);break;
        case 9:b=pop();a=pop();push(a==b);break;
        case 10:push(!pop());break;
        case 11:pc=read16();break;
        case 12:target=read16();if(!pop())pc=target;break;
        case 13:target=read16();while(target--)_delay_ms(1);break;
        case 14:p=read8();a=pop();*(port(p)-1)|=bit(p);if(a)*port(p)|=bit(p);else *port(p)&=~bit(p);break;
        case 15:p=read8();*(port(p)-1)&=~bit(p);push((*(port(p)-2)&bit(p))!=0);break;
        case 16:p=read8();if(p>5)fault(4);ADMUX=_BV(REFS0)|p;ADCSRA=_BV(ADEN)|7|_BV(ADSC);while(ADCSRA&_BV(ADSC)){}push(ADC>>2);break;
        case 17:p=read8();a=pop();if(p==6){DDRD|=_BV(PD6);TCCR0A=_BV(COM0A1)|3;TCCR0B=3;OCR0A=a;}else if(p==5){DDRD|=_BV(PD5);TCCR0A=_BV(COM0B1)|3;TCCR0B=3;OCR0B=a;}else fault(7);break;
        case 18:a=pop();while(!(UCSR0A&_BV(UDRE0))){}UDR0=a;break;
        case 19:for(;;){}break;
        case 20:ws_trace=read16();break;
        default:fault(8);
        }
    }
}
