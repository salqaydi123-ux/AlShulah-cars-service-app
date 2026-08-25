import { loginAction } from '@/lib/actions/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const hasError = params.error === '1';
  const next = params.next || '/';

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>الشعلة لخدمة السيارات</h1>
        <div className="en">AL SHULAH CARS SERVICE — كلباء</div>
        <form action={loginAction}>
          <input type="hidden" name="next" value={next} />
          <div className="field" style={{ textAlign: 'right' }}>
            <label>كلمة المرور / Password</label>
            <input type="password" name="password" placeholder="••••••••" autoFocus required />
          </div>
          <button type="submit" className="submit-btn">
            دخول / Login
          </button>
          {hasError && <div className="login-error">كلمة المرور غير صحيحة / Incorrect password</div>}
        </form>
      </div>
    </div>
  );
}
