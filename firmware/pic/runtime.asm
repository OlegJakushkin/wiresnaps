; SPDX-License-Identifier: GPL-3.0-or-later
; WireSnaps bytecode v1 on the actual PIC16F877A instruction set.
        list p=16f877a
        include <p16f877a.inc>
        __config _HS_OSC & _WDT_OFF & _PWRTE_ON & _LVP_OFF & _CP_OFF
        cblock 0x70
pc_lo
pc_hi
sp
tmp
operand_b
a
slot
pin_n
delay_lo
delay_hi
trace_lo
trace_hi
err
mask
        endc
        org 0
        goto start
        org 4
        retfie
start
        banksel ADCON1
        movlw 6
        movwf ADCON1
        banksel SPBRG
        movlw .25
        movwf SPBRG
        movlw 0x24
        movwf TXSTA
        banksel RCSTA
        movlw 0x80
        movwf RCSTA
        clrf pc_lo
        clrf pc_hi
        clrf err
        movlw 0x30
        movwf sp
        movlw 0x50
        movwf FSR
clear_vars
        clrf INDF
        incf FSR,f
        btfss FSR,5
        goto clear_vars
dispatch
        call fetch
        movwf tmp
        movlw .21
        subwf tmp,w
        btfsc STATUS,C
        goto fault
        movf tmp,w
        addwf PCL,f
        goto fault
        goto op_const
        goto op_load
        goto op_store
        goto op_add
        goto op_sub
        goto op_mul
        goto op_div
        goto op_lt
        goto op_eq
        goto op_not
        goto op_jump
        goto op_jz
        goto op_wait
        goto op_write
        goto op_read
        goto op_adc
        goto op_pwm
        goto op_serial
        goto vm_halt
        goto op_trace
fetch
        banksel pc_hi
        movlw 0x10
        subwf pc_hi,w
        btfsc STATUS,C
        goto fault
        movf pc_lo,w
        banksel EEADR
        movwf EEADR
        banksel pc_hi
        movf pc_hi,w
        iorlw 0x10
        banksel EEADRH
        movwf EEADRH
        banksel EECON1
        bsf EECON1,EEPGD
        bsf EECON1,RD
        nop
        nop
        banksel EEDATA
        movf EEDATA,w
        banksel pc_lo
        incf pc_lo,f
        btfsc STATUS,Z
        incf pc_hi,f
        return
push
        movwf tmp
        movlw 0x50
        subwf sp,w
        btfsc STATUS,C
        goto fault
        movf sp,w
        movwf FSR
        movf tmp,w
        movwf INDF
        incf sp,f
        return
pop
        movlw 0x30
        xorwf sp,w
        btfsc STATUS,Z
        goto fault
        decf sp,f
        movf sp,w
        movwf FSR
        movf INDF,w
        return
binary
        call pop
        movwf operand_b
        call pop
        movwf a
        return
get_variable
        call fetch
        movwf slot
        movlw .16
        subwf slot,w
        btfsc STATUS,C
        goto fault
        movf slot,w
        addlw 0x50
        movwf slot
        return
op_const
        call fetch
        call push
        goto dispatch
op_load
        call get_variable
        movf slot,w
        movwf FSR
        movf INDF,w
        call push
        goto dispatch
op_store
        call get_variable
        call pop
        movwf a
        movf slot,w
        movwf FSR
        movf a,w
        movwf INDF
        goto dispatch
op_add
        call binary
        movf operand_b,w
        addwf a,w
        call push
        goto dispatch
op_sub
        call binary
        movf operand_b,w
        subwf a,w
        call push
        goto dispatch
op_mul
        call binary
        clrf slot
mul_loop
        movf operand_b,f
        btfsc STATUS,Z
        goto mul_end
        movf a,w
        addwf slot,f
        decf operand_b,f
        goto mul_loop
mul_end
        movf slot,w
        call push
        goto dispatch
op_div
        call binary
        movf operand_b,f
        btfsc STATUS,Z
        goto fault
        clrf slot
div_loop
        movf operand_b,w
        subwf a,w
        btfss STATUS,C
        goto mul_end
        movwf a
        incf slot,f
        goto div_loop
op_lt
        call binary
        movf operand_b,w
        subwf a,w
        movlw 0
        btfss STATUS,C
        movlw 1
        call push
        goto dispatch
op_eq
        call binary
        movf operand_b,w
        xorwf a,w
        movlw 0
        btfsc STATUS,Z
        movlw 1
        call push
        goto dispatch
op_not
        call pop
        iorlw 0
        movlw 0
        btfsc STATUS,Z
        movlw 1
        call push
        goto dispatch
target
        call fetch
        movwf a
        call fetch
        movwf operand_b
        return
op_jump
        call target
jump_target
        movf a,w
        movwf pc_lo
        movf operand_b,w
        movwf pc_hi
        goto dispatch
op_jz
        call target
        call pop
        iorlw 0
        btfsc STATUS,Z
        goto jump_target
        goto dispatch
op_wait
        call fetch
        movwf delay_lo
        call fetch
        movwf delay_hi
wait_loop
        movf delay_lo,w
        iorwf delay_hi,w
        btfsc STATUS,Z
        goto dispatch
        movlw 0xfc
        movwf TMR1H
        movlw 0x18
        movwf TMR1L
        bcf PIR1,TMR1IF
        movlw 1
        movwf T1CON
wait_timer
        btfss PIR1,TMR1IF
        goto wait_timer
        clrf T1CON
        movf delay_lo,f
        btfsc STATUS,Z
        decf delay_hi,f
        decf delay_lo,f
        goto wait_loop
pin_mask
        call fetch
        movwf pin_n
        movlw .16
        subwf pin_n,w
        btfsc STATUS,C
        goto fault
        movf pin_n,w
        andlw 7
        movwf slot
        movlw 1
        movwf mask
mask_loop
        movf slot,f
        btfsc STATUS,Z
        return
        bcf STATUS,C
        rlf mask,f
        decf slot,f
        goto mask_loop
op_write
        call pin_mask
        call pop
        movwf a
        movf mask,w
        xorlw 0xff
        banksel TRISB
        btfss pin_n,3
        andwf TRISB,f
        btfsc pin_n,3
        andwf TRISD,f
        banksel pin_n
        movf a,f
        btfsc STATUS,Z
        goto write_low
        movf mask,w
        btfss pin_n,3
        iorwf PORTB,f
        btfsc pin_n,3
        iorwf PORTD,f
        goto dispatch
write_low
        movf mask,w
        xorlw 0xff
        btfss pin_n,3
        andwf PORTB,f
        btfsc pin_n,3
        andwf PORTD,f
        goto dispatch
op_read
        call pin_mask
        movf mask,w
        banksel TRISB
        btfss pin_n,3
        iorwf TRISB,f
        btfsc pin_n,3
        iorwf TRISD,f
        banksel pin_n
        movf PORTB,w
        btfsc pin_n,3
        movf PORTD,w
        andwf mask,w
        movlw 0
        btfss STATUS,Z
        movlw 1
        call push
        goto dispatch
op_adc
        call fetch
        movwf a
        movlw 8
        subwf a,w
        btfsc STATUS,C
        goto fault
        banksel ADCON1
        clrf ADCON1
        banksel a
        movf a,w
        movwf tmp
        bcf STATUS,C
        rlf tmp,f
        rlf tmp,f
        rlf tmp,w
        iorlw 0x81
        movwf ADCON0
        nop
        nop
        bsf ADCON0,GO
adc_wait
        btfsc ADCON0,GO
        goto adc_wait
        movf ADRESH,w
        call push
        goto dispatch
op_pwm
        call fetch
        xorlw .16
        btfss STATUS,Z
        goto fault
        call pop
        movwf CCPR1L
        banksel PR2
        movlw 0xff
        movwf PR2
        bcf TRISC,2
        banksel CCP1CON
        movlw 0x0c
        movwf CCP1CON
        movlw 4
        movwf T2CON
        goto dispatch
op_serial
        call pop
        movwf a
serial_wait
        btfss PIR1,TXIF
        goto serial_wait
        movf a,w
        movwf TXREG
        goto dispatch
op_trace
        call fetch
        movwf trace_lo
        call fetch
        movwf trace_hi
        goto dispatch
fault
        banksel err
        movlw 1
        movwf err
        banksel TRISB
        movlw 0xff
        movwf TRISB
        movwf TRISD
        banksel err
vm_halt
        goto vm_halt
        end

