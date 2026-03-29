import { verificationCodeTemplate } from '../../email/templates/verification-code.template';

describe('verificationCodeTemplate', () => {
  const baseContext = { appName: 'PITCH' };

  it('renders subject with app name', () => {
    const result = verificationCodeTemplate({ code: '123456' }, baseContext);
    expect(result.subject).toBe('PITCH - Verification Code');
  });

  it('includes the verification code in the html', () => {
    const result = verificationCodeTemplate({ code: '654321' }, baseContext);
    expect(result.html).toContain('654321');
  });

  it('includes the verification code in the text body', () => {
    const result = verificationCodeTemplate({ code: '654321' }, baseContext);
    expect(result.text).toContain('Code: 654321');
  });

  it('shows "Sign-in verification" headline for default (login) purpose', () => {
    const result = verificationCodeTemplate(
      { code: '111111', purpose: 'login' },
      baseContext,
    );
    expect(result.html).toContain('Sign-in verification');
  });

  it('shows "Finish creating your account" headline for register purpose', () => {
    const result = verificationCodeTemplate(
      { code: '222222', purpose: 'register' },
      baseContext,
    );
    expect(result.html).toContain('Finish creating your account');
  });

  it('shows "Admin sign-in verification" headline for admin purpose', () => {
    const result = verificationCodeTemplate(
      { code: '333333', purpose: 'admin' },
      baseContext,
    );
    expect(result.html).toContain('Admin sign-in verification');
  });

  it('defaults to "Sign-in verification" when purpose is not provided', () => {
    const result = verificationCodeTemplate({ code: '444444' }, baseContext);
    expect(result.html).toContain('Sign-in verification');
  });

  it('defaults expiresMinutes to 10 when not provided', () => {
    const result = verificationCodeTemplate({ code: '555555' }, baseContext);
    expect(result.html).toContain('expires in 10 minutes');
    expect(result.text).toContain('Expires in 10 minutes');
  });

  it('uses provided expiresMinutes value', () => {
    const result = verificationCodeTemplate(
      { code: '666666', expiresMinutes: 5 },
      baseContext,
    );
    expect(result.html).toContain('expires in 5 minutes');
    expect(result.text).toContain('Expires in 5 minutes');
  });

  it('uses custom appName from context', () => {
    const result = verificationCodeTemplate(
      { code: '777777' },
      { appName: 'MyApp' },
    );
    expect(result.subject).toBe('MyApp - Verification Code');
    expect(result.html).toContain('MyApp');
  });

  it('defaults appName to PITCH when not provided in context', () => {
    const result = verificationCodeTemplate(
      { code: '888888' },
      { appName: '' },
    );
    expect(result.html).toContain('PITCH');
  });

  it('returns all three required fields: subject, html, text', () => {
    const result = verificationCodeTemplate({ code: '999999' }, baseContext);
    expect(result).toHaveProperty('subject');
    expect(result).toHaveProperty('html');
    expect(result).toHaveProperty('text');
  });

  it('throws when code is missing from data', () => {
    expect(() => verificationCodeTemplate({} as any, baseContext)).toThrow(
      'Verification code template requires a string code',
    );
  });

  it('throws when code is a number instead of a string', () => {
    expect(() =>
      verificationCodeTemplate({ code: 123456 } as any, baseContext),
    ).toThrow('Verification code template requires a string code');
  });

  it('throws when data is undefined', () => {
    expect(() => verificationCodeTemplate(undefined, baseContext)).toThrow(
      'Verification code template requires a string code',
    );
  });

  it('includes "Do not share this code" warning in text', () => {
    const result = verificationCodeTemplate({ code: '000000' }, baseContext);
    expect(result.text).toContain('Do not share this code with anyone.');
  });
});
