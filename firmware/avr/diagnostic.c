// SPDX-License-Identifier: GPL-3.0-or-later
#include <avr/io.h>
#include <avr/interrupt.h>
ISR(TIMER1_COMPA_vect) { PORTD |= _BV(PD5); }
int main(void) {
    DDRB=_BV(PB5);PORTB=_BV(PB5);
    DDRD=_BV(PD4)|_BV(PD5)|_BV(PD6);
    TCCR0A=_BV(COM0A1)|_BV(WGM01)|_BV(WGM00);TCCR0B=_BV(CS00);OCR0A=128;
    TCCR1B=_BV(WGM12)|_BV(CS10);OCR1A=1000;TIMSK1=_BV(OCIE1A);sei();
    UBRR0=103;UCSR0B=_BV(TXEN0);UCSR0C=_BV(UCSZ01)|_BV(UCSZ00);
    ADMUX=_BV(REFS0);ADCSRA=_BV(ADEN)|_BV(ADPS2)|_BV(ADPS1)|_BV(ADPS0);
    ADCSRA|=_BV(ADSC);while(ADCSRA&_BV(ADSC)){}
    if(ADC>450&&ADC<570)PORTD|=_BV(PD4);
    while(!(UCSR0A&_BV(UDRE0))){} UDR0='K';
    for(;;){}
}
