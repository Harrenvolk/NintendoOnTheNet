( function( emu )
{
  /**
   * MBC2 cartridge
   */
  emu.MBC2 = function( rom )
  {
    this.rom = rom;
  }

  /**
   * MBC2 control register write
   */
  emu.MBC2.prototype.set_byte = function( addr, val )
  {

  }

  /**
   * MBC2 control register read
   */
  emu.MBC2.prototype.get_byte = function( addr )
  {

  }
} ) ( this.emu = this.emu || { } );
