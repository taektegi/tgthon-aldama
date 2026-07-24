import { beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";

// 금고(암호화) 테스트: 넣은 것이 그대로 나오는지, 매번 다르게 잠기는지, 변조를 눈치채는지
beforeAll(() => {
  process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("encryptSecret/decryptSecret", () => {
  it("암호화 후 복호화하면 원문이 나온다", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const secret = "canvas-token-1234~ABC";
    const cipher = encryptSecret(secret);
    expect(cipher).not.toContain(secret);
    expect(decryptSecret(cipher)).toBe(secret);
  });

  it("같은 평문도 매번 다른 암호문 (IV 무작위)", async () => {
    const { encryptSecret } = await import("./crypto");
    expect(encryptSecret("a")).not.toBe(encryptSecret("a"));
  });

  it("변조된 암호문은 복호화가 실패한다", async () => {
    const { encryptSecret, decryptSecret } = await import("./crypto");
    const cipher = encryptSecret("a");
    const tampered = Buffer.from(cipher, "base64");
    tampered[tampered.length - 1] ^= 1;
    expect(() => decryptSecret(tampered.toString("base64"))).toThrow();
  });
});
