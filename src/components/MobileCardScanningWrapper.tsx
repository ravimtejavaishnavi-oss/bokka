import React from 'react';
import { useNavigate } from 'react-router-dom';
import MobileCardScanning from './MobileCardScanning';

const MobileCardScanningWrapper: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  const handleSwitchToDesktop = () => {
    navigate('/card-scanning');
  };

  return <MobileCardScanning onBack={handleBack} onSwitchToDesktop={handleSwitchToDesktop} />;
};

export default MobileCardScanningWrapper;