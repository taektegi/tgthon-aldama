// 토큰 등 비밀값을 DB에 넣기 전 AES-256-GCM으로 암호화한다.
// DB가 통째로 유출돼도 금고 열쇠(TOKEN_ENCRYPTION_KEY, 환경변수)가 없으면 열 수 없다.
// 저장 형식: base64( IV(12바이트) | 인증태그(16바이트) | 암호문 )
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)");
  return buf;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12); // 매번 다른 시작값 → 같은 평문도 매번 다른 암호문
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptSecret(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  if (buf.length < 29) throw new Error("Encrypted secret is invalid");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28); // 변조 감지용 봉인 스티커
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
