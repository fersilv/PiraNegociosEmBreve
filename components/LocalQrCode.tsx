import React, { useMemo } from 'react';

const VERSION = 6;
const SIZE = 17 + VERSION * 4;
const DATA_CODEWORDS = 136;
const BLOCK_DATA_CODEWORDS = 68;
const ECC_CODEWORDS = 18;
const MAX_BYTE_LENGTH = 134;
const QUIET_ZONE = 4;

const GF_EXP = new Array<number>(512).fill(0);
const GF_LOG = new Array<number>(256).fill(0);
let value = 1;
for (let index = 0; index < 255; index += 1) {
  GF_EXP[index] = value;
  GF_LOG[value] = index;
  value <<= 1;
  if (value & 0x100) value ^= 0x11d;
}
for (let index = 255; index < 512; index += 1) GF_EXP[index] = GF_EXP[index - 255];

function gfMultiply(left: number, right: number) {
  if (!left || !right) return 0;
  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

function reedSolomonGenerator(degree: number) {
  let polynomial = [1];
  for (let power = 0; power < degree; power += 1) {
    const next = new Array<number>(polynomial.length + 1).fill(0);
    polynomial.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMultiply(coefficient, GF_EXP[power]);
    });
    polynomial = next;
  }
  return polynomial;
}

const RS_GENERATOR = reedSolomonGenerator(ECC_CODEWORDS);

function reedSolomonRemainder(data: number[]) {
  const remainder = new Array<number>(ECC_CODEWORDS).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < ECC_CODEWORDS; index += 1) {
      remainder[index] ^= gfMultiply(RS_GENERATOR[index + 1], factor);
    }
  }
  return remainder;
}

function appendBits(target: boolean[], number: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1) target.push(((number >>> bit) & 1) !== 0);
}

function encodeCodewords(text: string) {
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > MAX_BYTE_LENGTH) {
    throw new Error('A URL desta sessão ficou grande demais para o QR Code local. Gere uma nova sessão.');
  }

  const bits: boolean[] = [];
  appendBits(bits, 0b0100, 4); // byte mode
  appendBits(bits, bytes.length, 8); // versions 1-9 use 8-bit byte count
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacity = DATA_CODEWORDS * 8;
  const terminatorLength = Math.min(4, capacity - bits.length);
  for (let index = 0; index < terminatorLength; index += 1) bits.push(false);
  while (bits.length % 8) bits.push(false);

  const data: number[] = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | (bits[offset + bit] ? 1 : 0);
    data.push(byte);
  }
  let useFirstPad = true;
  while (data.length < DATA_CODEWORDS) {
    data.push(useFirstPad ? 0xec : 0x11);
    useFirstPad = !useFirstPad;
  }

  const blocks = [
    data.slice(0, BLOCK_DATA_CODEWORDS),
    data.slice(BLOCK_DATA_CODEWORDS, BLOCK_DATA_CODEWORDS * 2),
  ];
  const eccBlocks = blocks.map(reedSolomonRemainder);
  const result: number[] = [];
  for (let index = 0; index < BLOCK_DATA_CODEWORDS; index += 1) {
    blocks.forEach((block) => result.push(block[index]));
  }
  for (let index = 0; index < ECC_CODEWORDS; index += 1) {
    eccBlocks.forEach((block) => result.push(block[index]));
  }
  return result;
}

function bchFormatBits(data: number) {
  const generator = 0x537;
  let remainder = data << 10;
  while (remainder.toString(2).length >= generator.toString(2).length) {
    remainder ^= generator << (remainder.toString(2).length - generator.toString(2).length);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function createMatrix(text: string) {
  const modules = Array.from({ length: SIZE }, () => new Array<boolean | null>(SIZE).fill(null));

  const drawFinder = (row: number, column: number) => {
    for (let rowOffset = -1; rowOffset <= 7; rowOffset += 1) {
      const currentRow = row + rowOffset;
      if (currentRow < 0 || currentRow >= SIZE) continue;
      for (let columnOffset = -1; columnOffset <= 7; columnOffset += 1) {
        const currentColumn = column + columnOffset;
        if (currentColumn < 0 || currentColumn >= SIZE) continue;
        modules[currentRow][currentColumn] =
          (rowOffset >= 0 && rowOffset <= 6 && (columnOffset === 0 || columnOffset === 6)) ||
          (columnOffset >= 0 && columnOffset <= 6 && (rowOffset === 0 || rowOffset === 6)) ||
          (rowOffset >= 2 && rowOffset <= 4 && columnOffset >= 2 && columnOffset <= 4);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(SIZE - 7, 0);
  drawFinder(0, SIZE - 7);

  const alignmentCenters = [6, 34];
  alignmentCenters.forEach((row) => {
    alignmentCenters.forEach((column) => {
      if (modules[row][column] !== null) return;
      for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
        for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
          modules[row + rowOffset][column + columnOffset] = Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== 1;
        }
      }
    });
  });

  for (let row = 8; row < SIZE - 8; row += 1) {
    if (modules[row][6] === null) modules[row][6] = row % 2 === 0;
  }
  for (let column = 8; column < SIZE - 8; column += 1) {
    if (modules[6][column] === null) modules[6][column] = column % 2 === 0;
  }

  // Error correction L (01) and mask 0 (000).
  const formatBits = bchFormatBits(0b01000);
  for (let index = 0; index < 15; index += 1) {
    const dark = ((formatBits >>> index) & 1) !== 0;
    if (index < 6) modules[index][8] = dark;
    else if (index < 8) modules[index + 1][8] = dark;
    else modules[SIZE - 15 + index][8] = dark;

    if (index < 8) modules[8][SIZE - index - 1] = dark;
    else if (index < 9) modules[8][15 - index] = dark;
    else modules[8][14 - index] = dark;
  }
  modules[SIZE - 8][8] = true;

  const codewords = encodeCodewords(text);
  let byteIndex = 0;
  let bitIndex = 7;
  let row = SIZE - 1;
  let direction = -1;

  for (let column = SIZE - 1; column > 0; column -= 2) {
    if (column === 6) column -= 1;
    while (true) {
      for (let offset = 0; offset < 2; offset += 1) {
        const currentColumn = column - offset;
        if (modules[row][currentColumn] !== null) continue;
        let dark = false;
        if (byteIndex < codewords.length) dark = ((codewords[byteIndex] >>> bitIndex) & 1) !== 0;
        if ((row + currentColumn) % 2 === 0) dark = !dark; // mask 0
        modules[row][currentColumn] = dark;
        bitIndex -= 1;
        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }
      row += direction;
      if (row < 0 || row >= SIZE) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  return modules as boolean[][];
}

export function LocalQrCode({ value, className = '' }: { value: string; className?: string }) {
  const matrix = useMemo(() => createMatrix(value), [value]);
  const viewSize = SIZE + QUIET_ZONE * 2;
  const path = useMemo(() => {
    const segments: string[] = [];
    matrix.forEach((row, rowIndex) => {
      row.forEach((dark, columnIndex) => {
        if (dark) segments.push(`M${columnIndex + QUIET_ZONE} ${rowIndex + QUIET_ZONE}h1v1h-1z`);
      });
    });
    return segments.join('');
  }, [matrix]);

  return (
    <svg
      viewBox={`0 0 ${viewSize} ${viewSize}`}
      role="img"
      aria-label="QR Code da sessão temporária"
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={viewSize} height={viewSize} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
