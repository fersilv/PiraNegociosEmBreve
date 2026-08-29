import React, { useMemo } from 'react';

type QrConfig = {
  version: number;
  size: number;
  dataCodewords: number;
  eccCodewords: number;
  blockDataLengths: number[];
  maxByteLength: number;
  alignmentCenters: number[];
  byteCountBits: number;
};

const QR_CONFIGS: QrConfig[] = [
  {
    version: 6,
    size: 41,
    dataCodewords: 136,
    eccCodewords: 18,
    blockDataLengths: [68, 68],
    maxByteLength: 134,
    alignmentCenters: [6, 34],
    byteCountBits: 8,
  },
  {
    // Versão 10-L comporta até 271 bytes em byte mode. Isso cobre os
    // payloads BR Code do Pix Automático sem depender de serviço externo.
    version: 10,
    size: 57,
    dataCodewords: 274,
    eccCodewords: 18,
    blockDataLengths: [68, 68, 69, 69],
    maxByteLength: 271,
    alignmentCenters: [6, 28, 50],
    byteCountBits: 16,
  },
];

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

const RS_GENERATORS = new Map<number, number[]>();

function reedSolomonRemainder(data: number[], eccCodewords: number) {
  const generator = RS_GENERATORS.get(eccCodewords) || reedSolomonGenerator(eccCodewords);
  RS_GENERATORS.set(eccCodewords, generator);
  const remainder = new Array<number>(eccCodewords).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < eccCodewords; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }
  return remainder;
}

function appendBits(target: boolean[], number: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1) target.push(((number >>> bit) & 1) !== 0);
}

function selectConfig(text: string) {
  const byteLength = new TextEncoder().encode(text).length;
  const config = QR_CONFIGS.find((item) => byteLength <= item.maxByteLength);
  if (!config) {
    throw new Error('O conteúdo ficou grande demais para o QR Code local. Use o código copia e cola.');
  }
  return config;
}

function encodeCodewords(text: string, config: QrConfig) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const bits: boolean[] = [];
  appendBits(bits, 0b0100, 4); // byte mode
  appendBits(bits, bytes.length, config.byteCountBits);
  bytes.forEach((byte) => appendBits(bits, byte, 8));

  const capacity = config.dataCodewords * 8;
  const terminatorLength = Math.min(4, Math.max(0, capacity - bits.length));
  for (let index = 0; index < terminatorLength; index += 1) bits.push(false);
  while (bits.length % 8) bits.push(false);

  const data: number[] = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | (bits[offset + bit] ? 1 : 0);
    data.push(byte);
  }
  let useFirstPad = true;
  while (data.length < config.dataCodewords) {
    data.push(useFirstPad ? 0xec : 0x11);
    useFirstPad = !useFirstPad;
  }

  const blocks: number[][] = [];
  let offset = 0;
  for (const length of config.blockDataLengths) {
    blocks.push(data.slice(offset, offset + length));
    offset += length;
  }
  const eccBlocks = blocks.map((block) => reedSolomonRemainder(block, config.eccCodewords));
  const result: number[] = [];
  const longestDataBlock = Math.max(...config.blockDataLengths);
  for (let index = 0; index < longestDataBlock; index += 1) {
    blocks.forEach((block) => {
      if (index < block.length) result.push(block[index]);
    });
  }
  for (let index = 0; index < config.eccCodewords; index += 1) {
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

function bchVersionBits(version: number) {
  const generator = 0x1f25;
  let remainder = version << 12;
  while (remainder.toString(2).length >= generator.toString(2).length) {
    remainder ^= generator << (remainder.toString(2).length - generator.toString(2).length);
  }
  return (version << 12) | remainder;
}

function createMatrix(text: string) {
  const config = selectConfig(text);
  const size = config.size;
  const modules = Array.from({ length: size }, () => new Array<boolean | null>(size).fill(null));

  const drawFinder = (row: number, column: number) => {
    for (let rowOffset = -1; rowOffset <= 7; rowOffset += 1) {
      const currentRow = row + rowOffset;
      if (currentRow < 0 || currentRow >= size) continue;
      for (let columnOffset = -1; columnOffset <= 7; columnOffset += 1) {
        const currentColumn = column + columnOffset;
        if (currentColumn < 0 || currentColumn >= size) continue;
        modules[currentRow][currentColumn] =
          (rowOffset >= 0 && rowOffset <= 6 && (columnOffset === 0 || columnOffset === 6)) ||
          (columnOffset >= 0 && columnOffset <= 6 && (rowOffset === 0 || rowOffset === 6)) ||
          (rowOffset >= 2 && rowOffset <= 4 && columnOffset >= 2 && columnOffset <= 4);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);

  config.alignmentCenters.forEach((row) => {
    config.alignmentCenters.forEach((column) => {
      if (modules[row][column] !== null) return;
      for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
        for (let columnOffset = -2; columnOffset <= 2; columnOffset += 1) {
          modules[row + rowOffset][column + columnOffset] = Math.max(Math.abs(rowOffset), Math.abs(columnOffset)) !== 1;
        }
      }
    });
  });

  for (let row = 8; row < size - 8; row += 1) {
    if (modules[row][6] === null) modules[row][6] = row % 2 === 0;
  }
  for (let column = 8; column < size - 8; column += 1) {
    if (modules[6][column] === null) modules[6][column] = column % 2 === 0;
  }

  // Error correction L (01) and mask 0 (000).
  const formatBits = bchFormatBits(0b01000);
  for (let index = 0; index < 15; index += 1) {
    const dark = ((formatBits >>> index) & 1) !== 0;
    if (index < 6) modules[index][8] = dark;
    else if (index < 8) modules[index + 1][8] = dark;
    else modules[size - 15 + index][8] = dark;

    if (index < 8) modules[8][size - index - 1] = dark;
    else if (index < 9) modules[8][15 - index] = dark;
    else modules[8][14 - index] = dark;
  }
  modules[size - 8][8] = true;

  if (config.version >= 7) {
    const versionBits = bchVersionBits(config.version);
    for (let index = 0; index < 18; index += 1) {
      const dark = ((versionBits >>> index) & 1) !== 0;
      const row = Math.floor(index / 3);
      const column = (index % 3) + size - 11;
      modules[row][column] = dark;
      modules[column][row] = dark;
    }
  }

  const codewords = encodeCodewords(text, config);
  let byteIndex = 0;
  let bitIndex = 7;
  let row = size - 1;
  let direction = -1;

  for (let column = size - 1; column > 0; column -= 2) {
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
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  return modules as boolean[][];
}

export function LocalQrCode({ value, className = '', label = 'QR Code' }: { value: string; className?: string; label?: string }) {
  const matrix = useMemo(() => createMatrix(value), [value]);
  const viewSize = matrix.length + QUIET_ZONE * 2;
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
      aria-label={label}
      className={className}
      shapeRendering="crispEdges"
    >
      <rect width={viewSize} height={viewSize} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
