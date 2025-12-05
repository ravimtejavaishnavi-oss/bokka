import React from 'react';
import { useNavigate } from 'react-router-dom';
import CardScanning from './CardScanning';

const CardScanningWrapper: React.FC = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Navigate back to dashboard or home
    navigate('/dashboard');
  };

  const handleSwitchToMobile = () => {
    navigate('/mobile-card-scan');
  };

  return <CardScanning onBack={handleBack} onSwitchToMobile={handleSwitchToMobile} />;
};

export default CardScanningWrapper;