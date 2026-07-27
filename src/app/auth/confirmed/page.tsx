export default function ConfirmedPage() {
  return (
    <main className="page-shell page-shell--auth page-center">
      <section className="card confirmation-card" role="status">
        <div className="confirmation-card__icon" aria-hidden>✓</div>
        <h1>이메일 인증 완료!</h1>
        <p>
          이 창은 닫아도 돼요.<br />가입하던 창으로 돌아가 <strong>“인증 확인”</strong> 버튼을 눌러주세요.
        </p>
      </section>
    </main>
  );
}
