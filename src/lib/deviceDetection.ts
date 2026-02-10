import { useState, useEffect } from 'react';

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export function detectDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;

  // Use width-based detection for responsive view
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';

  // Fallback to user agent for larger screens
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /iphone|ipod|android|blackberry|windows phone|opera mini|iemobile/i.test(userAgent);
  const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);

  if (isMobile) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export function useDeviceDetection() {
  const [deviceType, setDeviceType] = useState<DeviceType>(() => detectDeviceType());
  const [isTouchScreen, setIsTouchScreen] = useState<boolean>(() => isTouchDevice());

  useEffect(() => {
    const handleResize = () => {
      setDeviceType(detectDeviceType());
      setIsTouchScreen(isTouchDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return {
    deviceType,
    isMobile: deviceType === 'mobile',
    isTablet: deviceType === 'tablet',
    isDesktop: deviceType === 'desktop',
    isTouchScreen,
  };
}
