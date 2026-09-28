; SPDX-License-Identifier: GPL-3.0-or-later
        list p=16f877a
        include <p16f877a.inc>
        __config _HS_OSC & _WDT_OFF & _PWRTE_ON & _LVP_OFF & _CP_OFF
        org 0
        goto start
        org 4
        bcf PIR1,TMR1IF
        bsf PORTB,1
        retfie
start
        banksel TRISB
        clrf TRISB
        banksel PORTB
        movlw 1
        movwf PORTB
        movlw 1
        movwf T1CON
        movlw 0xff
        movwf TMR1H
        banksel PIE1
        bsf PIE1,TMR1IE
        banksel INTCON
        bsf INTCON,PEIE
        bsf INTCON,GIE
        banksel ADCON1
        clrf ADCON1
        banksel ADCON0
        movlw 0x81
        movwf ADCON0
        nop
        nop
        bsf ADCON0,GO
adcwait
        btfsc ADCON0,GO
        goto adcwait
        movlw .120
        subwf ADRESH,w
        btfsc STATUS,C
        bsf PORTB,2
        banksel SPBRG
        movlw .25
        movwf SPBRG
        movlw 0x24
        movwf TXSTA
        banksel RCSTA
        movlw 0x80
        movwf RCSTA
        movlw 'P'
        movwf TXREG
loop    goto loop
        end
