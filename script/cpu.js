( function( emu )
{
  // State
  emu.halted   = false;
  emu.stopped  = false;

  // Interrupt enable register
  emu.ime      = false;

  // Interrupt enable
  emu.iePins   = false;
  emu.ieSerial = false;
  emu.ieTimer  = false;
  emu.ieStat   = false;
  emu.ieVBlank = false;

  // Interrupt flags
  emu.ifPins   = false;
  emu.ifSerial = false;
  emu.ifTimer  = false;
  emu.ifStat   = false;
  emu.ifVBlank = false;

  // Registers
  var reg = {
    'a':  0x00,
    'f':  0x00,
    'af': 0x0000,
    'b':  0x00,
    'c':  0x00,
    'bc': 0x0000,
    'd':  0x00,
    'e':  0x00,
    'de': 0x0000,
    'h':  0x00,
    'l':  0x00,
    'hl': 0x0000,
    'pc': 0x0000,
    'sp': 0xFFFE
  };

  // Allows access sp and pc
  var accessReg16 = function( rr )
  {
    Object.defineProperty( emu, rr, {
      get: function( )
      {
        return reg[ rr ];
      },
      set: function( n )
      {
        reg[ rr ] = n & 0xFFFF;
      }
    });
  }.bind( emu );

  // Allows access 8 bit registers
  var accessReg8 = function( rr )
  {
    Object.defineProperty( emu, rr[ 0 ], {
      get: function( )
      {
        return reg[ rr[ 0 ] ]
      },
      set: function( n )
      {
        reg[ rr[ 0 ] ] = n & 0xFF;
        reg[ rr ] = (reg[ rr ] & 0x00FF) | ( ( n & 0xFF) << 8 );
      }
    });

    Object.defineProperty( emu, rr[ 1 ], {
      get: function( )
      {
        return reg[ rr[ 1 ] ]
      },
      set: function( n )
      {
        reg[ rr[ 1 ] ] = (rr[ 1 ] == 'f' ) ? ( n & 0xF0 ) : ( n & 0xFF );
        reg[ rr ] = (reg[ rr ] & 0xFF00) | ( n & 0xFF);
      }
    });

    Object.defineProperty( emu, rr, {
      get: function( )
      {
        return reg[ rr ];
      },
      set: function( n )
      {
        reg[ rr ] = ( rr == 'af' ) ? ( n & 0xFFF0 ) : ( n & 0xFFFF );
        reg[ rr[ 0 ] ] = ( n & 0xFF00 ) >> 8;
        reg[ rr[ 1 ] ] = ( rr[ 1 ] == 'f' ) ? ( n & 0x00F0 ) : ( n & 0x00FF );
      }
    });
  }.bind( emu );

  // Allows access to flags
  var accessFlag = function( f, bit )
  {
    Object.defineProperty( emu, f, {
      get: function( )
      {
        return ( reg[ 'f' ] & ( 1 << bit ) ) != 0;
      },
      set: function( n )
      {
        if ( n ) {
          reg[ 'f' ]  |= ( 1 << bit );
          reg[ 'af' ] |= ( 1 << bit );
        } else {
          reg[ 'f' ]  &= ~( 1 << bit );
          reg[ 'af' ] &= ~( 1 << bit );
        }
      }
    } );
  }.bind( emu );

  accessReg16( 'pc' );
  accessReg16( 'sp' );
  accessReg8( 'af' );
  accessReg8( 'bc' );
  accessReg8( 'de' );
  accessReg8( 'hl' );
  accessFlag( 'zf', 7 );
  accessFlag( 'nf', 6 );
  accessFlag( 'hf', 5 );
  accessFlag( 'cf', 4 );

  /**
   * Jumpts to an interrupt address
   */
  var interrupt = function( addr )
  {
    emu.inc_cycles( 20 );
    emu.sp = ( emu.sp - 2 ) & 0xFFFF;
    emu.set_word( emu.sp, emu.pc );
    emu.pc = addr;
  }

  /**
   * Sign extend an 8 bit number
   */
  var alu_extend_8 = function( n )
  {
    if ( ( n & 0x80 ) != 0x80 )
      return n;

    return ( n & 0xFF ) | ( ~0xFF );
  }

  /**
   * Sign extend a 16 bit number
   */
  var alu_extend_16 = function( n )
  {
    if ( ( n & 0x8000 ) != 0x8000 )
      return n;

    return ( n & 0xFFFF ) | ( ~0xFFFF );
  }


  /**
   * Sets the value of a register
   */
  var set_r = function( r, v )
  {
    switch ( r )
    {
      case 0x0: emu.b = v; return;
      case 0x1: emu.c = v; return;
      case 0x2: emu.d = v; return;
      case 0x3: emu.e = v; return;
      case 0x4: emu.h = v; return;
      case 0x5: emu.l = v; return;
      case 0x7: emu.a = v; return;
      case 0x6: emu.set_byte( emu.hl, v ); return;
    }
  }

  /**
   * Return the value of a register
   */
  var get_r = function( r )
  {
    switch ( r )
    {
      case 0x0: return emu.b;
      case 0x1: return emu.c;
      case 0x2: return emu.d;
      case 0x3: return emu.e;
      case 0x4: return emu.h;
      case 0x5: return emu.l;
      case 0x7: return emu.a;
      case 0x6: return emu.get_byte( emu.hl );
    }
  }


  /**
   * Set the value of a register pair
   */
  var set_rp = function( rr, v )
  {
    switch( rr )
    {
      case 0x0: emu.bc = v; return;
      case 0x1: emu.de = v; return;
      case 0x2: emu.hl = v; return;
      case 0x3: emu.sp = v; return;
    }
  }


  /**
   * Returns the value of a register pair
   */
  var get_rp = function( rr )
  {
    switch( rr )
    {
      case 0x0: return emu.bc;
      case 0x1: return emu.de;
      case 0x2: return emu.hl;
      case 0x3: return emu.sp;
    }
  }

  /**
   * Check a condition flag
   */
  var check_cond = function( y )
  {
    switch ( y )
    {
      case 0: return !emu.zf;
      case 1: return emu.zf;
      case 2: return !emu.cf;
      case 3: return emu.cf;
    }
  }

  /**
   * 8 bit arithmetic
   */
  var alu_8 = function( y, n )
  {
    var tmp;

    switch ( y )
    {
      // ADD n
      case 0:
      {
        tmp = emu.a + n;

        emu.zf = ( tmp & 0xFF ) == 0x00;
        emu.nf = false;
        emu.hf = ( tmp & 0x0F ) < ( emu.a & 0x0F );
        emu.cf = tmp > 0xFF;

        emu.a = tmp & 0xFF;
        return;
      }

      // ADC n
      case 1:
      {
        tmp = emu.a + n + ( emu.cf ? 1 : 0 );

        emu.zf = ( tmp & 0xFF ) == 0x00;
        emu.nf = false;
        emu.hf = ( emu.a & 0x0F ) + ( n & 0x0F ) + ( emu.cf ? 1 : 0 ) > 0x0F;
        emu.cf = tmp > 0xFF;

        emu.a = tmp & 0xFF;
        return;
      }

      // SUB n
      case 2:
      {
        tmp = emu.a - n;

        emu.zf = ( tmp & 0xFF ) == 0x00;
        emu.nf = true;
        emu.hf = ( emu.a & 0x0F ) < ( tmp & 0xF );
        emu.cf = tmp < 0x00;

        emu.a = tmp & 0xFF;
        return;
      }

      // SBC n
      case 3:
      {
        tmp = emu.a - n - ( emu.cf ? 1 : 0 );

        emu.zf = ( tmp & 0xFF ) == 0x00;
        emu.nf = true;
        emu.hf = ( emu.a & 0x0F ) - ( n & 0x0F ) - ( emu.cf ? 1 : 0 ) < 0x00;
        emu.cf = tmp < 0x00;

        emu.a = tmp & 0xFF;
        return;
      }

      // AND n
      case 4:
      {
        emu.a = ( emu.a & n ) & 0xFF;

        emu.zf = emu.a == 0x00;
        emu.nf = false;
        emu.hf = true;
        emu.cf = false;
        return;
      }

      // XOR n
      case 5:
      {
        emu.a = ( emu.a ^ n ) & 0xFF;

        emu.zf = emu.a == 0x00;
        emu.nf = false;
        emu.hf = false;
        emu.cf = false;
        return;
      }

      // OR n
      case 6:
      {
        emu.a = ( emu.a | n ) & 0xFF;

        emu.zf = emu.a == 0x00;
        emu.nf = false;
        emu.hf = false;
        emu.cf = false;
        return;
      }

      // CP n
      case 7:
      {
        tmp = emu.a - n;

        emu.zf = tmp == 0x00;
        emu.nf = true;
        emu.hf = ( tmp & 0x0F ) > ( emu.a & 0x0F );
        emu.cf = tmp < 0x00;
        return;
      }
    }
  }


  /**
   * 8 bit rotations
   */
  var alu_rot_8 = function( y, r )
  {
    var c;

    switch ( y )
    {
      // RLC n
      case 0x0:
        c = ( r & 0x80 ) >> 7;

        emu.cf = ( r & 0x80 ) != 0x00;
        emu.nf = false;
        emu.hf = false;

        r = ( ( r << 1 ) | c ) & 0xFF;

        emu.zf = r == 0x00;
        return r;

      // RRC n
      case 0x1:
        c = ( r & 0x01 ) << 7;

        emu.cf = ( r & 0x01 ) != 0x00;
        emu.nf = false;
        emu.hf = false;

        r = ( ( r >> 1 ) | c ) & 0xFF;

        emu.zf = r == 0x00;
        return r;

      // RL n
      case 0x2:
        c = emu.cf ? 0x01 : 0x00;

        emu.cf = ( r & 0x80 ) != 0x00;
        emu.nf = false;
        emu.hf = false;

        r = ( ( r << 1 ) | c ) & 0xFF;

        emu.zf = r == 0x00;
        return r;

      // RR n
      case 0x3:
        c = emu.cf ? 0x80 : 0x00;

        emu.cf = ( r & 0x01 ) != 0x00;
        emu.nf = false;
        emu.hf = false;

        r = ( ( r >> 1 ) | c ) & 0xFF;

        emu.zf = r == 0x00;
        return r;

      // SLA n
      case 0x4:
        emu.cf = ( r & 0x80 ) != 0x00;
        emu.nf = false;
        emu.hf = false;

        r = ( r << 1 ) & 0xFF;

        emu.zf = r == 0x00;
        return r;

      // SRA n
      case 0x5:
        emu.cf = ( r & 0x1 ) != 0x00;
        emu.nf = false;
        emu.hf = false;

        r = ( ( r >> 1 ) | ( r & 0x80 ) ) & 0xFF;

        emu.zf = r == 0x00;
        return r;

      // SWAP
      case 0x6:
        emu.cf = false;
        emu.nf = false;
        emu.hf = false;

        r = ( ( r & 0x0F ) << 4 ) | ( ( r & 0xF0 ) >> 4 );

        emu.zf = r == 0x00;
        return r;

      // SRL
      case 0x7:
        emu.cf = ( r & 0x01 ) != 0x00;
        emu.nf = false;
        emu.hf = false;

        r = ( r >> 1 ) & 0xFF;

        emu.zf = r == 0x00;
        return r;
    }
  }


  /**
   * Executes an instruction
   */
  var instr = function( op )
  {
    var x = ( op & 0xC0 ) >> 6;
    var y = ( op & 0x38 ) >> 3;
    var z = op & 7;
    var p = y >> 1;
    var q = y & 1;
    var r, c, tmp;

    var u8  = emu.get_byte( emu.pc );
    var s8  = alu_extend_8( u8 );
    var u16 = emu.get_word( emu.pc );
    var s16 = alu_extend_16( u16 );

    switch ( true )
    {
      // NOP
      case ( op == 0x00 ):
        emu.inc_cycles( 4 );
        return;

      // LD (bc), a
      case ( op == 0x02 ):
        emu.inc_cycles( 8 );
        emu.set_byte( emu.bc, emu.a );
        return;

      // RLCA
      case ( op == 0x07 ):
        emu.inc_cycles( 4 );

        c = emu.cf ? 0x01 : 0x00;

        emu.cf = ( emu.a & 0x80 ) != 0x00;
        emu.nf = false;
        emu.hf = false;
        emu.zf = false;

        emu.a = ( ( emu.a << 1 ) | ( ( emu.a & 0x80 ) >> 7 ) ) & 0xFF;
        return;

      // LD (nn), sp
      case ( op == 0x08 ):
        emu.inc_cycles( 20 );
        emu.pc += 2;
        emu.set_word( u16, emu.sp );
        return;

      // LD a, (bc)
      case ( op == 0x0A ):
        emu.inc_cycles( 8 );
        emu.a = emu.get_byte( emu.bc );
        return;

      // RRCA
      case ( op == 0x0F ):
        emu.inc_cycles( 4 );

        var c = emu.cf ? 0x80 : 0x00;

        emu.cf = ( emu.a & 0x01 ) != 0x00;
        emu.nf = false;
        emu.hf = false;
        emu.zf = false;

        emu.a = ( ( emu.a >> 1 ) | ( ( emu.a & 0x01 ) << 7 ) ) & 0xFF;

        return;

      // STOP
      case ( op == 0x10 ):
        emu.inc_cycles( 4 );
        emu.pc += 1;
        emu.stopped = true;
        return;

      // LD (de), a
      case ( op == 0x12 ):
        emu.inc_cycles( 8 );
        emu.set_byte( emu.de, emu.a );
        return;

      // LD a, (de)
      case ( op == 0x1A ):
        emu.inc_cycles( 8 );
        emu.a = emu.get_byte( emu.de );
        return;

      // RLA
      case ( op == 0x17 ):
        emu.inc_cycles( 4 );

        c = emu.cf ? 0x01 : 0x00;

        emu.cf = ( emu.a & 0x80 ) != 0x00;
        emu.nf = false;
        emu.hf = false;
        emu.zf = false;

        emu.a = ( ( emu.a << 1) | c ) & 0xFF;
        return;

      // RRA
      case ( op == 0x1F ):
        emu.inc_cycles( 4 );

        c = emu.cf ? 0x80 : 0x00;

        emu.cf = ( emu.a & 0x01 ) != 0x00;
        emu.nf = false;
        emu.hf = false;
        emu.zf = false;

        emu.a = ( ( emu.a >> 1) | c ) & 0xFF;
        return;

      // JR n
      case ( op == 0x18 ):
        emu.inc_cycles( 12 );
        emu.pc += 1;
        emu.pc = ( emu.pc + s8 ) & 0xFFFF;
        return;

      // LDI (hl), a
      case ( op == 0x22 ):
        emu.inc_cycles( 8 );
        emu.set_byte( emu.hl, emu.a );
        emu.hl = ( emu.hl + 1 ) & 0xFFFF;
        return;

      // DAA
      case ( op == 0x27 ):
        emu.inc_cycles( 4 );

        tmp = 0x00;
        if ( emu.nf )
        {
          if ( emu.cf && emu.hf )
          {
            emu.a = ( emu.a + 0x9A ) & 0xFF;
            emu.hf = false;
          }
          else if ( emu.cf )
          {
            emu.a = ( emu.a + 0xA0 ) & 0xFF;
          }
          else if ( emu.hf )
          {
            emu.a = ( emu.a + 0xFA ) & 0xFF;
            emu.hf = false;
          }
        }
        else
        {
          if ( emu.cf || emu.a > 0x99 )
          {
            emu.a = ( emu. a + 0x60 ) & 0xFF;
            emu.cf = true;
          }

          if ( emu.hf || ( emu.a & 0x0F) > 0x09 )
          {
            emu.a = ( emu.a + 0x06 ) & 0xFF;
            emu.hf = false;
          }
        }

        emu.zf = emu.a == 0x00;
        return;

      // CPL
      case ( op == 0x2F ):
        emu.inc_cycles( 4 );
        emu.a = ~emu.a;
        emu.nf = true;
        emu.hf = true;
        return;

      // LDI a, (hl)
      case ( op == 0x2A ):
        emu.inc_cycles( 8 );
        emu.a = emu.get_byte( emu.hl );
        emu.hl = ( emu.hl + 1 ) & 0xFFFF;
        return;

      // LDD (hl), a
      case ( op == 0x32 ):
        emu.inc_cycles( 8 );
        emu.set_byte( emu.hl, emu.a );
        emu.hl = ( emu.hl - 1 ) & 0xFFFF;
        return;

      // LDD a, (hl)
      case ( op == 0x3A ):
        emu.inc_cycles( 8 );
        emu.a = emu.get_byte( emu.hl );
        emu.hl = ( emu.hl - 1 ) & 0xFFFF;
        return;

      // SCF
      case ( op == 0x37 ):
        emu.inc_cycles( 4 );
        emu.nf = false;
        emu.hf = false;
        emu.cf = true;
        return;

      // CCF
      case ( op == 0x3F ):
        emu.inc_cycles( 4 );
        emu.nf = false;
        emu.hf = false;
        emu.cf = !emu.cf;
        return;

      // HALT
      case ( op == 0x76 ):
        emu.inc_cycles( 4 );
        emu.halted = true;
        return;

      // CALL nn
      case ( op == 0xCD ):
        emu.inc_cycles( 24 );
        emu.sp = ( emu.sp - 2 ) & 0xFFFF;
        emu.set_word( emu.sp, ( emu.pc + 2 ) & 0xFFFF );
        emu.pc = u16;
        return;

      // JP nn
      case ( op == 0xC3 ):
        emu.inc_cycles( 16 );
        emu.pc = u16;
        return;

      // RET
      case ( op == 0xC9 ):
        emu.inc_cycles( 16 );
        emu.pc = emu.get_word( emu.sp );
        emu.sp = ( emu.sp + 2 ) & 0xFFFF;
        return;

      // CB prefix
      case ( op == 0xCB ):
        op = emu.get_byte( emu.pc++ );
        x  = ( op & 0xC0 ) >> 6;
        y  = ( op & 0x38 ) >> 3;
        z  = ( op & 7 );

        if ( z == 0x6 )
        {
          emu.inc_cycles( x == 0x1 ? 8 : 12 );
          r = emu.get_byte( emu.hl );
          emu.inc_cycles( 4 );
        }
        else
        {
          emu.inc_cycles( 8 );
          r = get_r( z );
        }

        switch ( x )
        {
          // rot[ y ] r[ z ]
          case 0x0:
            set_r( z, alu_rot_8( y, r ) );
            return;

          // BIT y, r[ z ]
          case 0x1:
            emu.zf = ( get_r( z ) & ( 1 << y ) ) == 0x00;
            emu.nf = false;
            emu.hf = true;
            return;

          // RST y, r[ z ]
          case 0x2:
            set_r( z, r & ( ~ ( 1 << y ) ) );
            return;

          // SET y, r[ z ]
          case 0x3:
             set_r( z, r | ( 1 << y ) );
             return;
        }

        return;

      // LDH (n), a
      case ( op == 0xE0 ):
        emu.inc_cycles( 12 );
        emu.pc += 1;
        emu.set_byte( 0xFF00 + u8, emu.a );
        return;

      // LD (c), a
      case ( op == 0xE2 ):
        emu.inc_cycles( 8 );
        emu.set_byte( 0xFF00 + emu.c, emu.a );
        return;

      // ADD sp, n
      case ( op == 0xE8 ):
        emu.inc_cycles( 16 );
        emu.pc += 1;

        tmp = ( emu.sp + s8 ) & 0xFFFF;
        c = emu.sp ^ s8 ^ tmp;

        emu.zf = false;
        emu.nf = false;
        emu.hf = ( c & 0x0010 ) == 0x0010;
        emu.cf = ( c & 0x0100 ) == 0x0100;

        emu.sp = tmp;
        return;

      // JP (hl)
      case ( op == 0xE9 ):
        emu.inc_cycles( 4 );
        emu.pc = emu.hl;
        return;

      // LD (nn), a
      case ( op == 0xEA ):
        emu.inc_cycles( 16 );
        emu.pc += 2;
        emu.set_byte( u16, emu.a );
        return;

      // RETI
      case ( op == 0xD9 ):
        emu.inc_cycles( 16 );
        emu.pc = emu.get_word( emu.sp );
        emu.sp = ( emu.sp + 2 ) & 0xFFFF;
        emu.ime = true;
        return;

      // LDH a, (n)
      case ( op == 0xF0 ):
        emu.inc_cycles( 12 );
        emu.pc += 1;
        emu.a = emu.get_byte( 0xFF00 + u8 );
        return;

      // LD a, (c)
      case ( op == 0xF2 ):
        emu.inc_cycles( 8 );
        emu.a = emu.get_byte( 0xFF00 + emu.c );
        return;

      // DI
      case ( op == 0xF3 ):
        emu.inc_cycles( 4 );
        emu.ime = false;
        return;

      // LDHL sp, n
      case ( op == 0xF8 ):
        emu.inc_cycles( 12 );
        emu.pc += 1;

        tmp = ( emu.sp + s8 ) & 0xFFFF;
        c = emu.sp ^ s8 ^ tmp;

        emu.zf = false;
        emu.nf = false;
        emu.hf = ( c & 0x0010 ) == 0x0010;
        emu.cf = ( c & 0x0100 ) == 0x0100;

        emu.hl = tmp;
        return;

      // LD sp, hl
      case ( op == 0xF9 ):
        emu.inc_cycles( 8 );
        emu.sp = emu.hl;
        return;

      // EI
      case ( op == 0xFB ):
        emu.inc_cycles( 4 );
        emu.ime = true;
        return;

      // LD a, (nn)
      case ( op == 0xFA ):
        emu.inc_cycles( 16 );
        emu.pc += 2;
        emu.a = emu.get_byte( u16 );
        return;

      // LD r[y], r[z]
      case ( ( op & 0xC0 ) == 0x40 ):
        emu.inc_cycles( ( y == 0x6 || z == 0x6 ) ? 8 : 4 );
        set_r( y, get_r( z ) );
        return;

      // ALU[y] r[z]
      case ( ( op & 0xC0 ) == 0x80 ):
        emu.inc_cycles( z == 0x6 ? 8 : 4 );
        alu_8( y, get_r( z ) );
        return;

      // INC r[p]
      case ( ( op & 0xC7 ) == 0x04 ):
        if ( y == 0x6 )
        {
          emu.inc_cycles( 8 );
          r = emu.get_byte( emu.hl );
          emu.inc_cycles( 4 );
        }
        else
        {
          emu.inc_cycles( 4 );
          r = get_r( y );
        }

        r = ( r + 1 ) & 0xFF;

        emu.zf = r == 0x00;
        emu.nf = false;
        emu.hf = ( r & 0x0F ) == 0x00;

        set_r( y, r );
        return;

      // DEC r[p]
      case ( ( op & 0xC7 ) == 0x05 ):
        if ( y == 0x6 )
        {
          emu.inc_cycles( 8 );
          r = emu.get_byte( emu.hl );
          emu.inc_cycles( 4 );
        }
        else
        {
          emu.inc_cycles( 4 );
          r = get_r( y );
        }

        r = ( r - 1 ) & 0xFF;

        emu.zf = r == 0x00;
        emu.nf = true;
        emu.hf = ( r & 0x0F ) == 0x0F;

        set_r( y, r );
        return;

      // LD r[y], n
      case ( ( op & 0xC7 ) == 0x06 ):
        emu.inc_cycles( y == 0x6 ? 12 : 8 );
        emu.pc += 1;
        set_r( y, u8 );
        return;

      // ALU[y] n
      case ( ( op & 0xC7 ) == 0xC6 ):
        emu.inc_cycles( z == 0x6 ? 8 : 4 );
        emu.pc += 1;
        alu_8( y, u8 );
        return;

      // RST y * 8
      case ( ( op & 0xC7 ) == 0xC7 ):
        emu.inc_cycles( 16 );
        emu.sp = ( emu.sp - 2 ) & 0xFFFF;
        emu.set_word( emu.sp, emu.pc );
        emu.pc = y << 3;
        return;

      // LD rp[p], nn
      case ( ( op & 0xCF) == 0x01 ):
        emu.inc_cycles( 12 );
        emu.pc += 2;
        set_rp( p, u16 );
        return;

      // INC rp[p]
      case ( ( op & 0xCF ) == 0x03 ):
        emu.inc_cycles( 8 );
        set_rp( p, ( get_rp( p ) + 1 ) & 0xFFFF );
        return;

      // DEC rp[p]
      case ( ( op & 0xCF ) == 0x0B ):
        emu.inc_cycles( 8 );
        set_rp( p, ( get_rp( p ) - 1 ) & 0xFFFF );
        return;

      // ADD hl, rp[p]
      case ( ( op & 0xCF ) == 0x09 ):
        emu.inc_cycles( 8 );

        tmp = emu.hl + get_rp( p );

        emu.nf = false;
        emu.hf = ( emu.hl & 0x0FFF ) > ( tmp & 0x0FFF );
        emu.cf = tmp > 0xFFFF;

        emu.hl = tmp & 0xFFFF;
        return;

      // POP rp[p]
      case ( ( op & 0xCF ) == 0xC1 ):
        emu.inc_cycles( 12 );

        switch ( p ) {
          case 0x0: emu.bc = emu.get_word( emu.sp ); break;
          case 0x1: emu.de = emu.get_word( emu.sp ); break;
          case 0x2: emu.hl = emu.get_word( emu.sp ); break;
          case 0x3: emu.af = emu.get_word( emu.sp ); break;
        }
        emu.sp = ( emu.sp + 2 ) & 0xFFFF;
        return;

      // PUSH rp[p]
      case ( ( op & 0xCF ) == 0xC5 ):
        emu.inc_cycles( 16 );
        emu.sp = ( emu.sp - 2 ) & 0xFFFF;

        switch ( p ) {
          case 0x0: emu.set_word( emu.sp, emu.bc ); break;
          case 0x1: emu.set_word( emu.sp, emu.de ); break;
          case 0x2: emu.set_word( emu.sp, emu.hl ); break;
          case 0x3: emu.set_word( emu.sp, emu.af ); break;
        }
        return;

      // JR cc, n
      case ( ( op & 0xE7 ) == 0x20 ):
        emu.inc_cycles( 8 );
        emu.pc += 1;

        if ( check_cond( y - 4 ) ) {
          emu.inc_cycles( 4 );
          emu.pc = ( emu.pc + s8 ) & 0xFFFF;
        }

        return;

      // RET cc
      case ( ( op & 0xE7 ) == 0xC0 ):
        emu.inc_cycles( 8 );

        if ( check_cond( y ) ) {
          emu.inc_cycles( 12 );
          emu.pc = emu.get_word( emu.sp );
          emu.sp = ( emu.sp + 2 ) & 0xFFFF;
        }

        return;

      // JP cc, nn
      case ( ( op & 0xE7 ) == 0xC2 ):
        emu.inc_cycles( 12 );
        emu.pc += 2;

        if ( check_cond( y ) ) {
          emu.inc_cycles( 4 );
          emu.pc = u16;
        }

        return;

      // CALL cc[y], nn
      case ( ( op & 0xE7 ) == 0xC4 ):
        emu.inc_cycles( 12 );
        emu.pc += 2;

        if ( check_cond( y ) ) {
          emu.inc_cycles( 12 );
          emu.sp = ( emu.sp - 2 ) & 0xFFFF;
          emu.set_word( emu.sp, emu.pc & 0xFFFF );
          emu.pc = u16;
        }

        return;
    }
  }

  /**
    * Executes a single CPU operation
    */
  emu.tick = function( )
  {
    // VBlank interrupt
    if ( emu.ifVBlank )
    {
      emu.halted = false;
      if ( emu.ime && emu.ieVBlank )
      {
        emu.ime = false;
        emu.ifVBlank = false;
        interrupt( 0x0040 );
      }
    }

    // Stat
    if ( emu.ifStat )
    {
      emu.halte = false;
      if ( emu.ime && emu.ifStat )
      {
        emu.ime = false;
        emu.ifStat = false;
        interrupt( 0x0048 );
      }
    }

    // Timer interrupt
    if ( emu.ifTimer )
    {
      emu.halted = false;
      if ( emu.ime && emu.ieTimer )
      {
        emu.ime = false;
        emu.ifTimer = false;
        interrupt( 0x0050 );
      }
    }

    // Pin interrupt
    if ( emu.ifPins )
    {
      emu.halted = false;
      if ( emu.ime && emu.iePins )
      {
        emu.ime = false;
        emu.ifPins = false;
        interrupt( 0x0060 );
      }
    }

    // Run an instruction
    if ( emu.halted )
    {
      emu.inc_cycles( 4 );
    }
    else
    {
      instr( emu.get_byte( emu.pc++ ) );
    }

    switch ( emu.lcd_stat_mode )
    {
      // HBlank
      case 0x0:
      {
        if ( emu.lcd_cycles >= 204 )
        {
          emu.lcd_cycles -= 204;
          emu.lcd_ly++;

          // VBlank start
          if ( emu.lcd_ly > 143 )
          {
            emu.lcd_vblank( );
            emu.ifVBlank = true;
            emu.lcd_stat_mode = 0x1;
            emu.ifStat |= emu.lcd_stat_vblank;
          }
          else
          {
            emu.lcd_scanline( );
            emu.lcd_stat_mode = 0x2;
          }
        }
        break;
      }
      // VBlank
      case 0x1:
      {
        if ( emu.lcd_cycles >= 456 )
        {
          emu.lcd_cycles -= 456;
          emu.lcd_ly++;

          if ( emu.lcd_ly > 153 )
          {
            emu.lcd_ly = 0;
            emu.wait = true;
            emu.lcd_stat_mode = 0x02;
            emu.ifStat |= emu.lcd_stat_oam;
          }
        }
        break;
      }
      // OAM read
      case 0x2:
      {
        if ( emu.lcd_cycles >= 80 )
        {
          emu.lcd_cycles -= 80;
          emu.lcd_stat_mode = 0x3;
          emu.ifStat |= emu.lcd_stat_hblank;
        }
        break;
      }
      // VRAM read
      case 0x3:
      {
        if ( emu.lcd_cycles >= 172 )
        {
          emu.lcd_cycles -= 172;
          emu.lcd_stat_mode = 0x0;
        }
        break;
      }
    }

    emu.lcd_stat_equ = emu.lcd_ly == emu.lcd_lyc;
    if ( emu.lcd_stat_equ )
    {
      emu.ifStat |= emu.lcd_stat_lyc;
    }
  }
} ) ( this.emu = this.emu || { } );
