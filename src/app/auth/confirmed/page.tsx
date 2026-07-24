export default function ConfirmedPage() {
  return (
    <main className="shell" style={{ padding: "96px 0" }}>
      <section className="card" style={{ maxWidth: 440, margin: "0 auto", padding: 36, textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
        <div style={{ fontSize: 56 }} aria-hidden>✅</div>
        <h1 style={{ margin: 0, fontSize: 26 }}>이메일 인증 완료!</h1>
        <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
          이 창은 닫아도 돼요.<br />가입하던 창으로 돌아가 <strong>“인증 확인”</strong> 버튼을 눌러주세요.
        </p>
      </section>
    </main>
  );
}
