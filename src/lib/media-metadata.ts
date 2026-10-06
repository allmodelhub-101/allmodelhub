export type MediaMetadata = { duration: number; width?: number; height?: number; fps?: number };

export function validateSeedanceReferenceVideoMetadata(metadata: MediaMetadata) {
  if (!metadata.width || !metadata.height || !metadata.fps
    || metadata.width < 300 || metadata.width > 6000 || metadata.height < 300 || metadata.height > 6000
    || metadata.width / metadata.height < 0.4 || metadata.width / metadata.height > 2.5
    || metadata.width * metadata.height < 407696 || metadata.width * metadata.height > 8295044
    || metadata.fps < 24 || metadata.fps > 60) {
    throw new Error("MEDIA_OPTION_UNSUPPORTED:reference_video_specs");
  }
}

// Read source duration from the uploaded bytes, never a browser-provided value.
export function inspectMediaBytes(bytes: Uint8Array, type: "video/mp4" | "audio/wav" | "audio/mpeg"): MediaMetadata {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (start: number, count: number) => new TextDecoder().decode(bytes.subarray(start, start + count));
  let duration = 0;
  let width: number | undefined, height: number | undefined, fps: number | undefined;
  if (type === "video/mp4") {
    if (bytes.length < 16 || text(4, 4) !== "ftyp") throw new Error("MEDIA_FILE_INVALID");
    type TrackContext = { kind: "unknown" | "video" | "other"; timescale?: number };
    const scan = (start: number, end: number, depth: number, context?: TrackContext) => {
      if (depth > 8) throw new Error("MEDIA_FILE_INVALID");
      for (let offset = start; offset + 8 <= end;) {
        let size = view.getUint32(offset);
        let header = 8;
        if (size === 1) { if (offset + 16 > end) throw new Error("MEDIA_FILE_INVALID"); size = Number(view.getBigUint64(offset + 8)); header = 16; }
        if (size === 0) size = end - offset;
        if (!Number.isSafeInteger(size) || size < header || offset + size > end) throw new Error("MEDIA_FILE_INVALID");
        const kind = text(offset + 4, 4), body = offset + header;
        const childContext = kind === "trak" ? { kind: "unknown" as const } : context;
        if (["moov", "trak", "mdia", "minf", "stbl"].includes(kind)) scan(body, offset + size, depth + 1, childContext);
        if (kind === "mvhd" || kind === "mdhd") {
          const v1 = bytes[body] === 1, timescaleOffset = body + (v1 ? 20 : 12);
          if (timescaleOffset + (v1 ? 12 : 8) > offset + size) throw new Error("MEDIA_FILE_INVALID");
          const scale = view.getUint32(timescaleOffset);
          const ticks = v1 ? Number(view.getBigUint64(timescaleOffset + 4)) : view.getUint32(timescaleOffset + 4);
          if (!scale || !Number.isSafeInteger(ticks)) throw new Error("MEDIA_FILE_INVALID");
          duration = Math.max(duration, ticks / scale);
          if (kind === "mdhd" && context) context.timescale = scale;
        }
        if (kind === "hdlr" && context && body + 12 <= offset + size) {
          const handler = text(body + 8, 4);
          context.kind = handler === "vide" ? "video" : "other";
        }
        if (kind === "tkhd" && size >= 84) {
          const w = view.getUint32(offset + size - 8) / 65536, h = view.getUint32(offset + size - 4) / 65536;
          if (w && h) { width = w; height = h; }
        }
        if (kind === "stts" && context?.kind === "video" && context.timescale && body + 8 <= offset + size) {
          const entryCount = view.getUint32(body + 4);
          let samples = 0, ticks = 0, cursor = body + 8;
          for (let index = 0; index < entryCount; index++) {
            if (cursor + 8 > offset + size) throw new Error("MEDIA_FILE_INVALID");
            const count = view.getUint32(cursor), delta = view.getUint32(cursor + 4);
            samples += count; ticks += count * delta; cursor += 8;
          }
          const candidate = samples * context.timescale / ticks;
          if (Number.isFinite(candidate) && candidate > 0) fps = candidate;
        }
        offset += size;
      }
    };
    scan(0, bytes.length, 0);
  } else if (type === "audio/wav") {
    if (text(0, 4) !== "RIFF" || text(8, 4) !== "WAVE") throw new Error("MEDIA_FILE_INVALID");
    let byteRate = 0, dataBytes = 0;
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const size = view.getUint32(offset + 4, true);
      if (offset + 8 + size > bytes.length) throw new Error("MEDIA_FILE_INVALID");
      if (text(offset, 4) === "fmt " && size >= 16) byteRate = view.getUint32(offset + 16, true);
      if (text(offset, 4) === "data") dataBytes += size;
      offset += 8 + size + (size % 2);
    }
    duration = dataBytes / byteRate;
  } else {
    let offset = 0, frames = 0;
    if (text(0, 3) === "ID3") {
      if (bytes.length < 10 || bytes.slice(6, 10).some((v) => v > 127)) throw new Error("MEDIA_FILE_INVALID");
      offset = 10 + bytes[6] * 2097152 + bytes[7] * 16384 + bytes[8] * 128 + bytes[9];
    }
    const rates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const lowRates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    while (offset + 4 <= bytes.length) {
      if (text(offset, 3) === "TAG" && bytes.length - offset === 128) break;
      const header = view.getUint32(offset);
      if ((header >>> 21) !== 2047) throw new Error("MEDIA_FILE_INVALID");
      const version = (header >>> 19) & 3, layer = (header >>> 17) & 3;
      const rateIndex = (header >>> 12) & 15, sampleIndex = (header >>> 10) & 3;
      if (version === 1 || layer !== 1 || !rateIndex || rateIndex === 15 || sampleIndex === 3) throw new Error("MEDIA_FILE_INVALID");
      const sampleRate = [44100, 48000, 32000][sampleIndex] / (version === 3 ? 1 : version === 2 ? 2 : 4);
      const bitrate = (version === 3 ? rates : lowRates)[rateIndex] * 1000;
      const frameBytes = Math.floor((version === 3 ? 144 : 72) * bitrate / sampleRate) + ((header >>> 9) & 1);
      if (offset + frameBytes > bytes.length) throw new Error("MEDIA_FILE_INVALID");
      duration += (version === 3 ? 1152 : 576) / sampleRate;
      frames++; offset += frameBytes;
    }
    if (!frames) throw new Error("MEDIA_FILE_INVALID");
  }
  if (!Number.isFinite(duration) || duration <= 0 || duration > 3600) throw new Error("MEDIA_DURATION_UNAVAILABLE");
  return { duration, ...(width && height ? { width, height } : {}), ...(fps ? { fps } : {}) };
}

