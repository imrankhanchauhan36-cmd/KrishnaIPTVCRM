import React from 'react';
import type { Device, Subscription } from '../types';
import { formatDate, daysRemaining } from '../utils/format';

// Deliberately reads ONLY plan/status/startingDate/renewalDate/device — the
// Subscription type no longer even carries panelAddedDays/panelExpiryDate
// (stripped server-side in customerAuth.controller.js), so there is no
// internal panel-operations field this component could accidentally render.
const SubscriptionCard: React.FC<{ subscription: Subscription; devices: Device[] }> = ({
  subscription,
  devices,
}) => {
  const isActive = subscription.status === 'Active';
  const remaining = daysRemaining(subscription.renewalDate);
  // Same join the Owner App uses (CustomerDetailsScreen.js: devices.find(d
  // => d._id === sub.device)) — the customer's own registered device, not a
  // browser fingerprint.
  const device = devices.find((d) => d._id === subscription.device);

  return (
    <div className="service-card">
      <div className="service-card-header">
        <div className="plan-name">{subscription.plan}</div>
        <span className={`status-badge ${isActive ? 'status-active' : 'status-expired'}`}>
          {subscription.status}
        </span>
      </div>

      {isActive && (
        <div className="days-remaining-block">
          <div className="days-remaining-number">{remaining}</div>
          <div className="days-remaining-label">Days Remaining</div>
        </div>
      )}

      <div className="field-grid">
        <div>
          <div className="field-label">Activated</div>
          <div className="field-value">{formatDate(subscription.startingDate)}</div>
        </div>
        <div>
          <div className="field-label">Valid Until</div>
          <div className="field-value">{formatDate(subscription.renewalDate)}</div>
        </div>
      </div>

      <div className="field-grid" style={{ marginTop: 14 }}>
        <div>
          <div className="field-label">Device</div>
          <div className="field-value">
            {device ? device.deviceName || device.deviceType : 'No Device Linked'}
          </div>
        </div>
        {device && (
          <div>
            <div className="field-label">MAC Address</div>
            <div className="field-value" style={{ fontFamily: 'monospace' }}>
              {device.macAddress}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionCard;
