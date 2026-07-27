import { describe, expect, it } from "vitest";
import { computeReminderStage, stageLabel } from "./reminders";

const NOW = new Date("2026-07-27T12:00:00Z");

function dueInHours(hours: number): string {
  return new Date(NOW.getTime() + hours * 60 * 60 * 1000).toISOString();
}

describe("computeReminderStage", () => {
  it("마감까지 24시간 넘게 남으면 0단계(알림 없음)", () => {
    expect(computeReminderStage(dueInHours(30), NOW)).toBe(0);
  });

  it("24시간 이내면 1단계", () => {
    expect(computeReminderStage(dueInHours(23), NOW)).toBe(1);
    expect(computeReminderStage(dueInHours(7), NOW)).toBe(1);
  });

  it("6시간 이내면 2단계", () => {
    expect(computeReminderStage(dueInHours(6), NOW)).toBe(2);
    expect(computeReminderStage(dueInHours(3.5), NOW)).toBe(2);
  });

  it("3시간 이내면 3단계", () => {
    expect(computeReminderStage(dueInHours(3), NOW)).toBe(3);
    expect(computeReminderStage(dueInHours(1.5), NOW)).toBe(3);
  });

  it("1시간 이내면 4단계", () => {
    expect(computeReminderStage(dueInHours(1), NOW)).toBe(4);
    expect(computeReminderStage(dueInHours(0.1), NOW)).toBe(4);
  });

  it("마감이 지났으면 0단계(알림 안 보냄)", () => {
    expect(computeReminderStage(dueInHours(-1), NOW)).toBe(0);
  });

  it("마감이 없으면 0단계", () => {
    expect(computeReminderStage(null, NOW)).toBe(0);
  });
});

describe("stageLabel", () => {
  it("단계별 알림 제목을 만든다", () => {
    expect(stageLabel(1)).toContain("하루");
    expect(stageLabel(2)).toContain("6시간");
    expect(stageLabel(3)).toContain("3시간");
    expect(stageLabel(4)).toContain("1시간");
  });
});
