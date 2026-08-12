import React, { useState } from 'react';
import { requestOtp, verifyOtp } from '../services/api';
import type { Session } from '../types';

interface Props {
  phone: string;
  devOtp?: string;
  onVerified: (session: Session) => void;
  onBack: () => void;
}

const OtpScreen: React.FC<Props> = ({ phone, devOtp, onVerified, onBack }) => {
  const [otp, setOtp] = useState(devOtp || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [currentDevOtp, setCurrentDevOtp] = useState(devOtp);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.trim().length !== 4) {
      setError('Enter the 4-digit code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await verifyOtp(phone, otp.trim());
      onVerified(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const result = await requestOtp(phone);
      setCurrentDevOtp(result.otp);
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="centered">
      <form className="card" onSubmit={handleSubmit}>
        <h1 className="title">Verify Code</h1>
        <p className="subtitle">Enter the 4-digit code for {phone}</p>

        {currentDevOtp && (
          <div className="otp-hint">
            Your code: <strong>{currentDevOtp}</strong>
          </div>
        )}

        <input
          className="input"
          type="text"
          inputMode="numeric"
          maxLength={4}
          placeholder="0000"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
          autoFocus
        />
        {error && <div className="error-text">{error}</div>}

        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify & Continue'}
        </button>
        <button type="button" className="link-button" onClick={handleResend} disabled={resending}>
          {resending ? 'Resending…' : 'Resend code'}
        </button>
        <button type="button" className="link-button" onClick={onBack}>
          Change number
        </button>
      </form>
    </div>
  );
};

export default OtpScreen;
