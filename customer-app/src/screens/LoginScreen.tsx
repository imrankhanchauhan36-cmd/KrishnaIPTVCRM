import React, { useState } from 'react';
import { requestOtp } from '../services/api';

interface Props {
  onOtpRequested: (phone: string, devOtp?: string) => void;
}

const LoginScreen: React.FC<Props> = ({ onOtpRequested }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError('Please enter your registered mobile number');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const result = await requestOtp(phone.trim());
      onOtpRequested(phone.trim(), result.otp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="centered">
      <form className="card" onSubmit={handleSubmit}>
        <h1 className="brand">Krishna IPTV</h1>
        <p className="subtitle">Enter your registered mobile number</p>

        <input
          className="input"
          type="tel"
          placeholder="e.g. +1 9876543210"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoFocus
        />
        {error && <div className="error-text">{error}</div>}

        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Sending code…' : 'Continue'}
        </button>
      </form>
    </div>
  );
};

export default LoginScreen;
